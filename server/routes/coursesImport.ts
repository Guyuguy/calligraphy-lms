// 课程导入解析器 — 支持 JSON / Markdown / TXT / Excel / Word 五种格式
// 集中所有解析逻辑,导出 parseCourseFile / generateTemplate / buildCourseFromDraft

import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { uid } from "../db";
import type {
	Course,
	Level,
	Module,
	Stage,
	Style,
	Unit,
	UnitType,
} from "../types";

// ============================================================
// 类型定义
// ============================================================

export interface CourseDraftUnit {
	title: string;
	type?: UnitType;
	durationMinutes?: number;
	description?: string;
}

export interface CourseDraftModule {
	title: string;
	description?: string;
	units: CourseDraftUnit[];
}

export interface CourseDraft {
	title: string;
	stage?: Stage;
	level?: Level;
	style?: Style;
	audience?: string;
	intro?: string;
	price?: number;
	cover?: string;
	teacherId?: string;
	modules: CourseDraftModule[];
}

export interface ParseResult {
	courses: CourseDraft[];
	errors: string[];
}

// ============================================================
// 主入口 — 根据扩展名分发
// ============================================================

export async function parseCourseFile(
	filename: string,
	buf: Uint8Array,
): Promise<ParseResult> {
	const ext = (filename.toLowerCase().split(".").pop() ?? "").trim();
	try {
		if (ext === "json") return parseJson(buf);
		if (ext === "md" || ext === "txt")
			return parseMarkdown(new TextDecoder().decode(buf));
		if (ext === "xlsx") return parseXlsx(buf);
		if (ext === "docx") return await parseDocx(buf);
		return { courses: [], errors: [`不支持的文件格式: .${ext}`] };
	} catch (e) {
		return {
			courses: [],
			errors: [`解析失败: ${e instanceof Error ? e.message : String(e)}`],
		};
	}
}

// ============================================================
// JSON 解析器
// ============================================================

function parseJson(buf: Uint8Array): ParseResult {
	const text = new TextDecoder().decode(buf);
	const data = JSON.parse(text);
	const arr = Array.isArray(data) ? data : [data];
	const courses: CourseDraft[] = [];
	const errors: string[] = [];
	for (let i = 0; i < arr.length; i++) {
		const item = arr[i];
		if (!item || typeof item !== "object") {
			errors.push(`第 ${i + 1} 项不是对象`);
			continue;
		}
		const draft = normalizeDraft(item);
		if (!draft.title?.trim()) {
			errors.push(`第 ${i + 1} 项缺少标题`);
			continue;
		}
		courses.push(draft);
	}
	return { courses, errors };
}

function normalizeDraft(raw: Record<string, unknown>): CourseDraft {
	const modules: CourseDraftModule[] = Array.isArray(raw.modules)
		? raw.modules.map((m: unknown) =>
				normalizeModule(m as Record<string, unknown>),
			)
		: [];
	return {
		title: String(raw.title ?? ""),
		stage: raw.stage as Stage | undefined,
		level: raw.level as Level | undefined,
		style: raw.style as Style | undefined,
		audience: raw.audience ? String(raw.audience) : undefined,
		intro: raw.intro ? String(raw.intro) : undefined,
		price: typeof raw.price === "number" ? raw.price : undefined,
		cover: raw.cover ? String(raw.cover) : undefined,
		teacherId: raw.teacherId ? String(raw.teacherId) : undefined,
		modules,
	};
}

function normalizeModule(raw: Record<string, unknown>): CourseDraftModule {
	const units: CourseDraftUnit[] = Array.isArray(raw.units)
		? raw.units.map((u: unknown) => normalizeUnit(u as Record<string, unknown>))
		: [];
	return {
		title: String(raw.title ?? ""),
		description: raw.description ? String(raw.description) : undefined,
		units,
	};
}

function normalizeUnit(raw: Record<string, unknown>): CourseDraftUnit {
	return {
		title: String(raw.title ?? ""),
		type: raw.type as UnitType | undefined,
		durationMinutes:
			typeof raw.durationMinutes === "number" ? raw.durationMinutes : undefined,
		description: raw.description ? String(raw.description) : undefined,
	};
}

