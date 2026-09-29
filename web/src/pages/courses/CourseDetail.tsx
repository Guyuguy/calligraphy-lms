import {
	ArrowLeft,
	BookOpen,
	CheckCircle2,
	FileText,
	HelpCircle,
	Pencil,
	PenTool,
	PlayCircle,
	Star,
	Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
	api,
	type Course,
	LEVEL_LABELS,
	STAGE_LABELS,
	STYLE_LABELS,
	type TeacherProfile,
	type User,
} from "@/api/client";
import { CourseEditor } from "@/components/domain/CourseEditor";
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
import { Separator } from "@/components/ui/separator";

interface CourseDetailProps {
	id: string;
	user: User;
	navigate: (p: string) => void;
}

const UNIT_TYPE_ICONS: Record<
	string,
	React.ComponentType<{ className?: string }>
> = {
	video: PlayCircle,
	live: PlayCircle,
	stroke_lesson: PenTool,
	reference_char: BookOpen,
	tracing_exercise: PenTool,
	assignment: FileText,
	quiz: HelpCircle,
};

const UNIT_TYPE_LABELS: Record<string, string> = {
	video: "视频课",
	live: "直播课",
	stroke_lesson: "笔画讲解",
	reference_char: "范字",
	tracing_exercise: "临摹练习",
	assignment: "作业",
	quiz: "测验",
};

