import {
	ArrowLeft,
	Award,
	Clock,
	Flame,
	GraduationCap,
	Mail,
	Phone,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
	api,
	type Course,
	LEVEL_LABELS,
	STAGE_LABELS,
	STYLE_LABELS,
	type StudentProfile,
	type User,
} from "@/api/client";
import { SkillRadarChart } from "@/components/domain/SkillRadar";
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
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface StudentDetailProps {
	id: string;
	user: User;
	navigate: (p: string) => void;
}

export function StudentDetail({ id, navigate }: StudentDetailProps) {
	const [student, setStudent] = useState<User | null>(null);
	const [profile, setProfile] = useState<StudentProfile | null>(null);
	const [courses, setCourses] = useState<Course[]>([]);

	useEffect(() => {
		api
			.get<{ user: User; profile: StudentProfile | null }>(`/users/${id}`)
			.then((r) => {
				setStudent(r.user);
				setProfile(r.profile);
			});
		api
			.get<{ courses: Course[] }>("/courses")
			.then((r) => setCourses(r.courses));
	}, [id]);

	if (!student || !profile) {
		return (
			<PageContainer title="加载中...">
				<div className="text-text-muted">正在获取学生信息...</div>
			</PageContainer>
		);
	}

	return (
		<PageContainer
			title={student.name}
			description={`@${student.username} · ${STAGE_LABELS[profile.currentStage]} · ${LEVEL_LABELS[profile.currentLevel]}`}
			actions={
				<Button variant="outline" onClick={() => navigate("/students")}>
					<ArrowLeft className="size-4" />
					返回列表
				</Button>
			}
		>
			<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
				{/* 左侧：基本信息 + 技能雷达 */}
				<div className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>基本信息</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							<InfoRow
								icon={GraduationCap}
								label="年级"
								value={profile.grade}
							/>
							<InfoRow icon={Mail} label="学校" value={profile.school} />
							<InfoRow
								icon={Phone}
								label="联系方式"
								value={student.phone || "-"}
							/>
							<InfoRow icon={Mail} label="邮箱" value={student.email || "-"} />
							<InfoRow
								icon={Award}
								label="学习目标"
								value={goalLabel(profile.learningGoal)}
							/>
							<InfoRow
								icon={Clock}
								label="惯用手"
								value={profile.handedness === "left" ? "左手" : "右手"}
							/>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>技能画像</CardTitle>
							<CardDescription>五维能力评估</CardDescription>
						</CardHeader>
						<CardContent className="flex justify-center">
							<SkillRadarChart radar={profile.skillRadar} size={260} />
						</CardContent>
					</Card>
				</div>

				{/* 右侧：学习数据 + 课程 + 作品 */}
				<div className="space-y-6 lg:col-span-2">
					<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
						<StatBox
							icon={Clock}
							label="累计练习"
							value={`${Math.round(profile.totalPracticeMinutes / 60)}h`}
							color="brand"
						/>
						<StatBox
							icon={Flame}
							label="连续打卡"
							value={`${profile.streakDays} 天`}
							color="warning"
						/>
						<StatBox
							icon={Award}
							label="完成单元"
							value="23 / 48"
							color="success"
						/>
						<StatBox
							icon={GraduationCap}
							label="已选课程"
							value="4 门"
							color="info"
						/>
					</div>

					<Card>
						<CardHeader>
							<CardTitle>偏好书体</CardTitle>
						</CardHeader>
						<CardContent className="flex flex-wrap gap-2">
							{profile.preferredStyles.map((s) => (
								<Badge key={s} variant="default">
									{STYLE_LABELS[s]}
								</Badge>
							))}
						</CardContent>
					</Card>

					<Tabs defaultValue="courses">
						<TabsList>
							<TabsTrigger value="courses">在学课程</TabsTrigger>
							<TabsTrigger value="artworks">作品集</TabsTrigger>
							<TabsTrigger value="history">学习历史</TabsTrigger>
						</TabsList>
						<TabsContent value="courses" className="space-y-3">
							{courses.slice(0, 4).map((c) => (
								<div
									key={c.id}
									className="flex items-center gap-3 rounded-md border border-border bg-surface-1 p-3"
								>
									<img
										src={c.cover}
										alt=""
										className="size-12 rounded-md object-cover"
									/>
									<div className="flex-1">
										<div className="font-medium">{c.title}</div>
										<div className="mt-0.5 text-xs text-text-muted">
											{STAGE_LABELS[c.stage]} · {LEVEL_LABELS[c.level]}
										</div>
									</div>
									<div className="w-32">
										<Progress value={Math.random() * 100} color="brand" />
									</div>
								</div>
							))}
						</TabsContent>
						<TabsContent
							value="artworks"
							className="grid grid-cols-2 gap-3 sm:grid-cols-3"
						>
							{[1, 2, 3, 4, 5, 6].map((i) => (
								<div
									key={i}
									className="aspect-[3/4] overflow-hidden rounded-md border border-border bg-surface-2"
								>
									<img
										src={`https://placehold.co/300x400/efeee9/c96442?text=作品+${i}`}
										alt=""
										className="size-full object-cover"
									/>
								</div>
							))}
						</TabsContent>
						<TabsContent value="history" className="space-y-2">
							{[
								{
									date: "2026-09-27",
									action: "完成《永字八法》第 4 节",
									minutes: 45,
								},
								{
									date: "2026-09-26",
									action: "提交作业 — 横画练习",
									minutes: 30,
								},
								{
									date: "2026-09-25",
									action: "观看视频 — 竖画示范",
									minutes: 25,
								},
								{
									date: "2026-09-24",
									action: "完成《永字八法》第 3 节",
									minutes: 50,
								},
							].map((h) => (
								<div
									key={`${h.date}-${h.action}`}
									className="flex items-center justify-between rounded-md border border-border bg-surface-1 px-3 py-2 text-sm"
								>
									<span>{h.action}</span>
									<span className="text-text-muted">
										{h.date} · {h.minutes} 分钟
									</span>
								</div>
							))}
						</TabsContent>
					</Tabs>
				</div>
			</div>
		</PageContainer>
	);
}

function InfoRow({
	icon: Icon,
	label,
	value,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	value: string;
}) {
	return (
		<div className="flex items-center gap-3">
			<Icon className="size-4 text-text-muted" />
			<span className="w-20 text-sm text-text-muted">{label}</span>
			<span className="flex-1 text-sm">{value}</span>
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

function goalLabel(g: StudentProfile["learningGoal"]): string {
	return {
		interest: "兴趣培养",
		grade_exam: "考级",
		competition: "比赛",
		daily_writing: "日常书写",
	}[g];
}