// ============================================================
// Markdown / TXT 解析器 — 标题层级 + key:value 元数据
// ============================================================

// 规则:
//   # 课程: <标题>      → 开始一门新课程
//   ## <章节标题>        → 开始新章节
//   ### <单元标题>        → 开始新单元
//   key: value           → 当前节的元数据
//   空行                  → 分隔段落,不影响结构

function parseMarkdown(text: string): ParseResult {
	const lines = text.replace(/\r\n/g, "\n").split("\n");
	const courses: CourseDraft[] = [];
	const errors: string[] = [];
	let current: CourseDraft | null = null;
	let currentModule: CourseDraftModule | null = null;
	let currentUnit: CourseDraftUnit | null = null;

	const flushUnit = () => {
		if (current && currentModule && currentUnit) {
			currentModule.units.push(currentUnit);
		}
		currentUnit = null;
	};
	const flushModule = () => {
		flushUnit();
		if (current && currentModule) {
			current.modules.push(currentModule);
		}
		currentModule = null;
	};
	const flushCourse = () => {
		flushModule();
		if (current) {
			if (current.title.trim()) {
				courses.push(current);
			} else {
				errors.push("发现未命名的课程,已跳过");
			}
		}
		current = null;
	};

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trim();

		// 空行
		if (trimmed === "") continue;

		// 标题行
		if (trimmed.startsWith("# ")) {
			// 新课程
			flushCourse();
			const title = trimmed.slice(2).trim();
			// 支持 "# 课程: xxx" 或 "# xxx"
			const cleanTitle = title.replace(/^课程[:：]\s*/, "");
			current = { title: cleanTitle, modules: [] };
			continue;
		}
		if (trimmed.startsWith("## ")) {
			if (!current) {
				errors.push(`第 ${i + 1} 行: 章节标题出现在课程之前`);
				continue;
			}
			flushModule();
			currentModule = { title: trimmed.slice(3).trim(), units: [] };
			continue;
		}
		if (trimmed.startsWith("### ")) {
			if (!current || !currentModule) {
				errors.push(`第 ${i + 1} 行: 单元标题出现在章节之前`);
				continue;
			}
			flushUnit();
			currentUnit = { title: trimmed.slice(4).trim() };
			continue;
		}

		// key: value 元数据行
		const kvMatch = /^([a-zA-Z\u4e00-\u9fa5_]+)\s*[:：]\s*(.*)$/.exec(trimmed);
		if (kvMatch) {
			const key = kvMatch[1].trim();
			const value = kvMatch[2].trim();
			applyMetadata(key, value, current, currentModule, currentUnit);
			continue;
		}

		// 其他文本行 — 如果当前在单元里,追加到 description
		if (currentUnit && !currentUnit.description) {
			currentUnit.description = trimmed;
		} else if (currentUnit?.description) {
			currentUnit.description += `\n${trimmed}`;
		} else if (currentModule && !currentModule.description) {
			currentModule.description = trimmed;
		} else if (current && !current.intro) {
			current.intro = trimmed;
		}
	}

	flushCourse();
	return { courses, errors };
}

function applyMetadata(
	key: string,
	value: string,
	course: CourseDraft | null,
	module: CourseDraftModule | null,
	unit: CourseDraftUnit | null,
) {
	if (!course) return;
	const k = key.toLowerCase();
	switch (k) {
		case "stage":
			course.stage = value as Stage;
			break;
		case "level":
			course.level = value as Level;
			break;
		case "style":
			course.style = value as Style;
			break;
		case "audience":
		case "面向":
		case "面向学员":
			course.audience = value;
			break;
		case "intro":
		case "简介":
		case "课程简介":
			course.intro = value;
			break;
		case "price":
		case "价格":
			course.price = Number(value) || 0;
			break;
		case "cover":
		case "封面":
			course.cover = value;
			break;
		case "teacherid":
		case "teacher":
		case "教师":
			course.teacherId = value;
			break;
		case "description":
		case "描述":
		case "说明":
			if (unit) {
				unit.description = value;
			} else if (module) {
				module.description = value;
			} else {
				course.intro = value;
			}
			break;
		case "type":
		case "类型":
			if (unit) unit.type = value as UnitType;
			break;
		case "durationminutes":
		case "duration":
		case "时长":
			if (unit) unit.durationMinutes = Number(value) || 30;
			break;
		default:
			// 未知键忽略
			break;
	}
}

