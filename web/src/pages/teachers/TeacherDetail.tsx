import {
	ArrowLeft,
	Award,
	BookOpen,
	Calendar,
	Clock,
	Star,
	Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
	api,
	type Course,
	STAGE_LABELS,
	type TeacherProfile,
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

interface TeacherDetailProps {
	id: string;
	user: User;
	navigate: (p: string) => void;
}

const WEEKDAY_LABELS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export function TeacherDetail({ id, navigate }: TeacherDetailProps) {
	const [teacher, setTeacher] = useState<User | null>(null);
	const [profile, setProfile] = useState<TeacherProfile | null>(null);
	const [courses, setCourses] = useState<Course[]>([]);

	useEffect(() => {
		api
			.get<{ user: User; profile: TeacherProfile | null }>(`/users/${id}`)
			.then((r) => {
				setTeacher(r.user);
				setProfile(r.profile);
			});
		api
			.get<{ courses: Course[] }>(`/courses?teacherId=${id}`)
			.then((r) => setCourses(r.courses));
	}, [id]);

	if (!teacher || !profile) {
		return (
			<PageContainer title="加载中...">
				<div className="text-text-muted">正在获取教师信息...</div>
			</PageContainer>
		);
	}

	return (
		<PageContainer
			title={teacher.name}
			description={profile.qualifications}
			actions={
				<Button variant="outline" onClick={() => navigate("/teachers")}>
					<ArrowLeft className="size-4" />
					返回列表
				</Button>
			}
		>
			<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
				{/* 左侧：基本信息 */}
				<div className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>教师档案</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex items-center gap-3">
								<div className="flex size-16 items-center justify-center rounded-full bg-brand/10 font-serif text-2xl font-semibold text-brand">
									{teacher.name.charAt(0)}
								</div>
								<div>
									<div className="font-medium">{teacher.name}</div>
									<div className="mt-1 flex items-center gap-1 text-sm text-status-warning">
										<Star className="size-4 fill-current" />
										{profile.rating.toFixed(1)} 评分
									</div>
								</div>
							</div>
							<div className="space-y-2 text-sm">
								<Row label="教龄" value={`${profile.teachingYears} 年`} />
								<Row
									label="擅长书体"
									value={profile.stages.map((s) => STAGE_LABELS[s]).join("、")}
								/>
								<Row label="学生人数" value={`${profile.studentCount} 人`} />
								<Row
									label="周课时"
									value={`${profile.workloadHoursPerWeek} 小时`}
								/>
							</div>
							<div>
								<div className="mb-1 text-sm text-text-muted">个人简介</div>
								<p className="text-sm">{profile.bio}</p>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Calendar className="size-4 text-brand" />
								可授课时段
							</CardTitle>
							<CardDescription>教师维护的空闲时间</CardDescription>
						</CardHeader>
						<CardContent className="space-y-2">
							{profile.availability.length === 0 ? (
								<div className="text-sm text-text-muted">暂未设置</div>
							) : (
								profile.availability.map((slot) => (
									<div
										key={`${slot.weekday}-${slot.startHour}-${slot.endHour}`}
										className="flex items-center justify-between rounded-md border border-border bg-surface-1 px-3 py-2 text-sm"
									>
										<span>{WEEKDAY_LABELS[slot.weekday]}</span>
										<Badge variant="secondary">
											{String(slot.startHour).padStart(2, "0")}:00 -{" "}
											{String(slot.endHour).padStart(2, "0")}:00
										</Badge>
									</div>
								))
							)}
						</CardContent>
					</Card>
				</div>

				{/* 右侧：主讲课程 + 教学统计 */}
				<div className="space-y-6 lg:col-span-2">
					<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
						<StatBox
							icon={BookOpen}
							label="主讲课程"
							value={`${courses.length} 门`}
							color="brand"
						/>
						<StatBox
							icon={Users}
							label="学生总数"
							value={`${profile.studentCount} 人`}
							color="info"
						/>
						<StatBox
							icon={Clock}
							label="本周课时"
							value={`${profile.workloadHoursPerWeek}h`}
							color="success"
						/>
						<StatBox
							icon={Award}
							label="教师评分"
							value={profile.rating.toFixed(1)}
							color="warning"
						/>
					</div>

					<Card>
						<CardHeader>
							<CardTitle>主讲课程</CardTitle>
							<CardDescription>该教师负责的所有课程</CardDescription>
						</CardHeader>
						<CardContent className="space-y-3">
							{courses.length === 0 ? (
								<div className="py-8 text-center text-sm text-text-muted">
									暂无主讲课程
								</div>
							) : (
								courses.map((c) => (
									<div
										key={c.id}
										className="flex items-center gap-3 rounded-md border border-border bg-surface-1 p-3 transition-colors hover:bg-surface-2"
									>
										<img
											src={c.cover}
											alt=""
											className="size-14 rounded-md object-cover"
										/>
										<div className="flex-1">
											<div className="font-medium">{c.title}</div>
											<div className="mt-0.5 text-xs text-text-muted">
												{STAGE_LABELS[c.stage]} · {c.totalUnits} 节 ·{" "}
												{c.enrolledCount} 人
											</div>
										</div>
										<Button
											variant="outline"
											size="sm"
											onClick={() => navigate(`/courses/${c.id}`)}
										>
											查看
										</Button>
									</div>
								))
							)}
						</CardContent>
					</Card>
				</div>
			</div>
		</PageContainer>
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
		<div className="rounded-lg border border-border bg-card p-4">
			<div
				className={`mb-2 flex size-9 items-center justify-center rounded-md ${colorMap[color]}`}
			>
				<Icon className="size-5" />
			</div>
			<div className="font-serif text-xl font-semibold">{value}</div>
			<div className="text-xs text-text-muted">{label}</div>
		</div>
	);
}
