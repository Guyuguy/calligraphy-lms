import {
	AlertTriangle,
	CheckCircle2,
	Clock,
	FileText,
	GitCompare,
	PenTool,
	Star,
	TrendingUp,
	Users,
	XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
	type Annotation,
	type AnnotationType,
	api,
	type ClassProgressResponse,
	LEVEL_LABELS,
	STAGE_LABELS,
	STYLE_LABELS,
	type SubmissionDetailFull,
	type SubmissionListItem,
	type SubmissionListResponse,
	type SubmissionVersion,
	type SubmissionVersionsResponse,
	type TeachingAlertsResponse,
	type TeachingClassesResponse,
	type TeachingStats,
	type User,
} from "@/api/client";
import { AnnotationCanvas } from "@/components/domain/AnnotationCanvas";
import { AudioRecorder } from "@/components/domain/AudioRecorder";
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
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

interface TeachingDashboardProps {
	user: User;
}

export function TeachingDashboard({ user }: TeachingDashboardProps) {
	const [classes, setClasses] = useState<TeachingClassesResponse | null>(null);
	const [submissions, setSubmissions] = useState<SubmissionListResponse | null>(
		null,
	);
	const [stats, setStats] = useState<TeachingStats | null>(null);
	const [alerts, setAlerts] = useState<TeachingAlertsResponse | null>(null);
	const [classProgress, setClassProgress] =
		useState<ClassProgressResponse | null>(null);
	const [classProgressCourseId, setClassProgressCourseId] = useState<
		string | null
	>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [reviewing, setReviewing] = useState<SubmissionListItem | null>(null);
	const [reviewScore, setReviewScore] = useState<number>(80);
	const [reviewComment, setReviewComment] = useState("");
	const [submitting, setSubmitting] = useState(false);
	// Batch 4: 标注 + 版本对比 + 音频评语
	const [submissionDetail, setSubmissionDetail] =
		useState<SubmissionDetailFull | null>(null);
	const [versions, setVersions] = useState<SubmissionVersion[]>([]);
	const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
		null,
	);
	const [annotationType, setAnnotationType] =
		useState<AnnotationType>("circle");
	const [annotationContent, setAnnotationContent] = useState("");
	const [audioUrl, setAudioUrl] = useState("");
	const [audioUploading, setAudioUploading] = useState(false);
	const [detailLoading, setDetailLoading] = useState(false);

	const isTeacher =
		user.role === "teacher" ||
		user.role === "academic_head" ||
		user.role === "admin";

	useEffect(() => {
		if (!isTeacher) {
			setLoading(false);
			return;
		}
		let cancelled = false;
		(async () => {
			setLoading(true);
			setError(null);
			try {
				const [cls, subs, st, al] = await Promise.all([
					api.get<TeachingClassesResponse>("/teaching/classes"),
					api.get<SubmissionListResponse>(
						"/teaching/submissions?status=pending",
					),
					api.get<TeachingStats>("/teaching/stats"),
					api.get<TeachingAlertsResponse>("/teaching/alerts"),
				]);
				if (cancelled) return;
				setClasses(cls);
				setSubmissions(subs);
				setStats(st);
				setAlerts(al);
				if (cls.classes.length > 0)
					setClassProgressCourseId(cls.classes[0].courseId);
			} catch (e) {
				if (!cancelled) setError(e instanceof Error ? e.message : "加载失败");
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [isTeacher]);

	// 加载班级学生进度
	useEffect(() => {
		if (!classProgressCourseId || !isTeacher) return;
		let cancelled = false;
		(async () => {
			try {
				const cp = await api.get<ClassProgressResponse>(
					`/progress/class/${classProgressCourseId}`,
				);
				if (!cancelled) setClassProgress(cp);
			} catch (e) {
				if (!cancelled)
					setError(e instanceof Error ? e.message : "加载班级进度失败");
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [classProgressCourseId, isTeacher]);

	const openReview = async (s: SubmissionListItem) => {
		setReviewing(s);
		setReviewScore(s.score ?? 80);
		setReviewComment(s.teacherComment ?? "");
		setAudioUrl("");
		setAnnotationContent("");
		setAnnotationType("circle");
		setSubmissionDetail(null);
		setVersions([]);
		setSelectedVersionId(s.id);
		setDetailLoading(true);
		try {
			const [detail, vers] = await Promise.all([
				api.get<SubmissionDetailFull>(`/submissions/${s.id}`),
				api.get<SubmissionVersionsResponse>(`/submissions/${s.id}/versions`),
			]);
			setSubmissionDetail(detail);
			setVersions(vers.versions);
			if (detail.submission.teacherAudioUrl) {
				// 服务器返回的是 /api/submissions/.../audio/...，前端需要可播放的 URL
				// 用带 token 的 fetch 拿到 blob，转 object URL
				const playable = await api.getAudioBlob(
					detail.submission.teacherAudioUrl.replace(/^\/api/, ""),
				);
				setAudioUrl(playable);
			}
		} catch (e) {
			setError(e instanceof Error ? e.message : "加载提交详情失败");
		} finally {
			setDetailLoading(false);
		}
	};

	const addAnnotation = async (
		x: number,
		y: number,
		type: AnnotationType,
		options?: { size?: number; angle?: number },
	) => {
		if (!reviewing) return;
		// 所有类型都允许空内容
		const content = annotationContent.trim();
		try {
			const res = await api.post<{ ok: boolean; annotation: Annotation }>(
				`/submissions/${reviewing.id}/annotations`,
				{ x, y, type, content, ...options },
			);
			if (submissionDetail) {
				setSubmissionDetail({
					...submissionDetail,
					submission: {
						...submissionDetail.submission,
						annotations: [
							...submissionDetail.submission.annotations,
							res.annotation,
						],
					},
				});
			}
			// 保留内容，方便连续标注同类型；如需清空可手动清
		} catch (e) {
			setError(e instanceof Error ? e.message : "添加标注失败");
		}
	};

	const deleteAnnotation = async (annoId: string) => {
		if (!reviewing) return;
		try {
			await api.del(`/submissions/${reviewing.id}/annotations/${annoId}`);
			if (submissionDetail) {
				setSubmissionDetail({
					...submissionDetail,
					submission: {
						...submissionDetail.submission,
						annotations: submissionDetail.submission.annotations.filter(
							(a) => a.id !== annoId,
						),
					},
				});
			}
		} catch (e) {
			setError(e instanceof Error ? e.message : "删除标注失败");
		}
	};

	const switchVersion = async (versionId: string) => {
		if (!reviewing) return;
		setSelectedVersionId(versionId);
		setDetailLoading(true);
		try {
			const detail = await api.get<SubmissionDetailFull>(
				`/submissions/${versionId}`,
			);
			setSubmissionDetail(detail);
			setReviewScore(detail.submission.score ?? 80);
			setReviewComment(detail.submission.teacherComment ?? "");
			if (detail.submission.teacherAudioUrl) {
				const playable = await api.getAudioBlob(
					detail.submission.teacherAudioUrl.replace(/^\/api/, ""),
				);
				setAudioUrl(playable);
			} else {
				setAudioUrl("");
			}
		} catch (e) {
			setError(e instanceof Error ? e.message : "切换版本失败");
		} finally {
			setDetailLoading(false);
		}
	};

	const handleAudioRecorded = async (blob: Blob) => {
		if (!reviewing) return;
		setAudioUploading(true);
		setError(null);
		try {
			await api.postAudio<{ ok: boolean; audioUrl: string }>(
				`/submissions/${reviewing.id}/audio`,
				blob,
			);
			// 上传成功后用本地 blob 创建可播放 URL（避免带 token 的 fetch 问题）
			setAudioUrl(URL.createObjectURL(blob));
		} catch (e) {
			setError(e instanceof Error ? e.message : "音频上传失败");
		} finally {
			setAudioUploading(false);
		}
	};

	const submitReview = async () => {
		if (!reviewing || !selectedVersionId) return;
		setSubmitting(true);
		try {
			// teacherAudioUrl 已在上传音频时由服务器写入提交记录。
			// 这里只在用户清除了录音时显式传空串覆盖；否则不传，保留服务器值。
			const payload: {
				score: number;
				teacherComment: string;
				teacherAudioUrl?: string;
			} = {
				score: reviewScore,
				teacherComment: reviewComment,
			};
			if (!audioUrl) {
				payload.teacherAudioUrl = "";
			}
			await api.post(
				`/teaching/submissions/${selectedVersionId}/review`,
				payload,
			);
			// 重新拉取待批改列表与统计，避免版本切换导致的列表与服务器不一致
			const [subs, st] = await Promise.all([
				api.get<SubmissionListResponse>("/teaching/submissions?status=pending"),
				api.get<TeachingStats>("/teaching/stats"),
			]);
			setSubmissions(subs);
			setStats(st);
			setReviewing(null);
		} catch (e) {
			setError(e instanceof Error ? e.message : "批改失败");
		} finally {
			setSubmitting(false);
		}
	};

	if (!isTeacher) {
		return (
			<PageContainer title="教学进度" description="此页面面向教师角色">
				<Card>
					<CardContent className="py-12 text-center text-text-muted">
						当前角色（{user.role}）暂不展示教学进度。请使用教师账号登录查看。
					</CardContent>
				</Card>
			</PageContainer>
		);
	}

	if (loading) {
		return (
			<PageContainer title="教学进度" description="班级进度概览与待批改作业">
				<div className="flex h-64 items-center justify-center text-text-muted">
					加载中...
				</div>
			</PageContainer>
		);
	}

	if (error || !classes || !submissions || !stats || !alerts) {
		return (
			<PageContainer title="教学进度" description="班级进度概览与待批改作业">
				<Card>
					<CardContent className="py-12 text-center text-status-error">
						{error ?? "加载失败"}
					</CardContent>
				</Card>
			</PageContainer>
		);
	}

	return (
		<PageContainer title="教学进度" description="班级进度概览与待批改作业">
			<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
				<div className="space-y-6 lg:col-span-2">
					{/* 教学统计 */}
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
						<StatBox
							icon={Users}
							label="学生总数"
							value={String(stats.studentCount)}
							color="brand"
						/>
						<StatBox
							icon={FileText}
							label="待批改"
							value={String(stats.pendingReviews)}
							color="warning"
						/>
						<StatBox
							icon={CheckCircle2}
							label="已批改"
							value={String(stats.reviewedCount)}
							color="success"
						/>
						<StatBox
							icon={Star}
							label="教师评分"
							value={stats.rating.toFixed(1)}
							color="info"
						/>
					</div>

					{/* 班级进度 */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Users className="size-4 text-brand" />
								班级进度
							</CardTitle>
							<CardDescription>
								共 {classes.classes.length} 个班级 · 点击查看学生明细
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-3">
							{classes.classes.length === 0 ? (
								<div className="py-6 text-center text-text-muted">
									尚未分配班级
								</div>
							) : (
								classes.classes.map((c) => (
									<button
										key={c.courseId}
										type="button"
										onClick={() => setClassProgressCourseId(c.courseId)}
										className={`w-full rounded-md border p-3 text-left transition-colors ${
											classProgressCourseId === c.courseId
												? "border-brand bg-brand/5"
												: "border-border hover:border-brand/40 hover:bg-surface-1"
										}`}
									>
										<div className="flex items-center justify-between">
											<div className="font-medium">{c.title}</div>
											<div className="flex items-center gap-2">
												<Badge variant="secondary">{c.enrolledCount} 人</Badge>
												{c.pendingReviews > 0 && (
													<Badge variant="warning">
														{c.pendingReviews} 待批
													</Badge>
												)}
											</div>
										</div>
										<div className="mt-2 flex items-center gap-3">
											<Progress value={c.avgPercent} size="sm" color="brand" />
											<span className="w-10 text-xs text-text-muted">
												{c.avgPercent}%
											</span>
										</div>
										<div className="mt-1 text-xs text-text-muted">
											{STAGE_LABELS[c.stage]} · {LEVEL_LABELS[c.level]} ·{" "}
											{STYLE_LABELS[c.style]} · {c.scheduleCount} 个排课
										</div>
									</button>
								))
							)}
						</CardContent>
					</Card>

					{/* 班级学生明细 */}
					{classProgress && (
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Users className="size-4 text-brand" />
									{classProgress.courseTitle} · 学生明细
								</CardTitle>
								<CardDescription>
									{classProgress.studentCount} 名学生 · 平均进度{" "}
									{classProgress.averagePercent}%
								</CardDescription>
							</CardHeader>
							<CardContent>
								{/* 平板/桌面：表格 */}
								<div className="hidden md:block">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>学生</TableHead>
												<TableHead>年级</TableHead>
												<TableHead className="w-40">进度</TableHead>
												<TableHead>最近活跃</TableHead>
												<TableHead>状态</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{classProgress.students.map((s) => (
												<TableRow key={s.student.id}>
													<TableCell className="font-medium">
														{s.student.name}
													</TableCell>
													<TableCell className="text-text-secondary">
														{s.profile.grade}
													</TableCell>
													<TableCell>
														<div className="flex items-center gap-2">
															<Progress
																value={s.coursePercent}
																size="sm"
																color={
																	s.coursePercent < 40 ? "warning" : "brand"
																}
															/>
															<span className="w-10 text-xs text-text-muted">
																{s.coursePercent}%
															</span>
														</div>
													</TableCell>
													<TableCell className="text-text-muted">
														{formatRelativeTime(s.lastActivityAt)}
													</TableCell>
													<TableCell>
														{s.alerts.length > 0 ? (
															<Badge variant="warning">
																<AlertTriangle className="size-3" />
																{s.alerts.length} 提醒
															</Badge>
														) : (
															<Badge variant="success">正常</Badge>
														)}
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>

								{/* 手机：卡片 */}
								<div className="space-y-2 md:hidden">
									{classProgress.students.map((s) => (
										<div
											key={s.student.id}
											className="rounded-md border border-border bg-surface-1 p-3"
										>
											<div className="flex items-center justify-between gap-2">
												<div className="font-medium">{s.student.name}</div>
												{s.alerts.length > 0 ? (
													<Badge variant="warning" className="shrink-0">
														<AlertTriangle className="size-3" />
														{s.alerts.length} 提醒
													</Badge>
												) : (
													<Badge variant="success" className="shrink-0">
														正常
													</Badge>
												)}
											</div>
											<div className="mt-1 text-xs text-text-muted">
												{s.profile.grade} ·{" "}
												{formatRelativeTime(s.lastActivityAt)}
											</div>
											<div className="mt-2 flex items-center gap-2">
												<Progress
													value={s.coursePercent}
													size="sm"
													color={s.coursePercent < 40 ? "warning" : "brand"}
												/>
												<span className="w-10 text-xs text-text-muted">
													{s.coursePercent}%
												</span>
											</div>
										</div>
									))}
								</div>
							</CardContent>
						</Card>
					)}
				</div>

				{/* 右侧栏 */}
				<div className="space-y-6">
					{/* 待批改作业 */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<FileText className="size-4 text-brand" />
								待批改作业
							</CardTitle>
							<CardDescription>
								{submissions.count} 份作业等待批改
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-2">
							{submissions.submissions.length === 0 ? (
								<div className="py-4 text-center text-sm text-text-muted">
									暂无待批改作业
								</div>
							) : (
								submissions.submissions.slice(0, 8).map((s) => (
									<div
										key={s.id}
										className="rounded-md border border-border bg-surface-1 p-3"
									>
										<div className="flex items-center justify-between">
											<div className="font-medium text-sm">{s.studentName}</div>
											<Badge variant="warning">待批改</Badge>
										</div>
										<div className="mt-1 text-xs text-text-muted">
											{s.assignmentTitle} · {formatRelativeTime(s.submittedAt)}
										</div>
										<Button
											size="sm"
											variant="outline"
											className="mt-2 w-full"
											onClick={() => openReview(s)}
										>
											<PenTool className="size-3" />
											批改
										</Button>
									</div>
								))
							)}
						</CardContent>
					</Card>

					{/* 落后预警 */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<AlertTriangle className="size-4 text-status-warning" />
								落后预警
							</CardTitle>
							<CardDescription>{alerts.count} 条提醒</CardDescription>
						</CardHeader>
						<CardContent className="space-y-2 text-sm">
							{alerts.alerts.length === 0 ? (
								<div className="py-2 text-center text-text-muted">暂无预警</div>
							) : (
								alerts.alerts.slice(0, 6).map((a) => (
									<div
										key={`${a.studentId}:${a.courseId}:${a.type}`}
										className="rounded-md bg-status-warning/10 px-3 py-2"
									>
										<div className="font-medium text-status-warning">
											{a.studentName}
										</div>
										<div className="text-xs">{a.detail}</div>
										<div className="mt-0.5 text-xs text-text-muted">
											{a.courseTitle}
										</div>
									</div>
								))
							)}
						</CardContent>
					</Card>

					{/* 教学质量 */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<PenTool className="size-4 text-brand" />
								教学质量
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-2 text-sm">
							<QualityRow
								icon={Clock}
								label="批改及时率"
								value={`${stats.timelyRate}%`}
								good={stats.timelyRate >= 80}
							/>
							<QualityRow
								icon={TrendingUp}
								label="学生进步率"
								value={`${stats.improvementRate}%`}
								good={stats.improvementRate >= 70}
							/>
							<QualityRow
								icon={Star}
								label="平均作业分"
								value={`${stats.avgScore}`}
								good={stats.avgScore >= 75}
							/>
							<QualityRow icon={Users} label="续报率" value="—" good={false} />
						</CardContent>
					</Card>
				</div>
			</div>

			{/* 批改对话框 */}
			<Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
				<DialogContent className="sm:max-w-4xl">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<PenTool className="size-4 text-brand" />
							批改作业
						</DialogTitle>
						<DialogDescription>
							{reviewing?.studentName} · {reviewing?.assignmentTitle}
							{submissionDetail?.submission.reviewerName &&
								` · 已批改人：${submissionDetail.submission.reviewerName}`}
						</DialogDescription>
					</DialogHeader>

					{/* 版本对比 */}
					{versions.length > 1 && (
						<div className="rounded-md border border-brand/30 bg-brand/5 p-3">
							<div className="mb-2 flex items-center gap-2 text-sm font-medium">
								<GitCompare className="size-4 text-brand" />
								版本历史（共 {versions.length} 个版本）
							</div>
							<div className="flex flex-wrap gap-2">
								{versions.map((v) => (
									<button
										key={v.id}
										type="button"
										onClick={() => switchVersion(v.id)}
										className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
											selectedVersionId === v.id
												? "border-brand bg-brand text-white"
												: "border-border bg-card hover:border-brand/40"
										}`}
									>
										v{v.version}
										{v.score !== null && ` · ${v.score}分`}
										{v.id === reviewing?.id && " (当前)"}
									</button>
								))}
							</div>
						</div>
					)}

					{detailLoading ? (
						<div className="flex h-40 items-center justify-center text-text-muted">
							加载中...
						</div>
					) : (
						<>
							{/* 作品图 + 标注画布 */}
							{submissionDetail?.submission.imageUrl && (
								<div className="space-y-2">
									<div className="flex items-center justify-between">
										<span className="text-sm font-medium">
											学生作品（点击图片添加圈点标注）
										</span>
										{submissionDetail.submission.annotations.length > 0 && (
											<Badge variant="info">
												{submissionDetail.submission.annotations.length} 个标注
											</Badge>
										)}
									</div>
									<AnnotationCanvas
										imageUrl={submissionDetail.submission.imageUrl}
										annotations={submissionDetail.submission.annotations}
										annotationType={annotationType}
										onAddAnnotation={addAnnotation}
										onDeleteAnnotation={deleteAnnotation}
										annotationContent={annotationContent}
									/>
									{/* 标注工具栏 */}
									<div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface-1 p-2">
										<div className="flex items-center gap-1">
											{(["circle", "arrow", "text"] as AnnotationType[]).map(
												(t) => (
													<button
														key={t}
														type="button"
														onClick={() => setAnnotationType(t)}
														className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
															annotationType === t
																? "border-brand bg-brand text-white"
																: "border-border bg-card hover:bg-surface-2"
														}`}
													>
														{t === "circle"
															? "圆圈"
															: t === "arrow"
																? "箭头"
																: "编号"}
													</button>
												),
											)}
										</div>
										<Input
											type="text"
											placeholder="标注内容（可选，如：起笔藏锋不到位）"
											value={annotationContent}
											onChange={(e) => setAnnotationContent(e.target.value)}
											className="min-w-40 flex-1"
										/>
									</div>
									{/* 标注列表 */}
									{submissionDetail.submission.annotations.length > 0 && (
										<div className="space-y-1">
											{submissionDetail.submission.annotations.map((a, idx) => (
												<div
													key={a.id}
													className="flex items-start gap-2 rounded-md border border-border bg-surface-1 px-3 py-1.5 text-xs"
												>
													<Badge variant="info" className="shrink-0">
														{idx + 1}
													</Badge>
													<Badge variant="outline" className="shrink-0">
														{a.type === "circle"
															? "圆圈"
															: a.type === "arrow"
																? "箭头"
																: "编号"}
													</Badge>
													<span className="text-text-muted">
														({a.x.toFixed(1)}, {a.y.toFixed(1)})
													</span>
													<span className="flex-1">{a.content}</span>
													<button
														type="button"
														onClick={() => deleteAnnotation(a.id)}
														className="text-status-error hover:text-status-error/80"
														aria-label="删除标注"
													>
														<XCircle className="size-3.5" />
													</button>
												</div>
											))}
										</div>
									)}
								</div>
							)}

							{/* 学生文字说明 */}
							{submissionDetail?.submission.content && (
								<div className="rounded-md border border-border bg-surface-1 p-3 text-sm">
									<div className="mb-1 text-xs text-text-muted">学生说明</div>
									{submissionDetail.submission.content}
								</div>
							)}

							{/* 分数 + 评语 */}
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
								<div className="space-y-2 sm:col-span-1">
									<label htmlFor="review-score" className="text-sm font-medium">
										分数（0-100）
									</label>
									<Input
										id="review-score"
										type="number"
										min={0}
										max={100}
										value={reviewScore}
										onChange={(e) => setReviewScore(Number(e.target.value))}
									/>
								</div>

								<div className="space-y-2 sm:col-span-2">
									<label
										htmlFor="review-comment"
										className="text-sm font-medium"
									>
										评语
									</label>
									<textarea
										id="review-comment"
										className="min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
										placeholder="请输入评语，指出优点与改进方向..."
										value={reviewComment}
										onChange={(e) => setReviewComment(e.target.value)}
									/>
								</div>
							</div>

							{/* 音频评语 */}
							<div className="space-y-2">
								<div className="flex items-center gap-1.5 text-sm font-medium">
									<PenTool className="size-3.5" />
									音频评语（按住说话，松开自动保存）
								</div>
								<AudioRecorder
									audioUrl={audioUrl || null}
									onRecorded={handleAudioRecorded}
									onClear={() => setAudioUrl("")}
									uploading={audioUploading}
								/>
							</div>
						</>
					)}

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setReviewing(null)}
							disabled={submitting}
						>
							取消
						</Button>
						<Button
							type="submit"
							onClick={submitReview}
							disabled={
								submitting ||
								reviewScore < 0 ||
								reviewScore > 100 ||
								!selectedVersionId
							}
						>
							{submitting ? "提交中..." : "提交批改"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</PageContainer>
	);
}

function QualityRow({
	icon: Icon,
	label,
	value,
	good,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	value: string;
	good: boolean;
}) {
	return (
		<div className="flex items-center justify-between">
			<span className="flex items-center gap-2 text-text-muted">
				<Icon className="size-3.5" />
				{label}
			</span>
			<span className={`font-medium ${good ? "text-status-active" : ""}`}>
				{value}
			</span>
		</div>
	);
}

function StatBox({
	icon: Icon,
	label,
	value,
	color,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	value: string;
	color: "brand" | "info" | "success" | "warning";
}) {
	const colorMap = {
		brand: "text-brand bg-brand/10",
		info: "text-status-running bg-status-running/10",
		success: "text-status-active bg-status-active/10",
		warning: "text-status-warning bg-status-warning/10",
	};
	return (
		<div className="rounded-lg border border-border bg-card p-3">
			<div
				className={`mb-1.5 flex size-8 items-center justify-center rounded-md ${colorMap[color]}`}
			>
				<Icon className="size-4" />
			</div>
			<div className="font-serif text-lg font-semibold">{value}</div>
			<div className="text-xs text-text-muted">{label}</div>
		</div>
	);
}

function formatRelativeTime(iso: string): string {
	if (!iso) return "—";
	const diff = Date.now() - new Date(iso).getTime();
	if (diff < 0) return "刚刚";
	const minutes = Math.floor(diff / 60000);
	if (minutes < 1) return "刚刚";
	if (minutes < 60) return `${minutes} 分钟前`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours} 小时前`;
	const days = Math.floor(hours / 24);
	if (days < 30) return `${days} 天前`;
	return iso.slice(0, 10);
}
