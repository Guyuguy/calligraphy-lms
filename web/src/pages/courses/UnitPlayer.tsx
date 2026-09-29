import { ArrowLeft, BookOpen, CheckCircle2, PlayCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
	ApiError,
	api,
	type Course,
	type Module,
	type Unit,
	type User,
} from "@/api/client";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

interface UnitPlayerProps {
	courseId: string;
	unitId: string;
	user: User;
	navigate: (p: string) => void;
}

function errMsg(e: unknown): string {
	if (e instanceof ApiError) return e.message;
	return e instanceof Error ? e.message : "加载失败";
}

export function UnitPlayer({
	courseId,
	unitId,
	user,
	navigate,
}: UnitPlayerProps) {
	const [course, setCourse] = useState<Course | null>(null);
	const [videoUrl, setVideoUrl] = useState<string>("");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [watchedSeconds, setWatchedSeconds] = useState(0);
	const [completed, setCompleted] = useState(false);
	const [savingProgress, setSavingProgress] = useState(false);
	const lastReportRef = useRef(0);
	const videoRef = useRef<HTMLVideoElement>(null);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			setLoading(true);
			setError(null);
			try {
				const r = await api.get<{
					course: Course;
				}>(`/courses/${courseId}`);
				if (cancelled) return;
				setCourse(r.course);
				// 找到单元
				const unit = r.course.modules
					.flatMap((m) => m.units)
					.find((u) => u.id === unitId);
				if (!unit) {
					setError("单元不存在");
					return;
				}
				if (unit.type !== "video") {
					setError("该单元不是视频单元");
					return;
				}
				if (!unit.videoUrl) {
					setError("该单元尚未上传视频");
					return;
				}
				// 用带 token 的 fetch 拿 blob URL
				const url = await api.getVideoBlob(unit.videoUrl.replace(/^\/api/, ""));
				if (cancelled) return;
				setVideoUrl(url);
				// 加载已有进度
				if (user.role === "student") {
					try {
						const p = await api.get<{
							modules: {
								units: {
									id: string;
									videoWatchedSeconds: number;
									status: string;
								}[];
							}[];
						}>(`/progress/${user.id}/course/${courseId}`);
						for (const mod of p.modules) {
							const u = mod.units.find((x) => x.id === unitId);
							if (u) {
								setWatchedSeconds(u.videoWatchedSeconds);
								if (u.status === "completed") setCompleted(true);
								break;
							}
						}
					} catch {
						// 进度加载失败不阻塞播放
					}
				}
			} catch (e) {
				if (!cancelled) setError(errMsg(e));
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [courseId, unitId, user.id, user.role]);

	const reportProgress = async (seconds: number) => {
		if (user.role !== "student") return;
		// 节流：每 10 秒上报一次
		const now = Date.now();
		if (now - lastReportRef.current < 10000) return;
		lastReportRef.current = now;
		setSavingProgress(true);
		try {
			const r = await api.post<{
				ok: boolean;
				progress: { status: string; percent: number };
			}>(`/progress/${user.id}/units/${unitId}`, {
				videoWatchedSeconds: Math.floor(seconds),
			});
			if (r.progress.status === "completed") setCompleted(true);
		} catch {
			// 静默失败，不打扰播放
		} finally {
			setSavingProgress(false);
		}
	};

	const handleTimeUpdate = () => {
		const v = videoRef.current;
		if (!v) return;
		const cur = v.currentTime;
		setWatchedSeconds(Math.max(watchedSeconds, Math.floor(cur)));
		// 节流上报
		reportProgress(cur);
	};

	const handleEnded = () => {
		const v = videoRef.current;
		if (!v) return;
		// 播放结束，强制上报最终进度
		lastReportRef.current = 0; // 重置节流
		reportProgress(v.duration || v.currentTime);
	};

	if (loading) {
		return (
			<PageContainer title="加载中...">
				<div className="text-text-muted">正在获取视频...</div>
			</PageContainer>
		);
	}

	if (error || !course) {
		return (
			<PageContainer title="无法播放">
				<Card>
					<CardContent className="py-12 text-center text-status-error">
						{error ?? "加载失败"}
					</CardContent>
				</Card>
			</PageContainer>
		);
	}

	// 找到当前单元和同章节其他单元
	let currentModule: Module | null = null;
	let currentUnit: Unit | null = null;
	let prevUnit: Unit | null = null;
	let nextUnit: Unit | null = null;
	for (const m of course.modules) {
		for (let i = 0; i < m.units.length; i++) {
			if (m.units[i].id === unitId) {
				currentModule = m;
				currentUnit = m.units[i];
				if (i > 0) prevUnit = m.units[i - 1];
				else if (currentModule) {
					// 跨章节找上一节
					const mi = course.modules.indexOf(currentModule);
					if (mi > 0) {
						const prevMod = course.modules[mi - 1];
						if (prevMod.units.length > 0)
							prevUnit = prevMod.units[prevMod.units.length - 1];
					}
				}
				if (i < m.units.length - 1) nextUnit = m.units[i + 1];
				else {
					const mi = course.modules.indexOf(m);
					if (mi < course.modules.length - 1) {
						const nextMod = course.modules[mi + 1];
						if (nextMod.units.length > 0) nextUnit = nextMod.units[0];
					}
				}
				break;
			}
		}
		if (currentUnit) break;
	}

	if (!currentUnit) {
		return (
			<PageContainer title="单元不存在">
				<Card>
					<CardContent className="py-12 text-center text-status-error">
						找不到该单元
					</CardContent>
				</Card>
			</PageContainer>
		);
	}

	const threshold = currentUnit.completionCriteria.watchSeconds ?? 0;
	const progressPercent =
		threshold > 0
			? Math.min(100, Math.round((watchedSeconds / threshold) * 100))
			: 0;

	return (
		<PageContainer
			title={currentUnit.title}
			description={`${course.title} · ${currentModule?.title ?? ""}`}
			actions={
				<Button
					variant="outline"
					onClick={() => navigate(`/courses/${courseId}`)}
				>
					<ArrowLeft className="size-4" />
					<span className="hidden sm:inline">返回课程</span>
				</Button>
			}
		>
			<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
				<div className="space-y-4 lg:col-span-2">
					<Card>
						<CardContent className="p-0">
							<div className="overflow-hidden rounded-t-xl bg-black">
								<video
									ref={videoRef}
									src={videoUrl}
									controls
									autoPlay
									className="max-h-[70vh] w-full"
									onTimeUpdate={handleTimeUpdate}
									onEnded={handleEnded}
								>
									<track kind="captions" />
								</video>
							</div>
							<div className="space-y-2 p-4">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<PlayCircle className="size-4 text-brand" />
										<span className="text-sm font-medium">
											{currentUnit.title}
										</span>
									</div>
									{completed ? (
										<Badge variant="success">
											<CheckCircle2 className="size-3" />
											已完成
										</Badge>
									) : (
										savingProgress && (
											<span className="text-xs text-text-muted">
												进度保存中...
											</span>
										)
									)}
								</div>
								{currentUnit.description && (
									<p className="text-sm text-text-secondary">
										{currentUnit.description}
									</p>
								)}
								{user.role === "student" && threshold > 0 && (
									<div className="rounded-md border border-border bg-surface-1 p-3 text-xs">
										<div className="mb-1 flex items-center justify-between">
											<span className="text-text-muted">
												学习进度（累计 {watchedSeconds}s / 需 {threshold}s）
											</span>
											<span className="font-medium">{progressPercent}%</span>
										</div>
										<div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
											<div
												className="h-full bg-brand transition-all"
												style={{ width: `${progressPercent}%` }}
											/>
										</div>
									</div>
								)}
							</div>
						</CardContent>
					</Card>

					{/* 上一节 / 下一节 */}
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
						{prevUnit ? (
							<Button
								variant="outline"
								onClick={() => navigate(`/learn/${courseId}/${prevUnit.id}`)}
								className="w-full sm:w-auto"
							>
								<ArrowLeft className="size-4 shrink-0" />
								<span className="truncate">上一节：{prevUnit.title}</span>
							</Button>
						) : (
							<span />
						)}
						{nextUnit ? (
							<Button
								onClick={() => navigate(`/learn/${courseId}/${nextUnit.id}`)}
								className="w-full sm:w-auto"
							>
								<span className="truncate">下一节：{nextUnit.title}</span>
							</Button>
						) : (
							<span className="text-xs text-text-muted">已是最后一节</span>
						)}
					</div>
				</div>

				{/* 右侧：本课程其他单元 */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-base">
							<BookOpen className="size-4 text-brand" />
							课程大纲
						</CardTitle>
						<CardDescription>
							共 {course.modules.length} 章 ·{" "}
							{course.modules.reduce((s, m) => s + m.units.length, 0)} 节
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						{course.modules.map((m) => (
							<div key={m.id}>
								<div className="mb-1 text-xs font-medium text-text-muted">
									{m.title}
								</div>
								<div className="space-y-0.5">
									{m.units.map((u) => {
										const isCurrent = u.id === unitId;
										const isPlayable = u.type === "video" && u.videoUrl;
										return (
											<button
												key={u.id}
												type="button"
												disabled={!isPlayable}
												onClick={() =>
													isPlayable && navigate(`/learn/${courseId}/${u.id}`)
												}
												className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
													isCurrent
														? "bg-brand/10 text-brand"
														: isPlayable
															? "hover:bg-surface-2"
															: "cursor-not-allowed text-text-muted"
												}`}
											>
												<PlayCircle
													className={`size-3.5 shrink-0 ${
														isCurrent ? "text-brand" : "text-text-muted"
													}`}
												/>
												<span className="flex-1 truncate">{u.title}</span>
												{isPlayable && !isCurrent && (
													<span className="text-xs text-text-muted">▶</span>
												)}
											</button>
										);
									})}
								</div>
							</div>
						))}
					</CardContent>
				</Card>
			</div>
		</PageContainer>
	);
}
