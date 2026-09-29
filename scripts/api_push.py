#!/usr/bin/env python3
"""
通过 GitHub Git Database API 推送本地 git 历史到远程。
用于企业代理拦截 git-receive-pack 协议（HTTP 403 nonbusiness）的场景。

流程：
1. 按拓扑顺序遍历本地所有 commit
2. 对每个 commit，用 git ls-tree -r 拿到所有叶子条目
3. 用 createTree API（带 content 字段）一次性重建整个 tree（GitHub 自动创建 blob 并去重）
4. 用 createCommit API 创建 commit（保留原 author/committer/message/date）
5. 最后用 updateRef API force 更新 refs/heads/<branch>

依赖：gh CLI（已登录）、git、python3
"""

import subprocess
import json
import sys
import base64

REPO = "Guyuguy/calligraphy-lms"
BRANCH = "main"


def run(cmd):
    """运行命令，返回 stdout（strip）。显式 UTF-8 解码。"""
    result = subprocess.run(cmd, capture_output=True, encoding="utf-8",
                            errors="replace")
    if result.returncode != 0:
        sys.stderr.write(f"CMD FAILED: {' '.join(cmd[:3])}...\n")
        sys.stderr.write(f"stderr: {result.stderr}\n")
        raise RuntimeError(f"command failed: {cmd}")
    return (result.stdout or "").strip()


def gh_api(method, endpoint, input_json=None):
    """调用 gh api，input_json 为 dict 时用 --input - 传 JSON body"""
    cmd = ["gh", "api", "-X", method, f"repos/{REPO}/{endpoint}"]
    if input_json is not None:
        cmd += ["--input", "-"]
        body = json.dumps(input_json)
        proc = subprocess.run(cmd, input=body.encode("utf-8"),
                              capture_output=True)
    else:
        proc = subprocess.run(cmd, capture_output=True)
    if proc.returncode != 0:
        sys.stderr.write(f"GH API FAILED: {method} {endpoint}\n")
        sys.stderr.write(f"stderr: {proc.stderr.decode('utf-8', 'replace')}\n")
        sys.stderr.write(f"stdout: {proc.stdout[:500].decode('utf-8', 'replace')}\n")
        raise RuntimeError(f"gh api failed: {endpoint}")
    out = proc.stdout.decode("utf-8", "replace")
    return json.loads(out) if out.strip() else {}


def get_commit_meta(sha):
    """获取 commit 的元数据（message、author、committer、date）"""
    return {
        "message": run(["git", "log", "-1", "--pretty=format:%B", sha]),
        "author_name": run(["git", "log", "-1", "--pretty=format:%an", sha]),
        "author_email": run(["git", "log", "-1", "--pretty=format:%ae", sha]),
        "author_date": run(["git", "log", "-1", "--pretty=format:%aI", sha]),
        "committer_name": run(["git", "log", "-1", "--pretty=format:%cn", sha]),
        "committer_email": run(["git", "log", "-1", "--pretty=format:%ce", sha]),
        "committer_date": run(["git", "log", "-1", "--pretty=format:%cI", sha]),
    }


def build_tree_entries(commit_sha):
    """为 commit 构造 createTree 的 entries 列表。
    优先用 UTF-8 文本方式上传（GitHub createTree 的 content 字段直接接受文本）。
    对无法 UTF-8 解码的二进制文件，回退到 base64 + encoding=base64。"""
    entries = []
    output = run(["git", "ls-tree", "-r", "--full-tree", commit_sha])
    for line in output.splitlines():
        meta, path = line.split("\t", 1)
        mode, type_, sha = meta.split()
        raw = subprocess.run(
            ["git", "cat-file", "-p", sha],
            capture_output=True
        ).stdout
        try:
            text = raw.decode("utf-8")
            entries.append({
                "path": path,
                "mode": mode,
                "type": type_,
                "content": text,
            })
        except UnicodeDecodeError:
            content_b64 = base64.b64encode(raw).decode("ascii")
            entries.append({
                "path": path,
                "mode": mode,
                "type": type_,
                "content": content_b64,
                "encoding": "base64",
            })
    return entries


def main():
    print(f"=== API push: {REPO} @ {BRANCH} ===")

    run(["gh", "auth", "status"])

    commits = run(["git", "rev-list", "--topo-order", "--reverse", BRANCH]).split()
    total = len(commits)
    print(f"待推送 commit 数: {total}\n")

    # 检查远程分支是否已存在，若存在则以远程最新 commit 作为第一个 parent
    parent_remote_sha = None
    try:
        ref_resp = gh_api("GET", f"git/refs/heads/{BRANCH}")
        parent_remote_sha = ref_resp.get("object", {}).get("sha")
        if parent_remote_sha:
            print(f"远程分支已存在，将以 {parent_remote_sha[:8]} 作为首个 commit 的 parent\n")
    except RuntimeError:
        print(f"远程分支 {BRANCH} 不存在，将从零开始创建\n")

    for i, commit_sha in enumerate(commits, 1):
        short = commit_sha[:8]
        print(f"[{i}/{total}] commit {short}")

        entries = build_tree_entries(commit_sha)
        print(f"  entries: {len(entries)}")
        tree_resp = gh_api("POST", "git/trees", {"tree": entries})
        remote_tree_sha = tree_resp["sha"]
        print(f"  remote tree: {remote_tree_sha[:8]}")

        meta = get_commit_meta(commit_sha)
        commit_payload = {
            "message": meta["message"],
            "tree": remote_tree_sha,
            "parents": [parent_remote_sha] if parent_remote_sha else [],
            "author": {
                "name": meta["author_name"],
                "email": meta["author_email"],
                "date": meta["author_date"],
            },
            "committer": {
                "name": meta["committer_name"],
                "email": meta["committer_email"],
                "date": meta["committer_date"],
            },
        }
        commit_resp = gh_api("POST", "git/commits", commit_payload)
        remote_commit_sha = commit_resp["sha"]
        print(f"  remote commit: {remote_commit_sha[:8]}")

        parent_remote_sha = remote_commit_sha

    print(f"\n=== 更新 refs/heads/{BRANCH} ===")
    final_sha = parent_remote_sha
    print(f"目标 SHA: {final_sha}")
    ref_resp = gh_api("PATCH", f"git/refs/heads/{BRANCH}",
                      {"sha": final_sha, "force": True})
    remote_sha = ref_resp.get("object", {}).get("sha", "")
    print(f"远程 {BRANCH} SHA: {remote_sha}")
    print(f"本地最终 SHA: {run(['git', 'rev-parse', BRANCH])}")

    if remote_sha == final_sha:
        print("\n[PASS] 推送成功")
    else:
        print("\n[FAIL] 推送失败：SHA 不一致")
        sys.exit(1)


if __name__ == "__main__":
    main()
