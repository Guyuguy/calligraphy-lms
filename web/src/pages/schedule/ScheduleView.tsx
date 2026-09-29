import { AlertTriangle, Calendar, Clock, MapPin, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	api,
	type Classroom,
	type Course,
	LEVEL_LABELS,
	SCHEDULE_MODE_LABELS,
	type Schedule,
	type ScheduleConflict,
	STAGE_LABELS,
	type User,
} from "@/api/client";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

const WEEKDAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const TIME_SLOTS = [9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20];

interface ScheduleViewProps {
	user: User;
}

type ViewMode = "self" | "teacher" | "classroom";

export function ScheduleView({ user }: ScheduleViewProps) {
	const [schedules, setSchedules] = useState<Schedule[]>([]);
	const [classrooms, setClassrooms] = useState<Classroom[]>([]);
	const [courses, setCourses] = useState<Course[]>([]);
	const [loading, setLoading] = useState(true);
	const [view, setView] = useState<ViewMode>("self");
	const [selectedClassroom, setSelectedClassroom] = useState<string>("");
	const [selectedTeacher, setSelectedTeacher] = useState<string>("");
	const [createOpen, setCreateOpen] = useState(false);
	const [editTarget, setEditTarget] = useState<Schedule | null>(null);

	const isAdmin = user.role === "admin" || user.role === "academic_head";

	useEffect(() => {
		if (user.role === "student") setView("self");
		else if (user.role === "teacher") setView("self");
		else setView("classroom");
	}, [user.role]);

	const loadSchedules = useCallback(() => {
		setLoading(true);
		let url = "/schedules";
		if (
			view === "self" &&
			(user.role === "student" || user.role === "teacher")
		) {
			url += `?userId=${user.id}&role=${user.role}`;
		} else if (view === "teacher" && selectedTeacher) {
			url += `?userId=${selectedTeacher}&role=teacher`;
		} else if (view === "classroom" && selectedClassroom) {
			url += `?classroomId=${selectedClassroom}`;
		}
		api
			.get<{ schedules: Schedule[] }>(url)
			.then((r) => setSchedules(r.schedules))
			.catch(() => setSchedules([]))
			.finally(() => setLoading(false));
	}, [view, selectedTeacher, selectedClassroom, user.role, user.id]);

	useEffect(() => {
		api.get<{ classrooms: Classroom[] }>("/classrooms").then((r) => {
			setClassrooms(r.classrooms);
			if (r.classrooms[0]) setSelectedClassroom(r.classrooms[0].id);
		});
		api
			.get<{ courses: Course[] }>("/courses")
			.then((r) => setCourses(r.courses));
	}, []);

	useEffect(() => {
		loadSchedules();
	}, [loadSchedules]);

	const grid = useMemo(() => {
		const g: Record<string, Schedule[]> = {};
		for (const s of schedules) {
			const key = `${s.weekday}-${s.startHour}`;
			if (!g[key]) g[key] = [];
			g[key].push(s);
		}
		return g;
	}, [schedules]);

	// 教师列表（从 courses 里提取）
	const teacherOptions = useMemo(() => {
		const map = new Map<string, string>();
		for (const c of courses) {
			if (c.teacherId && c.teacherName) map.set(c.teacherId, c.teacherName);
		}
		return Array.from(map.entries());
	}, [courses]);

	return (
		<PageContainer
			title="排课表"
			description={
				view === "self"
					? user.role === "student"
						? "我的本周课表"
						: "我的本周教学"
					: view === "teacher"
						? "按教师查看课表"
						: "按教室查看占用"
			}
			actions={
				isAdmin && (
					<Button onClick={() => setCreateOpen(true)}>
						<Plus className="size-4" />
						新建排课
					</Button>
				)
			}
		>
			<Card>
				<CardContent className="pt-6">
					<div className="mb-4 flex flex-wrap items-center gap-3">
						{isAdmin ? (
							<>
								<Select
									value={view}
									onValueChange={(v) => setView(v as ViewMode)}
								>
									<SelectTrigger className="w-full sm:w-32">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="classroom">按教室</SelectItem>
										<SelectItem value="teacher">按教师</SelectItem>
									</SelectContent>
								</Select>
								{view === "classroom" && (
									<Select
										value={selectedClassroom}
										onValueChange={setSelectedClassroom}
									>
										<SelectTrigger className="w-full sm:w-48">
											<SelectValue placeholder="选择教室" />
										</SelectTrigger>
										<SelectContent>
											{classrooms.map((r) => (
												<SelectItem key={r.id} value={r.id}>
													{r.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
								{view === "teacher" && (
									<Select
										value={selectedTeacher}
										onValueChange={setSelectedTeacher}
									>
										<SelectTrigger className="w-full sm:w-48">
											<SelectValue placeholder="选择教师" />
										</SelectTrigger>
										<SelectContent>
											{teacherOptions.map(([id, name]) => (
												<SelectItem key={id} value={id}>
													{name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
							</>
						) : (
							<Badge variant="info">
								{user.role === "student" ? "我的课表" : "我的教学"}
							</Badge>
						)}
						<div className="ml-auto text-sm text-text-muted">
							共 {schedules.length} 节课
						</div>
					</div>

					{loading ? (
						<div className="py-12 text-center text-sm text-text-muted">
							加载中...
						</div>
					) : schedules.length === 0 ? (
						<div className="py-12 text-center text-sm text-text-muted">
							本周暂无课程安排
						</div>
					) : (
						<>
							{/* 平板/桌面：网格视图 */}
							<div className="hidden overflow-x-auto md:block">
								<div className="grid min-w-[800px] grid-cols-[60px_repeat(7,1fr)] gap-1">
									<div className="text-center text-xs text-text-muted" />
									{WEEKDAYS.map((d) => (
										<div key={d} className="text-center text-sm font-medium">
											{d}
										</div>
									))}
									{TIME_SLOTS.map((hour) => (
										<div key={hour} className="contents">
											<div className="flex items-center justify-center text-xs text-text-muted">
												{String(hour).padStart(2, "0")}:00
											</div>
											{WEEKDAYS.map((_, di) => {
												const weekday = di + 1;
												const key = `${weekday}-${hour}`;
												const items = grid[key] ?? [];
												return (
													<div
														key={key}
														className="min-h-16 rounded-md border border-border bg-surface-1 p-1"
													>
														{items.map((s) => (
															<ScheduleBlock
																key={s.id}
																schedule={s}
																onClick={() => isAdmin && setEditTarget(s)}
															/>
														))}
													</div>
												);
											})}
										</div>
									))}
								</div>
							</div>

							{/* 手机：按天分组列表 */}
							<div className="space-y-4 md:hidden">
								{WEEKDAYS.map((d, di) => {
									const weekday = di + 1;
									const dayItems = schedules.filter(
										(s) => s.weekday === weekday,
									);
									if (dayItems.length === 0) return null;
									return (
										<div
											key={d}
											className="rounded-md border border-border bg-surface-1"
										>
											<div className="border-b border-border px-3 py-2 text-sm font-medium">
												{d}
											</div>
											<div className="space-y-1 p-2">
												{dayItems
													.sort((a, b) => a.startHour - b.startHour)
													.map((s) => (
														<ScheduleBlock
															key={s.id}
															schedule={s}
															onClick={() => isAdmin && setEditTarget(s)}
														/>
													))}
											</div>
										</div>
									);
								})}
							</div>
						</>
					)}

					<div className="mt-4 flex items-center gap-4 text-xs text-text-muted">
						<span className="flex items-center gap-1">
							<Calendar className="size-3" />
							{isAdmin ? "点击课程块可调课" : "点击课程块查看详情"}
						</span>
					</div>
				</CardContent>
			</Card>

			{createOpen && (
				<ScheduleDialog
					mode="create"
					courses={courses}
					classrooms={classrooms}
					onClose={() => setCreateOpen(false)}
					onSuccess={() => {
						setCreateOpen(false);
						loadSchedules();
					}}
				/>
			)}

			{editTarget && (
				<ScheduleDialog
					mode="edit"
					schedule={editTarget}
					courses={courses}
					classrooms={classrooms}
					onClose={() => setEditTarget(null)}
					onSuccess={() => {
						setEditTarget(null);
						loadSchedules();
					}}
				/>
			)}
		</PageContainer>
	);
}

function ScheduleBlock({
	schedule,
	onClick,
}: {
	schedule: Schedule;
	onClick?: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="mb-1 w-full rounded bg-brand/10 p-1.5 text-left transition-colors hover:bg-brand/20"
		>
			<div className="line-clamp-1 text-xs font-medium text-brand">
				{schedule.courseTitle}
			</div>
			<div className="mt-0.5 flex items-center gap-1 text-[10px] text-text-muted">
				<Clock className="size-2.5" />
				{String(schedule.startHour).padStart(2, "0")}-
				{String(schedule.endHour).padStart(2, "0")}
			</div>
			<div className="text-[10px] text-text-muted">{schedule.teacherName}</div>
			<div className="flex items-center gap-1 text-[10px] text-text-muted">
				<MapPin className="size-2.5" />
				{schedule.classroomName}
			</div>
		</button>
	);
}

interface ScheduleDialogProps {
	mode: "create" | "edit";
	schedule?: Schedule;
	courses: Course[];
	classrooms: Classroom[];
	onClose: () => void;
	onSuccess: () => void;
}

function ScheduleDialog({
	mode,
	schedule,
	courses,
	classrooms,
	onClose,
	onSuccess,
}: ScheduleDialogProps) {
	const [courseId, setCourseId] = useState(schedule?.courseId ?? "");
	const [classroomId, setClassroomId] = useState(
		schedule?.classroomId ?? classrooms[0]?.id ?? "",
	);
	const [weekday, setWeekday] = useState(String(schedule?.weekday ?? 1));
	const [startHour, setStartHour] = useState(String(schedule?.startHour ?? 9));
	const [endHour, setEndHour] = useState(String(schedule?.endHour ?? 11));
	const [scheduleMode, setScheduleMode] = useState<Schedule["mode"]>(
		schedule?.mode ?? "fixed_class",
	);
	const [conflicts, setConflicts] = useState<ScheduleConflict[]>([]);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");

	const selectedCourse = courses.find((c) => c.id === courseId);

	const checkConflicts = async () => {
		if (!selectedCourse || !classroomId) return;
		try {
			const res = await api.post<{
				conflicts: ScheduleConflict[];
				ok: boolean;
			}>("/schedules/check", {
				courseId,
				teacherId: selectedCourse.teacherId,
				classroomId,
				weekday: Number(weekday),
				startHour: Number(startHour),
				endHour: Number(endHour),
				studentIds: schedule?.studentIds ?? [],
			});
			setConflicts(res.conflicts);
		} catch {}
	};

	useEffect(() => {
		if (courseId && classroomId) checkConflicts();
		// biome-ignore lint/correctness/useExhaustiveDependencies: checkConflicts is stable enough
	}, [courseId, classroomId, checkConflicts]);

	const submit = async () => {
		if (!selectedCourse || !classroomId) {
			setError("请选择课程和教室");
			return;
		}
		setSubmitting(true);
		setError("");
		try {
			const body = {
				courseId,
				teacherId: selectedCourse.teacherId,
				classroomId,
				weekday: Number(weekday),
				startHour: Number(startHour),
				endHour: Number(endHour),
				mode: scheduleMode,
				studentIds: schedule?.studentIds ?? [],
				force: conflicts.length === 0 ? undefined : true,
			};
			if (mode === "create") {
				await api.post("/schedules", body);
			} else if (schedule) {
				await api.put(`/schedules/${schedule.id}`, body);
			}
			onSuccess();
		} catch (err) {
			setError(err instanceof Error ? err.message : "保存失败");
		} finally {
			setSubmitting(false);
		}
	};

	const del = async () => {
		if (!schedule) return;
		if (!confirm("确定删除此排课？")) return;
		setSubmitting(true);
		try {
			await api.del(`/schedules/${schedule.id}`);
			onSuccess();
		} catch (err) {
			setError(err instanceof Error ? err.message : "删除失败");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Dialog open onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{mode === "create" ? "新建排课" : "调课"}</DialogTitle>
					<DialogDescription>
						{mode === "create"
							? "为课程安排上课时间与教室"
							: "修改上课时间或教室，系统会自动检测冲突"}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-1.5">
						<Label>课程</Label>
						<Select value={courseId} onValueChange={setCourseId}>
							<SelectTrigger>
								<SelectValue placeholder="选择课程" />
							</SelectTrigger>
							<SelectContent>
								{courses.map((c) => (
									<SelectItem key={c.id} value={c.id}>
										{c.title}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{selectedCourse && (
							<div className="text-xs text-text-muted">
								主讲：{selectedCourse.teacherName} ·{" "}
								{STAGE_LABELS[selectedCourse.stage]} ·{" "}
								{LEVEL_LABELS[selectedCourse.level]}
							</div>
						)}
					</div>

					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<div className="space-y-1.5">
							<Label>星期</Label>
							<Select value={weekday} onValueChange={setWeekday}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{WEEKDAYS.map((d, i) => (
										<SelectItem key={d} value={String(i + 1)}>
											{d}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-1.5">
							<Label>上课模式</Label>
							<Select
								value={scheduleMode}
								onValueChange={(v) => setScheduleMode(v as Schedule["mode"])}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{Object.entries(SCHEDULE_MODE_LABELS).map(([k, v]) => (
										<SelectItem key={k} value={k}>
											{v}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>

					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<div className="space-y-1.5">
							<Label>开始时间</Label>
							<Select value={startHour} onValueChange={setStartHour}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{TIME_SLOTS.map((h) => (
										<SelectItem key={h} value={String(h)}>
											{String(h).padStart(2, "0")}:00
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-1.5">
							<Label>结束时间</Label>
							<Select value={endHour} onValueChange={setEndHour}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{TIME_SLOTS.concat([21]).map((h) => (
										<SelectItem key={h} value={String(h)}>
											{String(h).padStart(2, "0")}:00
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>

					<div className="space-y-1.5">
						<Label>教室</Label>
						<Select value={classroomId} onValueChange={setClassroomId}>
							<SelectTrigger>
								<SelectValue placeholder="选择教室" />
							</SelectTrigger>
							<SelectContent>
								{classrooms.map((r) => (
									<SelectItem key={r.id} value={r.id}>
										{r.name}（{r.location}，容量 {r.capacity}）
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{conflicts.length > 0 && (
						<div className="rounded-md border border-status-warning/30 bg-status-warning/10 p-3">
							<div className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-status-warning">
								<AlertTriangle className="size-4" />
								检测到 {conflicts.length} 个冲突
							</div>
							<ul className="space-y-1 text-xs text-status-warning">
								{conflicts.map((c) => (
									<li key={c.message}>• {c.message}</li>
								))}
							</ul>
							<div className="mt-2 text-xs text-text-muted">
								仍要保存请点击下方"强制保存"
							</div>
						</div>
					)}

					{error && (
						<div className="rounded-md bg-status-error/10 px-3 py-2 text-sm text-status-error">
							{error}
						</div>
					)}
				</div>

				<DialogFooter className="gap-2">
					{mode === "edit" && (
						<Button
							variant="destructive"
							onClick={del}
							disabled={submitting}
							className="mr-auto"
						>
							删除
						</Button>
					)}
					<Button variant="outline" onClick={onClose} disabled={submitting}>
						取消
					</Button>
					<Button onClick={submit} disabled={submitting}>
						{submitting
							? "保存中..."
							: conflicts.length > 0
								? "强制保存"
								: "保存"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
