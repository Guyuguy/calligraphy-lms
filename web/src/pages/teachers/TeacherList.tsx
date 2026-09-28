import { Clock, Search, Star, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
	api,
	STAGE_LABELS,
	type TeacherProfile,
	type User,
} from "@/api/client";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface TeacherListProps {
	user: User;
	navigate: (p: string) => void;
}

interface TeacherRow {
	user: User;
	profile: TeacherProfile | null;
}

export function TeacherList({ user, navigate }: TeacherListProps) {
	const [rows, setRows] = useState<TeacherRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");

	useEffect(() => {
		api
			.get<{ users: User[] }>("/users?role=teacher")
			.then(async (r) => {
				const profiles = await Promise.all(
					r.users.map((t) =>
						api.get<{ profile: TeacherProfile | null }>(`/users/${t.id}`),
					),
				);
				setRows(
					r.users.map((u, i) => ({ user: u, profile: profiles[i].profile })),
				);
			})
			.finally(() => setLoading(false));
	}, []);

	const filtered = useMemo(() => {
		if (!search) return rows;
		const q = search.toLowerCase();
		return rows.filter(
			(r) =>
				r.user.name.toLowerCase().includes(q) ||
				(r.profile?.bio.toLowerCase().includes(q) ?? false),
		);
	}, [rows, search]);

	return (
		<PageContainer
			title="教师管理"
			description={`共 ${rows.length} 名教师`}
			actions={
				(user.role === "admin" || user.role === "academic_head") && (
					<Button>新增教师</Button>
				)
			}
		>
			<Card>
				<CardContent className="pt-6">
					<div className="relative mb-4">
						<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
						<Input
							placeholder="搜索教师姓名或简介..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="max-w-md pl-9"
						/>
					</div>

					{loading ? (
						<div className="py-12 text-center text-sm text-text-muted">
							加载中...
						</div>
					) : (
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
							{filtered.map((row) => (
								<button
									key={row.user.id}
									type="button"
									onClick={() => navigate(`/teachers/${row.user.id}`)}
									className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-5 text-left shadow-sm transition-all hover:shadow-md"
								>
									<div className="flex items-start gap-3">
										<div className="flex size-12 items-center justify-center rounded-full bg-brand/10 font-serif text-lg font-semibold text-brand">
											{row.user.name.charAt(0)}
										</div>
										<div className="flex-1">
											<div className="font-medium">{row.user.name}</div>
											<div className="mt-0.5 flex items-center gap-1 text-xs text-status-warning">
												<Star className="size-3 fill-current" />
												{row.profile?.rating.toFixed(1) ?? "-"} ·{" "}
												{row.profile?.teachingYears ?? 0} 年教龄
											</div>
										</div>
									</div>
									<p className="line-clamp-2 text-sm text-text-secondary">
										{row.profile?.bio ?? "暂无简介"}
									</p>
									<div className="flex flex-wrap gap-1.5">
										{row.profile?.stages.map((s) => (
											<Badge key={s} variant="secondary">
												{STAGE_LABELS[s]}
											</Badge>
										))}
									</div>
									<div className="flex items-center justify-between border-t border-border pt-3 text-xs text-text-muted">
										<span className="flex items-center gap-1">
											<Users className="size-3" />
											{row.profile?.studentCount ?? 0} 学生
										</span>
										<span className="flex items-center gap-1">
											<Clock className="size-3" />
											{row.profile?.workloadHoursPerWeek ?? 0}h / 周
										</span>
									</div>
								</button>
							))}
						</div>
					)}
				</CardContent>
			</Card>
		</PageContainer>
	);
}
