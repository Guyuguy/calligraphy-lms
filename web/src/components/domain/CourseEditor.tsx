import { Plus, Trash2, Upload, Video } from "lucide-react";
import { useState } from "react";
import {
	ApiError,
	api,
	type Course,
	LEVEL_LABELS,
	type Level,
	type Module,
	STAGE_LABELS,
	STYLE_LABELS,
	type Stage,
	type Style,
	type Unit,
	type User,
} from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

interface CourseEditorProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	user: User;
	existing?: Course | null; // 有值=编辑模式，无值=新建模式
	onSaved: (course: Course) => void;
}

const UNIT_TYPES: Unit["type"][] = [
	"video",
	"live",
	"stroke_lesson",
	"reference_char",
	"tracing_exercise",
	"assignment",
	"quiz",
];

const UNIT_TYPE_LABELS: Record<Unit["type"], string> = {
	video: "视频课",
	live: "直播课",
	stroke_lesson: "笔画讲解",
	reference_char: "范字",
	tracing_exercise: "临摹练习",
	assignment: "作业",
	quiz: "测验",
};

function blankModule(order: number): Module {
	return {
		id: `mod_new_${Math.random().toString(36).slice(2, 8)}`,
		courseId: "",
		title: "新章节",
		description: "",
		order,
		units: [],
	};
}

function blankUnit(order: number, type: Unit["type"] = "video"): Unit {
	return {
		id: `unit_new_${Math.random().toString(36).slice(2, 8)}`,
		moduleId: "",
		title: "新单元",
		type,
		description: "",
		order,
		durationMinutes: 30,
		completionCriteria: type === "video" ? { watchSeconds: 1800 } : {},
	};
}

function errMsg(e: unknown): string {
	if (e instanceof ApiError) return e.message;
	return e instanceof Error ? e.message : "操作失败";
}

