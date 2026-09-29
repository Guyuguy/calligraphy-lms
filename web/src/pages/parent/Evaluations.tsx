import { Star } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, type Evaluation } from "@/api/client";
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
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type TargetType = "teacher" | "course";

export function Evaluations() {
	const [list, setList] = useState<Evaluation[]>([]);
	const [targetType, setTargetType] = useState<TargetType>("teacher");
	const [targetId, setTargetId] = useState("");
	const [rating, setRating] = useState(5);
	const [comment, setComment] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(() => {
		api
			.get<{ evaluations: Evaluation[] }>("/parent/evaluations")
			.then((res) => setList(res.evaluations))
			.catch(() => setList([]));
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	const submit = async () => {
		if (!targetId.trim()) {
			setError("请填写目标 ID");
			return;
		}
		setSubmitting(true);
		setError(null);
		try {
			await api.post("/parent/evaluations", {
				targetType,
				targetId: targetId.trim(),
				rating,
				comment,
			});
			setTargetId("");
			setComment("");
			setRating(5);
			load();
		} catch (e) {
			setError(e instanceof Error ? e.message : "提交失败");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<PageContainer title="评价中心" description="对教师或课程进行评价">
			<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>提交新评价</CardTitle>
						<CardDescription>您的评价将帮助平台改进教学质量</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-2">
							<label htmlFor="ev-target-type" className="text-sm font-medium">
								评价对象类型
							</label>
							<div className="flex gap-2">
								<button
									type="button"
									onClick={() => setTargetType("teacher")}
									className={cn(
										"flex-1 rounded-md border px-3 py-2 text-sm",
										targetType === "teacher"
											? "border-brand bg-brand/5 text-brand"
											: "border-border",
									)}
								>
									教师
								</button>
								<button
									type="button"
									onClick={() => setTargetType("course")}
									className={cn(
										"flex-1 rounded-md border px-3 py-2 text-sm",
										targetType === "course"
											? "border-brand bg-brand/5 text-brand"
											: "border-border",
									)}
								>
									课程
								</button>
							</div>
						</div>

						<div className="space-y-2">
							<label htmlFor="ev-target-id" className="text-sm font-medium">
								{targetType === "teacher" ? "教师 ID" : "课程 ID"}
							</label>
							<Input
								id="ev-target-id"
								value={targetId}
								onChange={(e) => setTargetId(e.target.value)}
								placeholder={
									targetType === "teacher" ? "user_teacher_xx" : "course_xx"
								}
							/>
						</div>

						<div className="space-y-2">
							<span className="text-sm font-medium">评分</span>
							<div className="flex gap-1">
								{[1, 2, 3, 4, 5].map((n) => (
									<button
										key={n}
										type="button"
										onClick={() => setRating(n)}
										aria-label={`${n} 星`}
										className="p-1"
									>
										<Star
											className={cn(
												"size-6",
												n <= rating
													? "fill-status-warning text-status-warning"
													: "text-text-muted",
											)}
										/>
									</button>
								))}
							</div>
						</div>

						<div className="space-y-2">
							<label htmlFor="ev-comment" className="text-sm font-medium">
								评论（可选）
							</label>
							<Textarea
								id="ev-comment"
								value={comment}
								onChange={(e) => setComment(e.target.value)}
								rows={3}
								placeholder="说说您的感受..."
							/>
						</div>

						{error && <div className="text-sm text-status-error">{error}</div>}

						<Button onClick={submit} disabled={submitting}>
							{submitting ? "提交中..." : "提交评价"}
						</Button>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>我的评价历史</CardTitle>
						<CardDescription>共 {list.length} 条评价</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						{list.length === 0 ? (
							<div className="py-6 text-center text-sm text-text-muted">
								尚未提交过评价
							</div>
						) : (
							list.map((ev) => (
								<div
									key={ev.id}
									className="rounded-md border border-border bg-surface-1 p-3"
								>
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2">
											<Badge variant="outline">
												{ev.targetType === "teacher"
													? "教师"
													: ev.targetType === "course"
														? "课程"
														: "学生"}
											</Badge>
											<span className="text-xs text-text-muted">
												{ev.targetId}
											</span>
										</div>
										<div className="flex gap-0.5">
											{[1, 2, 3, 4, 5].map((n) => (
												<Star
													key={n}
													className={cn(
														"size-3",
														n <= ev.rating
															? "fill-status-warning text-status-warning"
															: "text-text-muted",
													)}
												/>
											))}
										</div>
									</div>
									{ev.comment && (
										<p className="mt-2 text-sm text-text-secondary">
											{ev.comment}
										</p>
									)}
									<div className="mt-1 text-xs text-text-muted">
										{ev.createdAt.slice(0, 10)}
									</div>
								</div>
							))
						)}
					</CardContent>
				</Card>
			</div>
		</PageContainer>
	);
}
