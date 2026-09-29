import { GraduationCap, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
	api,
	LEVEL_LABELS,
	STAGE_LABELS,
	type StudentProfile,
	type User,
} from "@/api/client";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

interface StudentListProps {
	user: User;
	navigate: (p: string) => void;
}

interface StudentRow {
	user: User;
	profile: StudentProfile | null;
}

export function StudentList({ user, navigate }: StudentListProps) {
	const [rows, setRows] = useState<StudentRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [stageFilter, setStageFilter] = useState<string>("all");

	useEffect(() => {
		api
			.get<{ users: User[] }>("/users?role=student")
			.then(async (r) => {
				const students = r.users;
				const profiles = await Promise.all(
					students.map((s) =>
						api.get<{ profile: StudentProfile | null }>(`/users/${s.id}`),
					),
				);
				const merged: StudentRow[] = students.map((u, i) => ({
					user: u,
					profile: profiles[i].profile,
				}));
				setRows(merged);
			})
			.finally(() => setLoading(false));
	}, []);

	const filtered = useMemo(() => {
		let list = rows;
		if (search) {
			const q = search.toLowerCase();
			list = list.filter(
				(r) =>
					r.user.name.toLowerCase().includes(q) ||
					r.user.username.toLowerCase().includes(q),
			);
		}
		if (stageFilter !== "all")
			list = list.filter((r) => r.profile?.currentStage === stageFilter);
		return list;
	}, [rows, search, stageFilter]);

	return (
		<PageContainer
			title="学生管理"
			description={`共 ${rows.length} 名学生`}
			actions={
				(user.role === "admin" || user.role === "academic_head") && (
					<Button>
						<Plus className="size-4" />
						新增学生
					</Button>
				)
			}
		>
			<Card>
				<CardContent className="pt-6">
					<div className="mb-4 flex items-center gap-3">
						<div className="relative flex-1">
							<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
							<Input
								placeholder="搜索姓名或用户名..."
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								className="pl-9"
							/>
						</div>
						<Select value={stageFilter} onValueChange={setStageFilter}>
							<SelectTrigger className="w-40">
								<SelectValue placeholder="书体筛选" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">全部书体</SelectItem>
								<SelectItem value="kaishu">楷书</SelectItem>
								<SelectItem value="xingshu">行书</SelectItem>
								<SelectItem value="lishu">隶书</SelectItem>
								<SelectItem value="kuaiXie">快写</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{loading ? (
						<div className="py-12 text-center text-sm text-text-muted">
							加载中...
						</div>
					) : filtered.length === 0 ? (
						<div className="py-12 text-center text-sm text-text-muted">
							暂无学生
						</div>
					) : (
						<>
							{/* 平板/桌面：表格 */}
							<div className="hidden md:block">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>姓名</TableHead>
											<TableHead>年级</TableHead>
											<TableHead>学校</TableHead>
											<TableHead>当前阶段</TableHead>
											<TableHead>水平</TableHead>
											<TableHead>学习目标</TableHead>
											<TableHead>累计练习</TableHead>
											<TableHead>连续打卡</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{filtered.map((row) => (
											<TableRow
												key={row.user.id}
												className="cursor-pointer"
												onClick={() => navigate(`/students/${row.user.id}`)}
											>
												<TableCell>
													<div className="flex items-center gap-2">
														<div className="flex size-8 items-center justify-center rounded-full bg-brand/10 text-brand">
															<GraduationCap className="size-4" />
														</div>
														<div>
															<div className="font-medium">{row.user.name}</div>
															<div className="text-xs text-text-muted">
																@{row.user.username}
															</div>
														</div>
													</div>
												</TableCell>
												<TableCell>{row.profile?.grade ?? "-"}</TableCell>
												<TableCell className="text-text-secondary">
													{row.profile?.school ?? "-"}
												</TableCell>
												<TableCell>
													<Badge variant="secondary">
														{row.profile
															? STAGE_LABELS[row.profile.currentStage]
															: "-"}
													</Badge>
												</TableCell>
												<TableCell>
													{row.profile
														? LEVEL_LABELS[row.profile.currentLevel]
														: "-"}
												</TableCell>
												<TableCell className="text-text-secondary">
													{row.profile
														? goalLabel(row.profile.learningGoal)
														: "-"}
												</TableCell>
												<TableCell className="text-text-secondary">
													{row.profile
														? `${Math.round(row.profile.totalPracticeMinutes / 60)} 小时`
														: "-"}
												</TableCell>
												<TableCell>
													{row.profile && row.profile.streakDays > 0 ? (
														<Badge variant="success">
															{row.profile.streakDays} 天
														</Badge>
													) : (
														<span className="text-text-muted">-</span>
													)}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>

							{/* 手机：卡片列表 */}
							<div className="space-y-2 md:hidden">
								{filtered.map((row) => (
									<button
										key={row.user.id}
										type="button"
										onClick={() => navigate(`/students/${row.user.id}`)}
										className="flex w-full items-start gap-3 rounded-md border border-border bg-surface-1 p-3 text-left transition-colors hover:bg-surface-2"
									>
										<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
											<GraduationCap className="size-5" />
										</div>
										<div className="min-w-0 flex-1">
											<div className="flex items-center justify-between gap-2">
												<div className="truncate font-medium">
													{row.user.name}
												</div>
												{row.profile && row.profile.streakDays > 0 && (
													<Badge variant="success" className="shrink-0">
														{row.profile.streakDays} 天
													</Badge>
												)}
											</div>
											<div className="text-xs text-text-muted">
												@{row.user.username}
											</div>
											<div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
												{row.profile && (
													<Badge variant="secondary">
														{STAGE_LABELS[row.profile.currentStage]} ·{" "}
														{LEVEL_LABELS[row.profile.currentLevel]}
													</Badge>
												)}
												{row.profile?.grade && (
													<span className="text-text-muted">
														{row.profile.grade}
													</span>
												)}
											</div>
											{row.profile && (
												<div className="mt-1 text-xs text-text-muted">
													{goalLabel(row.profile.learningGoal)} ·{" "}
													{Math.round(row.profile.totalPracticeMinutes / 60)}{" "}
													小时
												</div>
											)}
										</div>
									</button>
								))}
							</div>
						</>
					)}
				</CardContent>
			</Card>
		</PageContainer>
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