export function CourseEditor({
	open,
	onOpenChange,
	user,
	existing,
	onSaved,
}: CourseEditorProps) {
	const isEdit = !!existing;
	const [title, setTitle] = useState(existing?.title ?? "");
	const [stage, setStage] = useState<Stage>(existing?.stage ?? "kaishu");
	const [level, setLevel] = useState<Level>(existing?.level ?? "L1");
	const [style, setStyle] = useState<Style>(existing?.style ?? "modern");
	const [audience, setAudience] = useState(existing?.audience ?? "");
	const [intro, setIntro] = useState(existing?.intro ?? "");
	const [price, setPrice] = useState<number>(existing?.price ?? 0);
	const [cover, setCover] = useState(existing?.cover ?? "");
	const [teacherId, setTeacherId] = useState(
		existing?.teacherId ?? (user.role === "teacher" ? user.id : ""),
	);
	const [modules, setModules] = useState<Module[]>(
		existing?.modules.map((m, i) => ({ ...m, order: i })) ?? [
			blankModule(0),
		],
	);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [uploadingUnitId, setUploadingUnitId] = useState<string | null>(null);

	const addModule = () => {
		setModules([...modules, blankModule(modules.length)]);
	};

	const removeModule = (idx: number) => {
		setModules(modules.filter((_, i) => i !== idx));
	};

	const updateModule = (idx: number, patch: Partial<Module>) => {
		setModules(
			modules.map((m, i) => (i === idx ? { ...m, ...patch } : m)),
		);
	};

	const addUnit = (modIdx: number, type: Unit["type"]) => {
		const newUnit = blankUnit(modules[modIdx].units.length, type);
		setModules(
			modules.map((m, i) =>
				i === modIdx ? { ...m, units: [...m.units, newUnit] } : m,
			),
		);
	};

	const removeUnit = (modIdx: number, unitIdx: number) => {
		setModules(
			modules.map((m, i) =>
				i === modIdx
					? { ...m, units: m.units.filter((_, j) => j !== unitIdx) }
					: m,
			),
		);
	};

	const updateUnit = (
		modIdx: number,
		unitIdx: number,
		patch: Partial<Unit>,
	) => {
		setModules(
			modules.map((m, i) =>
				i === modIdx
					? {
							...m,
							units: m.units.map((u, j) =>
								j === unitIdx ? { ...u, ...patch } : u,
							),
						}
					: m,
			),
		);
	};

	const handleUploadVideo = async (
		modIdx: number,
		unitIdx: number,
		file: File,
	) => {
		const mod = modules[modIdx];
		const unit = mod.units[unitIdx];
		// 单元 id 在新建模式下还没有持久化，需要先保存课程拿到 id
		if (!isEdit) {
			setError("请先保存课程，再上传视频");
			return;
		}
		setUploadingUnitId(unit.id);
		setError(null);
		try {
			const res = await api.postVideo<{
				ok: boolean;
				videoUrl: string;
				unit: Unit;
			}>(`/courses/${existing!.id}/units/${unit.id}/video`, file);
			updateUnit(modIdx, unitIdx, {
				videoUrl: res.videoUrl,
				videoMime: file.type,
				videoSize: file.size,
			});
		} catch (e) {
			setError(errMsg(e));
		} finally {
			setUploadingUnitId(null);
		}
	};

	const handleDeleteVideo = async (modIdx: number, unitIdx: number) => {
		const unit = modules[modIdx].units[unitIdx];
		if (!isEdit || !unit.videoUrl) return;
		try {
			await api.del(
				`/courses/${existing!.id}/units/${unit.id}/video`,
			);
			updateUnit(modIdx, unitIdx, {
				videoUrl: undefined,
				videoMime: undefined,
				videoSize: undefined,
			});
		} catch (e) {
			setError(errMsg(e));
		}
	};

	const handleSave = async () => {
		if (!title.trim()) {
			setError("课程标题不能为空");
			return;
		}
		setSaving(true);
		setError(null);
		try {
			const payload = {
				title,
				stage,
				level,
				style,
				audience,
				intro,
				price,
				cover:
					cover ||
					`https://placehold.co/600x400/c96442/efeee9?text=${encodeURIComponent(title.slice(0, 6))}`,
				teacherId: teacherId || (user.role === "teacher" ? user.id : ""),
				prerequisites: existing?.prerequisites ?? [],
				totalUnits: modules.reduce((s, m) => s + m.units.length, 0),
				modules,
				status: existing?.status ?? "draft",
			};
			if (isEdit && existing) {
				const r = await api.put<{ course: Course }>(
					`/courses/${existing.id}`,
					payload,
				);
				onSaved(r.course);
			} else {
				const r = await api.post<{ course: Course }>("/courses", payload);
				onSaved(r.course);
			}
		} catch (e) {
			setError(errMsg(e));
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
				<DialogHeader>
					<DialogTitle>
						{isEdit ? "编辑课程" : "新建课程"}
					</DialogTitle>
					<DialogDescription>
						填写课程信息，添加章节和单元，可为视频单元上传视频文件
						（最大 1024MB）
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					{/* 基本信息 */}
					<div className="grid grid-cols-2 gap-3">
						<div className="col-span-2 space-y-1.5">
							<label htmlFor="ce-title" className="text-sm font-medium">
								课程标题
							</label>
							<Input
								id="ce-title"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								placeholder="如：欧体楷书三十字精讲"
							/>
						</div>
						<div className="space-y-1.5">
							<label className="text-sm font-medium">书体</label>
							<Select
								value={stage}
								onValueChange={(v) => setStage(v as Stage)}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{(Object.keys(STAGE_LABELS) as Stage[]).map((s) => (
										<SelectItem key={s} value={s}>
											{STAGE_LABELS[s]}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-1.5">
							<label className="text-sm font-medium">难度</label>
							<Select
								value={level}
								onValueChange={(v) => setLevel(v as Level)}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{(Object.keys(LEVEL_LABELS) as Level[]).map((l) => (
										<SelectItem key={l} value={l}>
											{LEVEL_LABELS[l]}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-1.5">
							<label className="text-sm font-medium">风格</label>
							<Select
								value={style}
								onValueChange={(v) => setStyle(v as Style)}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{(Object.keys(STYLE_LABELS) as Style[]).map((s) => (
										<SelectItem key={s} value={s}>
											{STYLE_LABELS[s]}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-1.5">
							<label htmlFor="ce-price" className="text-sm font-medium">
								价格（元）
							</label>
							<Input
								id="ce-price"
								type="number"
								min={0}
								value={price}
								onChange={(e) => setPrice(Number(e.target.value))}
							/>
						</div>
						<div className="col-span-2 space-y-1.5">
							<label htmlFor="ce-audience" className="text-sm font-medium">
								面向学员
							</label>
							<Input
								id="ce-audience"
								value={audience}
								onChange={(e) => setAudience(e.target.value)}
								placeholder="如：零基础成人 / 小学高年级"
							/>
						</div>
						<div className="col-span-2 space-y-1.5">
							<label htmlFor="ce-intro" className="text-sm font-medium">
								课程简介
							</label>
							<textarea
								id="ce-intro"
								className="min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
								value={intro}
								onChange={(e) => setIntro(e.target.value)}
							/>
						</div>
						<div className="col-span-2 space-y-1.5">
							<label htmlFor="ce-cover" className="text-sm font-medium">
								封面 URL（可选）
							</label>
							<Input
								id="ce-cover"
								value={cover}
								onChange={(e) => setCover(e.target.value)}
								placeholder="留空自动生成"
							/>
						</div>
						{user.role === "admin" && (
							<div className="col-span-2 space-y-1.5">
								<label
									htmlFor="ce-teacher"
									className="text-sm font-medium"
								>
									授课教师 ID（可选，留空则使用自己）
								</label>
								<Input
									id="ce-teacher"
									value={teacherId}
									onChange={(e) => setTeacherId(e.target.value)}
									placeholder="user_teacher_xx"
								/>
							</div>
						)}
					</div>

					{/* 章节 / 单元 */}
					<div className="space-y-3 rounded-md border border-border bg-surface-1 p-3">
						<div className="flex items-center justify-between">
							<div className="text-sm font-medium">
								章节与单元（共 {modules.length} 章 ·{" "}
								{modules.reduce((s, m) => s + m.units.length, 0)} 节）
							</div>
							<Button size="sm" variant="outline" onClick={addModule}>
								<Plus className="size-3.5" />
								添加章节
							</Button>
						</div>

						{modules.map((m, mi) => (
							<div
								key={m.id}
								className="space-y-2 rounded-md border border-border bg-card p-3"
							>
								<div className="flex items-center gap-2">
									<Badge variant="info" className="shrink-0">
										第 {mi + 1} 章
									</Badge>
									<Input
										value={m.title}
										onChange={(e) =>
											updateModule(mi, { title: e.target.value })
										}
										className="flex-1"
									/>
									<Button
										size="sm"
										variant="ghost"
										onClick={() => removeModule(mi)}
										aria-label="删除章节"
									>
										<Trash2 className="size-3.5 text-status-error" />
									</Button>
								</div>
								<Input
									value={m.description}
									onChange={(e) =>
										updateModule(mi, { description: e.target.value })
									}
									placeholder="章节描述（可选）"
									className="text-xs"
								/>
								<div className="space-y-1.5">
									{m.units.map((u, ui) => (
										<div
											key={u.id}
											className="rounded-md border border-border bg-surface-1 p-2"
										>
											<div className="flex items-center gap-2">
												<Select
													value={u.type}
													onValueChange={(v) =>
														updateUnit(mi, ui, {
															type: v as Unit["type"],
															completionCriteria:
																v === "video"
																	? { watchSeconds: 1800 }
																	: {},
														})
													}
												>
													<SelectTrigger className="w-32">
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														{UNIT_TYPES.map((t) => (
															<SelectItem key={t} value={t}>
																{UNIT_TYPE_LABELS[t]}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
												<Input
													value={u.title}
													onChange={(e) =>
														updateUnit(mi, ui, { title: e.target.value })
													}
													className="flex-1"
													placeholder="单元标题"
												/>
												<Input
													type="number"
													min={1}
													value={u.durationMinutes}
													onChange={(e) =>
														updateUnit(mi, ui, {
															durationMinutes: Number(e.target.value),
														})
													}
													className="w-20"
													aria-label="时长（分钟）"
												/>
												<Button
													size="sm"
													variant="ghost"
													onClick={() => removeUnit(mi, ui)}
													aria-label="删除单元"
												>
													<Trash2 className="size-3.5 text-status-error" />
												</Button>
											</div>
											{u.type === "video" && (
												<div className="mt-2 flex items-center gap-2">
													<Video className="size-3.5 text-text-muted" />
													{u.videoUrl ? (
														<>
															<Badge variant="success">已上传</Badge>
															<span className="text-xs text-text-muted">
																{u.videoSize
																	? `${(u.videoSize / 1024 / 1024).toFixed(1)} MB`
																	: ""}
															</span>
															<label className="ml-auto cursor-pointer text-xs text-brand hover:underline">
																<input
													type="file"
													accept="video/*"
													className="hidden"
													onChange={(e) => {
														const f = e.target.files?.[0];
														if (f) handleUploadVideo(mi, ui, f);
														e.currentTarget.value = "";
													}}
												/>
																替换
															</label>
															<Button
																size="sm"
																variant="ghost"
																onClick={() => handleDeleteVideo(mi, ui)}
																className="text-xs text-status-error"
											>
																删除视频
															</Button>
														</>
													) : (
														<>
															<span className="text-xs text-text-muted">
																未上传
															</span>
															<label className="ml-auto cursor-pointer rounded-md border border-border bg-card px-2.5 py-1 text-xs hover:bg-surface-2">
																{uploadingUnitId === u.id ? (
																	"上传中..."
																) : (
																	<>
																		<Upload className="mr-1 inline size-3" />
																		上传视频
																	</>
																)}
																<input
													type="file"
													accept="video/*"
													className="hidden"
													disabled={uploadingUnitId === u.id || !isEdit}
													onChange={(e) => {
														const f = e.target.files?.[0];
														if (f) handleUploadVideo(mi, ui, f);
														e.currentTarget.value = "";
													}}
												/>
															</label>
															{!isEdit && (
																<span className="text-xs text-text-muted">
																	保存课程后可上传
																</span>
															)}
														</>
													)}
												</div>
											)}
										</div>
									))}
									<div className="flex flex-wrap gap-1.5 pt-1">
										{UNIT_TYPES.map((t) => (
											<Button
												key={t}
												size="sm"
												variant="outline"
												onClick={() => addUnit(mi, t)}
												className="h-7 text-xs"
											>
												<Plus className="size-3" />
												{UNIT_TYPE_LABELS[t]}
											</Button>
										))}
									</div>
								</div>
							</div>
						))}
					</div>

					{error && (
						<div className="rounded-md border border-status-error/30 bg-status-error/10 px-3 py-2 text-sm text-status-error">
							{error}
						</div>
					)}
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={saving}
					>
						取消
					</Button>
					<Button onClick={handleSave} disabled={saving}>
						{saving ? "保存中..." : isEdit ? "保存修改" : "创建课程"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
