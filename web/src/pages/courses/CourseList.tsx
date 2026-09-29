import { Filter, Plus, Search, Star, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
	api,
	type Course,
	LEVEL_LABELS,
	type Level,
	STAGE_LABELS,
	STYLE_LABELS,
	type Stage,
	type Style,
	type User,
} from "@/api/client";
import { CourseEditor } from "@/components/domain/CourseEditor";
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

interface CourseListProps {
	user: User;
	navigate: (p: string) => void;
}

export function CourseList({ user, navigate }: CourseListProps) {
	const [courses, setCourses] = useState<Course[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [stage, setStage] = useState<string>("all");
	const [level, setLevel] = useState<string>("all");
	const [style, setStyle] = useState<string>("all");
	const [editorOpen, setEditorOpen] = useState(false);

	const canManage =
		user.role === "admin" ||
		user.role === "academic_head" ||
		user.role === "teacher";

	const reload = () => {
		setLoading(true);
		api
			.get<{ courses: Course[] }>("/courses")
			.then((r) => setCourses(r.courses))
			.finally(() => setLoading(false));
	};

	useEffect(() => {
		reload();
	}, []);

	const filtered = useMemo(() => {
		let list = courses;
		if (search) {
			const q = search.toLowerCase();
			list = list.filter(
				(c) =>
					c.title.toLowerCase().includes(q) ||
					c.intro.toLowerCase().includes(q),
			);
		}
		if (stage !== "all") list = list.filter((c) => c.stage === stage);
		if (level !== "all") list = list.filter((c) => c.level === level);
		if (style !== "all") list = list.filter((c) => c.style === style);
		return list;
	}, [courses, search, stage, level, style]);

	return (
		<PageContainer
			title="课程管理"
			description={`共 ${courses.length} 门课程`}
			actions={
				canManage && (
					<Button onClick={() => setEditorOpen(true)}>
						<Plus className="size-4" />
						新建课程
					</Button>
				)
			}
		>
			<Card>
				<CardContent className="pt-6">
					<div className="mb-4 flex flex-wrap items-center gap-3">
						<div className="relative min-w-64 flex-1">
							<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
							<Input
								placeholder="搜索课程名称或简介..."
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								className="pl-9"
							/>
						</div>
						<Select value={stage} onValueChange={setStage}>
							<SelectTrigger className="w-32">
								<SelectValue placeholder="书体" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">全部书体</SelectItem>
								{(Object.keys(STAGE_LABELS) as Stage[]).map((s) => (
									<SelectItem key={s} value={s}>
										{STAGE_LABELS[s]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Select value={level} onValueChange={setLevel}>
							<SelectTrigger className="w-32">
								<SelectValue placeholder="难度" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">全部难度</SelectItem>
								{(Object.keys(LEVEL_LABELS) as Level[]).map((l) => (
									<SelectItem key={l} value={l}>
										{LEVEL_LABELS[l]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Select value={style} onValueChange={setStyle}>
							<SelectTrigger className="w-32">
								<SelectValue placeholder="字体风格" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">全部风格</SelectItem>
								{(Object.keys(STYLE_LABELS) as Style[]).map((s) => (
									<SelectItem key={s} value={s}>
										{STYLE_LABELS[s]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{(stage !== "all" || level !== "all" || style !== "all") && (
							<Button
								variant="ghost"
								size="sm"
								onClick={() => {
									setStage("all");
									setLevel("all");
									setStyle("all");
								}}
							>
								<Filter className="size-3" />
								清空筛选
							</Button>
						)}
					</div>

					{loading ? (
						<div className="py-12 text-center text-sm text-text-muted">
							加载中...
						</div>
					) : filtered.length === 0 ? (
						<div className="py-12 text-center text-sm text-text-muted">
							暂无符合条件的课程
						</div>
					) : (
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
							{filtered.map((c) => (
								<CourseCard
									key={c.id}
									course={c}
									onClick={() => navigate(`/courses/${c.id}`)}
								/>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			{canManage && (
				<CourseEditor
					open={editorOpen}
					onOpenChange={setEditorOpen}
					user={user}
					existing={null}
					onSaved={(c) => {
						setEditorOpen(false);
						navigate(`/courses/${c.id}`);
					}}
				/>
			)}
		</PageContainer>
	);
}

function CourseCard({
	course,
	onClick,
}: {
	course: Course;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm transition-all hover:shadow-md"
		>
			<div className="relative aspect-[3/2] overflow-hidden bg-surface-2">
				<img
					src={course.cover}
					alt=""
					className="size-full object-cover transition-transform group-hover:scale-105"
				/>
				<div className="absolute left-3 top-3 flex gap-1.5">
					<Badge variant="default">{STAGE_LABELS[course.stage]}</Badge>
					<Badge variant="secondary">{LEVEL_LABELS[course.level]}</Badge>
				</div>
			</div>
			<div className="flex flex-1 flex-col gap-2 p-4">
				<div className="line-clamp-2 font-medium leading-snug">
					{course.title}
				</div>
				<div className="line-clamp-2 text-xs text-text-muted">
					{course.intro}
				</div>
				<div className="mt-auto flex items-center justify-between border-t border-border pt-3 text-xs text-text-muted">
					<span className="flex items-center gap-1">
						<Star className="size-3 fill-status-warning text-status-warning" />
						{course.rating.toFixed(1)}
					</span>
					<span className="flex items-center gap-1">
						<Users className="size-3" />
						{course.enrolledCount} 人
					</span>
					<span>{course.totalUnits} 节</span>
				</div>
			</div>
		</button>
	);
}