export function CourseDetail({ id, user, navigate }: CourseDetailProps) {
	const [course, setCourse] = useState<Course | null>(null);
	const [teacher, setTeacher] = useState<{
		id: string;
		name: string;
		email: string;
	} | null>(null);
	const [teacherProfile, setTeacherProfile] = useState<TeacherProfile | null>(
		null,
	);
	const [editorOpen, setEditorOpen] = useState(false);

	const canManage =
		user.role === "admin" ||
		user.role === "academic_head" ||
		user.role === "teacher";

	const loadCourse = () => {
		api
			.get<{
				course: Course;
				teacher: { id: string; name: string; email: string } | null;
				teacherProfile: TeacherProfile | null;
			}>(`/courses/${id}`)
			.then((r) => {
				setCourse(r.course);
				setTeacher(r.teacher);
				setTeacherProfile(r.teacherProfile);
			});
	};

	useEffect(() => {
		loadCourse();
	}, [id]);

	if (!course) {
		return (
			<PageContainer title="加载中...">
				<div className="text-text-muted">正在获取课程信息...</div>
			</PageContainer>
		);
	}

	const totalUnits = course.modules.reduce((sum, m) => sum + m.units.length, 0);

	return (
		<PageContainer
			title={course.title}
			description={course.audience}
			actions={
				<div className="flex gap-2">
					<Button variant="outline" onClick={() => navigate("/courses")}>
						<ArrowLeft className="size-4" />
						返回列表
					</Button>
					{canManage && (
						<Button onClick={() => setEditorOpen(true)}>
							<Pencil className="size-4" />
							编辑课程
						</Button>
					)}
				</div>
			}
		>
			<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
				{/* 左侧：课程信息 + 大纲 */}
				<div className="space-y-6 lg:col-span-2">
					<Card>
						<div className="relative aspect-[16/9] overflow-hidden rounded-t-xl bg-surface-2">
							<img
								src={course.cover}
								alt=""
								className="size-full object-cover"
							/>
							<div className="absolute left-4 top-4 flex gap-2">
								<Badge variant="default">{STAGE_LABELS[course.stage]}</Badge>
								<Badge variant="secondary">{LEVEL_LABELS[course.level]}</Badge>
								<Badge variant="outline">{STYLE_LABELS[course.style]}</Badge>
							</div>
						</div>
						<CardContent className="pt-6">
							<p className="text-sm text-text-secondary">{course.intro}</p>
							<div className="mt-4 grid grid-cols-3 gap-4 border-t border-border pt-4 text-sm">
								<Stat
									icon={BookOpen}
									label="总课时"
									value={`${totalUnits} 节`}
								/>
								<Stat
									icon={Users}
									label="已报名"
									value={`${course.enrolledCount} 人`}
								/>
								<Stat
									icon={Star}
									label="评分"
									value={course.rating.toFixed(1)}
								/>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>课程大纲</CardTitle>
							<CardDescription>
								共 {course.modules.length} 章 · {totalUnits} 节课
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{course.modules.map((m) => (
								<div
									key={m.id}
									className="rounded-lg border border-border bg-surface-1"
								>
									<div className="border-b border-border px-4 py-3">
										<div className="flex items-center gap-2">
											<div className="flex size-7 items-center justify-center rounded-md bg-brand/10 font-serif text-sm font-semibold text-brand">
												{m.order + 1}
											</div>
											<div>
												<div className="font-medium">{m.title}</div>
												<div className="text-xs text-text-muted">
													{m.description}
												</div>
											</div>
										</div>
									</div>
									<div className="divide-y divide-border">
										{m.units.map((u) => {
											const Icon = UNIT_TYPE_ICONS[u.type] ?? BookOpen;
											const isVideo = u.type === "video" && u.videoUrl;
											const clickable = isVideo;
											return (
												<div
													key={u.id}
													className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
														clickable
															? "cursor-pointer hover:bg-surface-2"
															: ""
													}`}
													onClick={() =>
														clickable &&
														navigate(`/learn/${course.id}/${u.id}`)
													}
													onKeyDown={(e) => {
														if (clickable && (e.key === "Enter" || e.key === " ")) {
															e.preventDefault();
															navigate(`/learn/${course.id}/${u.id}`);
														}
													}}
													role={clickable ? "button" : undefined}
													tabIndex={clickable ? 0 : undefined}
												>
													<Icon
														className={`size-4 ${
															isVideo ? "text-brand" : "text-text-muted"
														}`}
													/>
													<div className="flex-1">
														<div className="text-sm">{u.title}</div>
														<div className="text-xs text-text-muted">
															{UNIT_TYPE_LABELS[u.type]} · {u.durationMinutes}{" "}
															分钟
															{u.type === "video" &&
																!u.videoUrl &&
																(canManage ? " · 未上传视频" : "")}
														</div>
													</div>
													{isVideo && (
														<Badge variant="info" className="shrink-0">
															<PlayCircle className="size-3" />
															观看
														</Badge>
													)}
													{user.role === "student" && (
														<CheckCircle2 className="size-4 text-text-muted opacity-0" />
													)}
												</div>
											);
										})}
									</div>
								</div>
							))}
						</CardContent>
					</Card>
				</div>

				{/* 右侧：教师信息 + 选课 */}
				<div className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>主讲教师</CardTitle>
						</CardHeader>
						<CardContent>
							{teacher && (
								<button
									type="button"
									onClick={() => navigate(`/teachers/${teacher.id}`)}
									className="flex w-full items-center gap-3 rounded-md border border-border bg-surface-1 p-3 text-left transition-colors hover:bg-surface-2"
								>
									<div className="flex size-12 items-center justify-center rounded-full bg-brand/10 font-serif text-lg font-semibold text-brand">
										{teacher.name.charAt(0)}
									</div>
									<div className="flex-1">
										<div className="font-medium">{teacher.name}</div>
										<div className="mt-0.5 flex items-center gap-1 text-xs text-status-warning">
											<Star className="size-3 fill-current" />
											{teacherProfile?.rating.toFixed(1) ?? "-"} ·{" "}
											{teacherProfile?.teachingYears ?? 0} 年教龄
										</div>
									</div>
								</button>
							)}
							{teacherProfile && (
								<>
									<Separator className="my-3" />
									<p className="text-sm text-text-secondary">
										{teacherProfile.bio}
									</p>
								</>
							)}
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>课程信息</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3 text-sm">
							<Row label="书体" value={STAGE_LABELS[course.stage]} />
							<Row label="难度" value={LEVEL_LABELS[course.level]} />
							<Row label="风格" value={STYLE_LABELS[course.style]} />
							<Row label="总课时" value={`${totalUnits} 节`} />
							<Row label="价格" value={`¥ ${course.price}`} />
							<Separator />
							<div>
								<div className="mb-1 text-text-muted">前置课程</div>
								{course.prerequisites.length === 0 ? (
									<div className="text-sm">无前置要求</div>
								) : (
									course.prerequisites.map((pid) => (
										<Badge key={pid} variant="outline" className="mr-1">
											{pid}
										</Badge>
									))
								)}
							</div>
						</CardContent>
					</Card>

					{user.role === "student" && (
						<Button
							className="w-full"
							size="lg"
							onClick={() => {
								api
									.post(`/courses/${course.id}/enroll`)
									.then(() => alert("选课成功！"));
							}}
						>
							立即选课
						</Button>
					)}
				</div>
			</div>

			{canManage && (
				<CourseEditor
					open={editorOpen}
					onOpenChange={setEditorOpen}
					user={user}
					existing={course}
					onSaved={() => {
						setEditorOpen(false);
						loadCourse();
					}}
				/>
			)}
		</PageContainer>
	);
}

function Stat({
	icon: Icon,
	label,
	value,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	value: string;
}) {
	return (
		<div className="flex items-center gap-2">
			<Icon className="size-4 text-text-muted" />
			<span className="text-text-muted">{label}:</span>
			<span className="font-medium">{value}</span>
		</div>
	);
}

function Row({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-center justify-between">
			<span className="text-text-muted">{label}</span>
			<span className="font-medium">{value}</span>
		</div>
	);
}