// ============================================================
// XLSX 解析器 — SheetJS
// ============================================================

// 表头列(中英文均可):
//   title/课程标题, stage/书体, level/难度, style/风格, audience/面向,
//   intro/简介, price/价格, cover/封面, teacherId/教师ID,
//   moduleName/章节, moduleDescription/章节描述,
//   unitTitle/单元标题, unitType/单元类型, unitDurationMinutes/单元时长, unitDescription/单元描述
// 每行一个单元记录;同课程通过相同 title 聚合,同章节通过相同 moduleName 聚合

// 取行中两列任一非空值(英文键优先,中文键兜底)
function colStr(
	row: Record<string, unknown>,
	enKey: string,
	cnKey: string,
): string {
	const enVal = row[enKey];
	if (typeof enVal === "string" && enVal.trim()) return enVal.trim();
	if (typeof enVal === "number") return String(enVal);
	const cnVal = row[cnKey];
	if (typeof cnVal === "string" && cnVal.trim()) return cnVal.trim();
	if (typeof cnVal === "number") return String(cnVal);
	return "";
}

function colNum(
	row: Record<string, unknown>,
	enKey: string,
	cnKey: string,
	fallback: number,
): number {
	const enVal = row[enKey];
	if (typeof enVal === "number" && !Number.isNaN(enVal)) return enVal;
	if (typeof enVal === "string" && enVal.trim()) {
		const n = Number(enVal);
		if (!Number.isNaN(n)) return n;
	}
	const cnVal = row[cnKey];
	if (typeof cnVal === "number" && !Number.isNaN(cnVal)) return cnVal;
	if (typeof cnVal === "string" && cnVal.trim()) {
		const n = Number(cnVal);
		if (!Number.isNaN(n)) return n;
	}
	return fallback;
}

function parseXlsx(buf: Uint8Array): ParseResult {
	const wb = XLSX.read(buf, { type: "array" });
	const sheetName = wb.SheetNames[0];
	if (!sheetName) return { courses: [], errors: ["Excel 文件无 sheet"] };
	const sheet = wb.Sheets[sheetName];
	const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
		defval: "",
	});

	const courses: CourseDraft[] = [];
	const errors: string[] = [];
	let currentCourse: CourseDraft | null = null;
	let currentModule: CourseDraftModule | null = null;
	let lastCourseTitle = "";
	let lastModuleName = "";

	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		const courseTitle = colStr(row, "title", "课程标题");
		const moduleName = colStr(row, "moduleName", "章节");
		const unitTitle = colStr(row, "unitTitle", "单元标题");

		// 课程切换
		if (courseTitle && courseTitle !== lastCourseTitle) {
			if (currentCourse) courses.push(currentCourse);
			currentCourse = {
				title: courseTitle,
				stage: (colStr(row, "stage", "书体") as Stage) || undefined,
				level: (colStr(row, "level", "难度") as Level) || undefined,
				style: (colStr(row, "style", "风格") as Style) || undefined,
				audience: colStr(row, "audience", "面向") || undefined,
				intro: colStr(row, "intro", "简介") || undefined,
				price: colNum(row, "price", "价格", 0),
				cover: colStr(row, "cover", "封面") || undefined,
				teacherId: colStr(row, "teacherId", "教师ID") || undefined,
				modules: [],
			};
			lastCourseTitle = courseTitle;
			lastModuleName = "";
			currentModule = null;
		}

		if (!currentCourse) {
			errors.push(`第 ${i + 2} 行: 缺少课程标题`);
			continue;
		}

		// 章节切换
		if (moduleName && moduleName !== lastModuleName) {
			currentModule = {
				title: moduleName,
				description: colStr(row, "moduleDescription", "章节描述") || undefined,
				units: [],
			};
			currentCourse.modules.push(currentModule);
			lastModuleName = moduleName;
		}

		// 单元
		if (unitTitle) {
			if (!currentModule) {
				// 没有章节名,创建默认章节
				currentModule = { title: "默认章节", units: [] };
				currentCourse.modules.push(currentModule);
				lastModuleName = "默认章节";
			}
			const typeStr = colStr(row, "unitType", "单元类型") || "video";
			currentModule.units.push({
				title: unitTitle,
				type: typeStr as UnitType,
				durationMinutes: colNum(row, "unitDurationMinutes", "单元时长", 30),
				description: colStr(row, "unitDescription", "单元描述") || undefined,
			});
		}
	}

	if (currentCourse) courses.push(currentCourse);
	return { courses, errors };
}

