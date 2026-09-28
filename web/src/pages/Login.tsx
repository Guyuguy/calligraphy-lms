import { Loader2, PenTool } from "lucide-react";
import { useState } from "react";
import { api, setAuthToken, type User } from "@/api/client";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";

interface LoginProps {
	onLogin: (token: string, user: User) => void;
}

const QUICK_LOGINS = [
	{ label: "管理员", username: "admin" },
	{ label: "教师", username: "teacher01" },
	{ label: "学生", username: "student01" },
	{ label: "家长", username: "parent01" },
];

export function Login({ onLogin }: LoginProps) {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	const submit = async (e?: React.FormEvent) => {
		e?.preventDefault();
		if (!username || !password) {
			setError("请输入用户名和密码");
			return;
		}
		setLoading(true);
		setError("");
		try {
			const res = await api.post<{ token: string; user: User }>("/auth/login", {
				username,
				password,
			});
			setAuthToken(res.token);
			onLogin(res.token, res.user);
		} catch (err) {
			setError(err instanceof Error ? err.message : "登录失败");
		} finally {
			setLoading(false);
		}
	};

	const quickFill = (u: string) => {
		setUsername(u);
		setPassword("pass123");
		setError("");
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-surface-0 ink-bg p-4">
			<div className="w-full max-w-md">
				<div className="mb-8 text-center">
					<div className="mb-3 inline-flex size-14 items-center justify-center rounded-2xl brand-gradient text-white shadow-lg">
						<PenTool className="size-7" />
					</div>
					<h1 className="font-serif text-3xl font-semibold text-text-primary">
						墨韵书院
					</h1>
					<p className="mt-1 text-sm text-text-muted">硬笔书法教学管理系统</p>
				</div>

				<Card>
					<CardHeader>
						<CardTitle>登录</CardTitle>
						<CardDescription>使用账号密码登录系统</CardDescription>
					</CardHeader>
					<CardContent>
						<form onSubmit={submit} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="username">用户名</Label>
								<Input
									id="username"
									value={username}
									onChange={(e) => setUsername(e.target.value)}
									placeholder="请输入用户名"
									autoComplete="username"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="password">密码</Label>
								<Input
									id="password"
									type="password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									placeholder="请输入密码"
									autoComplete="current-password"
								/>
							</div>
							{error && (
								<div className="rounded-md bg-status-error/10 px-3 py-2 text-sm text-status-error">
									{error}
								</div>
							)}
							<Button type="submit" className="w-full" disabled={loading}>
								{loading ? <Loader2 className="size-4 animate-spin" /> : null}
								登录
							</Button>
						</form>

						<div className="mt-6 border-t border-border pt-4">
							<div className="mb-2 text-xs text-text-muted">
								快速登录（演示账号 · 密码 pass123）
							</div>
							<div className="grid grid-cols-2 gap-2">
								{QUICK_LOGINS.map((q) => (
									<Button
										key={q.username}
										type="button"
										variant="outline"
										size="sm"
										onClick={() => quickFill(q.username)}
									>
										{q.label}
									</Button>
								))}
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