// ============================================================
// DOCX 解析器 — mammoth 提取纯文本后复用 markdown 解析器
// ============================================================

async function parseDocx(buf: Uint8Array): Promise<ParseResult> {
	const arrayBuffer = buf.buffer.slice(
		buf.byteOffset,
		buf.byteOffset + buf.byteLength,
	) as ArrayBuffer;
	const { value } = await mammoth.extractRawText({ arrayBuffer });
	return parseMarkdown(value);
}

// ============================================================
// 构造 Course 实体 — 复用 POST /api/courses 的逻辑
// ============================================================

export function buildCourseFromDraft(
	draft: CourseDraft,
	fallbackTeacherId: string,
): Course {
	if (!draft.title?.trim()) throw new Error("课程标题不能为空");
	const id = uid("course");
	const now = new Date().toISOString();
	const modules: Module[] = draft.modules.map((m, mi) => {
		const moduleId = uid("mod");
		return {
			id: moduleId,
			courseId: id,
			title: m.title?.trim() || `第 ${mi + 1} 章`,
			description: m.description ?? "",
			order: mi,
			units: m.units.map((u, ui) => {
				const unitType: UnitType = u.type ?? "video";
				return {
					id: uid("unit"),
					moduleId,
					title: u.title?.trim() || `单元 ${ui + 1}`,
					type: unitType,
					description: u.description ?? "",
					order: ui,
					durationMinutes: u.durationMinutes ?? 30,
					completionCriteria:
						unitType === "video" ? { watchSeconds: 1800 } : {},
				} satisfies Unit;
			}),
		};
	});
	return {
		id,
		title: draft.title.trim(),
		stage: draft.stage ?? "kaishu",
		level: draft.level ?? "L1",
		style: draft.style ?? "modern",
		audience: draft.audience ?? "",
		cover:
			draft.cover ??
			`https://placehold.co/600x400/c96442/efeee9?text=${encodeURIComponent(draft.title.slice(0, 6))}`,
		intro: draft.intro ?? "",
		teacherId: draft.teacherId || fallbackTeacherId,
		prerequisites: [],
		totalUnits: modules.reduce((s, m) => s + m.units.length, 0),
		enrolledCount: 0,
		rating: 0,
		price: draft.price ?? 0,
		modules,
		status: "draft",
		createdAt: now,
	};
}

// ============================================================
// 模板生成
// ============================================================

export type TemplateFormat = "json" | "md" | "txt" | "xlsx";

export interface TemplateResult {
	body: ArrayBuffer;
	mime: string;
	filename: string;
}

const SAMPLE_COURSE: CourseDraft = {
	title: "示例课程:欧体楷书入门",
	stage: "kaishu",
	level: "L1",
	style: "ou",
	audience: "零基础成人",
	intro: "本课程介绍欧体楷书的基本笔画和结构,适合零基础学员。",
	price: 199,
	modules: [
		{
			title: "第一章:基本笔画",
			description: "介绍欧体基本笔画的写法",
			units: [
				{
					title: "1.1 横画",
					type: "stroke_lesson",
					durationMinutes: 30,
					description: "横画的起笔、行笔、收笔",
				},
				{
					title: "1.2 竖画",
					type: "stroke_lesson",
					durationMinutes: 25,
					description: "竖画的写法与变化",
				},
			],
		},
		{
			title: "第二章:结构规律",
			description: "欧体楷书的结构特点",
			units: [
				{
					title: "2.1 独体字结构",
					type: "reference_char",
					durationMinutes: 40,
					description: "独体字的结构安排",
				},
			],
		},
	],
};

export function generateTemplate(format: TemplateFormat): TemplateResult {
	switch (format) {
		case "json":
			return generateJsonTemplate();
		case "md":
			return generateMdTemplate();
		case "txt":
			return generateTxtTemplate();
		case "xlsx":
			return generateXlsxTemplate();
	}
}

function generateJsonTemplate(): TemplateResult {
	const body = new TextEncoder().encode(
		JSON.stringify([SAMPLE_COURSE], null, 2),
	);
	return {
		body: body.buffer.slice(0, body.byteLength) as ArrayBuffer,
		mime: "application/json",
		filename: "course-template.json",
	};
}

function generateMdTemplate(): TemplateResult {
	const text = `# 课程: ${SAMPLE_COURSE.title}

stage: ${SAMPLE_COURSE.stage}
level: ${SAMPLE_COURSE.level}
style: ${SAMPLE_COURSE.style}
audience: ${SAMPLE_COURSE.audience}
intro: ${SAMPLE_COURSE.intro}
price: ${SAMPLE_COURSE.price}

## ${SAMPLE_COURSE.modules[0].title}

description: ${SAMPLE_COURSE.modules[0].description}

### ${SAMPLE_COURSE.modules[0].units[0].title}

type: ${SAMPLE_COURSE.modules[0].units[0].type}
durationMinutes: ${SAMPLE_COURSE.modules[0].units[0].durationMinutes}
description: ${SAMPLE_COURSE.modules[0].units[0].description}

### ${SAMPLE_COURSE.modules[0].units[1].title}

type: ${SAMPLE_COURSE.modules[0].units[1].type}
durationMinutes: ${SAMPLE_COURSE.modules[0].units[1].durationMinutes}
description: ${SAMPLE_COURSE.modules[0].units[1].description}

## ${SAMPLE_COURSE.modules[1].title}

description: ${SAMPLE_COURSE.modules[1].description}

### ${SAMPLE_COURSE.modules[1].units[0].title}

type: ${SAMPLE_COURSE.modules[1].units[0].type}
durationMinutes: ${SAMPLE_COURSE.modules[1].units[0].durationMinutes}
description: ${SAMPLE_COURSE.modules[1].units[0].description}
`;
	const body = new TextEncoder().encode(text);
	return {
		body: body.buffer.slice(0, body.byteLength) as ArrayBuffer,
		mime: "text/markdown",
		filename: "course-template.md",
	};
}

function generateTxtTemplate(): TemplateResult {
	// TXT 模板与 MD 内容相同,只是扩展名不同
	const result = generateMdTemplate();
	return {
		...result,
		mime: "text/plain",
		filename: "course-template.txt",
	};
}

function generateXlsxTemplate(): TemplateResult {
	const headers = [
		"title",
		"stage",
		"level",
		"style",
		"audience",
		"intro",
		"price",
		"cover",
		"teacherId",
		"moduleName",
		"moduleDescription",
		"unitTitle",
		"unitType",
		"unitDurationMinutes",
		"unitDescription",
	];

	// 把示例课程展开为多行
	const rows: Record<string, string | number>[] = [];
	for (const mod of SAMPLE_COURSE.modules) {
		for (const unit of mod.units) {
			rows.push({
				title: SAMPLE_COURSE.title,
				stage: SAMPLE_COURSE.stage ?? "",
				level: SAMPLE_COURSE.level ?? "",
				style: SAMPLE_COURSE.style ?? "",
				audience: SAMPLE_COURSE.audience ?? "",
				intro: SAMPLE_COURSE.intro ?? "",
				price: SAMPLE_COURSE.price ?? 0,
				cover: "",
				teacherId: "",
				moduleName: mod.title,
				moduleDescription: mod.description ?? "",
				unitTitle: unit.title,
				unitType: unit.type ?? "video",
				unitDurationMinutes: unit.durationMinutes ?? 30,
				unitDescription: unit.description ?? "",
			});
		}
	}

	const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
	const wb = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(wb, ws, "课程模板");
	// SheetJS write with type:"buffer" returns Buffer (Uint8Array-compatible)
	const buf = XLSX.write(wb, {
		type: "buffer",
		bookType: "xlsx",
	}) as ArrayBuffer;
	return {
		body: buf,
		mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		filename: "course-template.xlsx",
	};
}
