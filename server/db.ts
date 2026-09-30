// 内存数据库 + 种子数据
// MVP 阶段使用 Map 存储，重启丢失。V1 阶段迁移到 SQLite。

import type {
	Annotation,
	Artwork,
	Assignment,
	Classroom,
	Course,
	Evaluation,
	Level,
	Notification,
	Order,
	ParentProfile,
	Payment,
	PracticeDay,
	Progress,
	Schedule,
	SkillRadarSnapshot,
	Stage,
	StudentProfile,
	Style,
	Submission,
	TeacherProfile,
	User,
} from "./types";

// ============================================================
// 存储容器
// ============================================================

export const users = new Map<string, User>();
export const studentProfiles = new Map<string, StudentProfile>();
export const teacherProfiles = new Map<string, TeacherProfile>();
export const parentProfiles = new Map<string, ParentProfile>();
export const courses = new Map<string, Course>();
export const schedules = new Map<string, Schedule>();
export const classrooms = new Map<string, Classroom>();
export const progress = new Map<string, Progress>(); // key: studentId:unitId
export const skillRadarSnapshots = new Map<string, SkillRadarSnapshot>();
export const practiceDays = new Map<string, PracticeDay>(); // key: studentId:date
export const assignments = new Map<string, Assignment>();
export const submissions = new Map<string, Submission>();
export const artworks = new Map<string, Artwork>();
export const annotations = new Map<string, Annotation>();
export const evaluations = new Map<string, Evaluation>();
export const notifications = new Map<string, Notification>();
export const payments = new Map<string, Payment>();

// 支付订单(下单记录,支付成功后转为 Payment 或直接 enroll)
export const orders = new Map<string, Order>();
export const audioRecords = new Map<
	string,
	{ mime: string; data: Uint8Array }
>();

// 作品图片存储（MVP 内存存储，生产环境应使用对象存储/文件系统）
export const imageRecords = new Map<
	string,
	{ mime: string; data: Uint8Array }
>();

// 视频文件存储（MVP 内存存储，生产环境应使用对象存储/文件系统）
export const videoRecords = new Map<
	string,
	{ mime: string; data: Uint8Array; courseId: string; unitId: string }
>();

// ============================================================
// 工具
// ============================================================

export function uid(prefix: string): string {
	return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

// ============================================================
// 种子数据
// ============================================================

function seedUsers() {
	const now = new Date().toISOString();

	const admin: User = {
		id: "user_admin",
		role: "admin",
		username: "admin",
		password: "pass123",
		name: "系统管理员",
		email: "admin@calligraphy.edu",
		phone: "13800000000",
		createdAt: now,
	};
	users.set(admin.id, admin);

	const academicHead: User = {
		id: "user_academic",
		role: "academic_head",
		username: "academic",
		password: "pass123",
		name: "教务主管",
		email: "academic@calligraphy.edu",
		phone: "13800000001",
		createdAt: now,
	};
	users.set(academicHead.id, academicHead);

	// 8 名教师
	const teacherData: Array<{
		name: string;
		stages: Stage[];
		styles: Style[];
		years: number;
		bio: string;
	}> = [
		{
			name: "王羲之",
			stages: ["kaishu", "xingshu"],
			styles: ["ou", "yan"],
			years: 15,
			bio: "中国书法家协会会员，专攻二王书风",
		},
		{
			name: "颜真卿",
			stages: ["kaishu"],
			styles: ["yan"],
			years: 20,
			bio: "颜体传承人，注重笔力与结构",
		},
		{
			name: "柳公权",
			stages: ["kaishu"],
			styles: ["liu"],
			years: 18,
			bio: "柳体专家，骨力道健",
		},
		{
			name: "赵孟頫",
			stages: ["kaishu", "xingshu"],
			styles: ["zhao"],
			years: 12,
			bio: "赵体圆润秀美，适合初学者",
		},
		{
			name: "宋徽宗",
			stages: ["kaishu"],
			styles: ["shoujin"],
			years: 10,
			bio: "瘦金体研究学者",
		},
		{
			name: "启功",
			stages: ["kaishu", "xingshu"],
			styles: ["modern"],
			years: 25,
			bio: "现代硬笔书法奠基人之一",
		},
		{
			name: "田英章",
			stages: ["kaishu"],
			styles: ["modern"],
			years: 30,
			bio: "欧体楷书现代化教学代表",
		},
		{
			name: "庞中华",
			stages: ["kaishu", "kuaiXie"],
			styles: ["modern"],
			years: 28,
			bio: "硬笔书法普及教育推广者",
		},
	];

	teacherData.forEach((t, i) => {
		const id = `user_teacher_${String(i + 1).padStart(2, "0")}`;
		const username = `teacher${String(i + 1).padStart(2, "0")}`;
		const u: User = {
			id,
			role: "teacher",
			username,
			password: "pass123",
			name: t.name,
			email: `${username}@calligraphy.edu`,
			phone: `1380000${String(1000 + i)}`,
			createdAt: now,
		};
		users.set(u.id, u);

		const profile: TeacherProfile = {
			userId: id,
			stages: t.stages,
			bio: t.bio,
			qualifications: `中国书法家协会会员，${t.years}年教学经验`,
			teachingYears: t.years,
			availability: [
				{ weekday: 1, startHour: 9, endHour: 12 },
				{ weekday: 1, startHour: 14, endHour: 17 },
				{ weekday: 3, startHour: 9, endHour: 12 },
				{ weekday: 5, startHour: 18, endHour: 21 },
				{ weekday: 6, startHour: 9, endHour: 12 },
			],
			workloadHoursPerWeek: 8 + i * 2,
			rating: 4.5 + (i % 5) * 0.1,
			studentCount: 15 + i * 3,
		};
		teacherProfiles.set(id, profile);
	});

	// 20 名学生
	const surnames = [
		"张",
		"李",
		"王",
		"赵",
		"刘",
		"陈",
		"杨",
		"黄",
		"周",
		"吴",
		"徐",
		"孙",
		"马",
		"朱",
		"胡",
		"林",
		"郭",
		"何",
		"高",
		"罗",
	];
	const givenNames = [
		"小明",
		"小红",
		"小华",
		"小亮",
		"小芳",
		"小军",
		"小丽",
		"小强",
		"小燕",
		"小磊",
		"晓东",
		"晓楠",
		"晓宇",
		"晓雯",
		"子轩",
		"子涵",
		"梓豪",
		"梓萱",
		"雨欣",
		"雨桐",
	];
	const schools = ["阳光小学", "育才中学", "实验高中", "文德书院", "墨池学堂"];
	const goals: Array<
		"interest" | "grade_exam" | "competition" | "daily_writing"
	> = ["interest", "grade_exam", "competition", "daily_writing"];
	const stages: Array<"kaishu" | "xingshu" | "lishu" | "kuaiXie"> = [
		"kaishu",
		"xingshu",
		"lishu",
		"kuaiXie",
	];
	const levels: Array<"L1" | "L2" | "L3" | "L4" | "L5" | "L6"> = [
		"L1",
		"L2",
		"L3",
		"L4",
		"L5",
		"L6",
	];
	const stylesArr: Array<"ou" | "yan" | "liu" | "zhao" | "shoujin" | "modern"> =
		["ou", "yan", "liu", "zhao", "shoujin", "modern"];

	for (let i = 0; i < 20; i++) {
		const id = `user_student_${String(i + 1).padStart(2, "0")}`;
		const username = `student${String(i + 1).padStart(2, "0")}`;
		const u: User = {
			id,
			role: "student",
			username,
			password: "pass123",
			name: `${surnames[i]}${givenNames[i]}`,
			email: `${username}@student.calligraphy.edu`,
			phone: `1390000${String(2000 + i)}`,
			createdAt: now,
		};
		users.set(u.id, u);

		const profile: StudentProfile = {
			userId: id,
			grade: `${3 + (i % 9)}年级`,
			school: schools[i % schools.length],
			parentIds: [],
			currentStage: stages[i % stages.length],
			currentLevel: levels[i % levels.length],
			handedness: i % 8 === 0 ? "left" : "right",
			learningGoal: goals[i % goals.length],
			preferredStyles: [
				stylesArr[i % stylesArr.length],
				stylesArr[(i + 2) % stylesArr.length],
			],
			skillRadar: {
				strokes: 40 + (i % 6) * 10,
				structure: 35 + (i % 7) * 8,
				layout: 30 + (i % 5) * 10,
				speed: 45 + (i % 4) * 8,
				stability: 38 + (i % 8) * 7,
			},
			totalPracticeMinutes: 200 + i * 35,
			streakDays: i % 14,
		};
		studentProfiles.set(id, profile);
	}

	// 5 名家长
	for (let i = 0; i < 5; i++) {
		const id = `user_parent_${String(i + 1).padStart(2, "0")}`;
		const username = `parent${String(i + 1).padStart(2, "0")}`;
		const u: User = {
			id,
			role: "parent",
			username,
			password: "pass123",
			name: `${surnames[i]}先生/女士`,
			email: `${username}@parent.calligraphy.edu`,
			phone: `1370000${String(3000 + i)}`,
			createdAt: now,
		};
		users.set(u.id, u);

		const childIds = [
			`user_student_${String(i * 4 + 1).padStart(2, "0")}`,
			`user_student_${String(i * 4 + 2).padStart(2, "0")}`,
		];
		parentProfiles.set(id, { userId: id, childIds });

		// 反向关联到学生
		for (const cid of childIds) {
			const sp = studentProfiles.get(cid);
			if (sp) sp.parentIds.push(id);
		}
	}
}

function seedCourses() {
	const now = new Date().toISOString();
	const teacherIds = Array.from(teacherProfiles.keys());

	const courseTemplates: Array<{
		title: string;
		stage: Stage;
		level: Level;
		style: Style;
		audience: string;
		teacherIdx: number;
		units: number;
	}> = [
		{
			title: "硬笔楷书启蒙 — 坐姿握笔与基本笔画",
			stage: "kaishu",
			level: "L1",
			style: "modern",
			audience: "零基础 6 岁以上",
			teacherIdx: 6,
			units: 8,
		},
		{
			title: "硬笔楷书基础 — 永字八法精讲",
			stage: "kaishu",
			level: "L2",
			style: "modern",
			audience: "已掌握基本笔画",
			teacherIdx: 7,
			units: 12,
		},
		{
			title: "欧体楷书三十字精讲",
			stage: "kaishu",
			level: "L3",
			style: "ou",
			audience: "L2 以上学员",
			teacherIdx: 0,
			units: 15,
		},
		{
			title: "颜体楷书结构与章法",
			stage: "kaishu",
			level: "L4",
			style: "yan",
			audience: "L3 以上学员",
			teacherIdx: 1,
			units: 16,
		},
		{
			title: "柳体楷书 — 骨力道健",
			stage: "kaishu",
			level: "L4",
			style: "liu",
			audience: "L3 以上学员",
			teacherIdx: 2,
			units: 14,
		},
		{
			title: "赵体楷书 — 圆润秀美",
			stage: "kaishu",
			level: "L4",
			style: "zhao",
			audience: "L3 以上学员",
			teacherIdx: 3,
			units: 14,
		},
		{
			title: "瘦金体入门 — 钢笔亦能写瘦金",
			stage: "kaishu",
			level: "L5",
			style: "shoujin",
			audience: "L4 以上学员",
			teacherIdx: 4,
			units: 12,
		},
		{
			title: "硬笔楷书章法与创作",
			stage: "kaishu",
			level: "L6",
			style: "modern",
			audience: "L5 以上学员",
			teacherIdx: 5,
			units: 10,
		},
		{
			title: "硬笔行书入门 — 连笔规律",
			stage: "xingshu",
			level: "L3",
			style: "modern",
			audience: "楷书 L3 以上",
			teacherIdx: 0,
			units: 12,
		},
		{
			title: "硬笔行书提高 — 节奏与气韵",
			stage: "xingshu",
			level: "L5",
			style: "modern",
			audience: "行书 L3 以上",
			teacherIdx: 5,
			units: 14,
		},
		{
			title: "硬笔隶书 — 蚕头燕尾之美",
			stage: "lishu",
			level: "L3",
			style: "modern",
			audience: "楷书 L3 以上",
			teacherIdx: 3,
			units: 12,
		},
		{
			title: "实用快写 — 日常书写提速",
			stage: "kuaiXie",
			level: "L2",
			style: "modern",
			audience: "中学生及成人",
			teacherIdx: 7,
			units: 8,
		},
	];

	courseTemplates.forEach((c, i) => {
		const id = `course_${String(i + 1).padStart(3, "0")}`;
		const teacherId = teacherIds[c.teacherIdx];

		// 生成 3-4 个模块，每个模块 3-5 个单元
		const moduleCount = Math.min(4, Math.ceil(c.units / 4));
		const modules = [];
		let unitOrder = 0;
		for (let m = 0; m < moduleCount; m++) {
			const moduleId = `${id}_mod_${m + 1}`;
			const unitsPerModule = Math.ceil(c.units / moduleCount);
			const units = [];
			for (let u = 0; u < unitsPerModule; u++) {
				const unitId = `${moduleId}_u_${u + 1}`;
				const unitTypes: Array<
					"video" | "stroke_lesson" | "tracing_exercise" | "assignment" | "quiz"
				> = [
					"video",
					"stroke_lesson",
					"tracing_exercise",
					"assignment",
					"quiz",
				];
				units.push({
					id: unitId,
					moduleId,
					title: `第 ${m + 1} 章 第 ${u + 1} 节 — ${["讲解", "示范", "临摹", "作业", "测验"][u % 5]}`,
					type: unitTypes[u % unitTypes.length],
					description: "本节聚焦笔画与结构的细节训练。",
					order: unitOrder++,
					durationMinutes: 30 + (u % 3) * 10,
					completionCriteria: {
						watchSeconds: u === 0 ? 1800 : undefined,
						minSubmissions: u === 3 ? 1 : undefined,
						minQuizScore: u === 4 ? 60 : undefined,
					},
				});
			}
			modules.push({
				id: moduleId,
				courseId: id,
				title: `第 ${m + 1} 章 — ${["基础", "进阶", "应用", "创作"][m % 4]}`,
				description: "本章循序渐进，从原理到实践。",
				order: m,
				units,
			});
		}

		const course: Course = {
			id,
			title: c.title,
			stage: c.stage,
			level: c.level,
			style: c.style,
			audience: c.audience,
			cover: `https://placehold.co/600x400/c96442/efeee9?text=${encodeURIComponent(c.title.slice(0, 6))}`,
			intro: `${c.title}。本课程共 ${c.units} 节，由 ${teacherProfiles.get(teacherId)?.bio ?? ""} 主讲。`,
			teacherId,
			prerequisites:
				i > 0 ? [`course_${String(Math.max(1, i)).padStart(3, "0")}`] : [],
			totalUnits: c.units,
			enrolledCount: 5 + ((i * 7) % 30),
			rating: 4.3 + (i % 6) * 0.1,
			price: 199 + i * 50,
			modules,
			status: "published",
			createdAt: now,
		};
		courses.set(id, course);
	});
}

function seedClassrooms() {
	const rooms = [
		{ name: "墨韵厅", capacity: 12, location: "一层 A101" },
		{ name: "兰亭教室", capacity: 20, location: "一层 A102" },
		{ name: "羲之堂", capacity: 30, location: "二层 B201" },
		{ name: "云直播 1 号厅", capacity: 100, location: "线上" },
	];
	rooms.forEach((r, i) => {
		const id = `classroom_${String(i + 1).padStart(2, "0")}`;
		classrooms.set(id, { id, ...r });
	});
}

function seedSchedules() {
	const courseList = Array.from(courses.values());
	const _teacherIds = Array.from(teacherProfiles.keys());
	const classroomIds = Array.from(classrooms.keys());
	const studentIds = Array.from(studentProfiles.keys());

	// 给前 8 门课各排 1-2 节课
	courseList.slice(0, 8).forEach((c, i) => {
		const weekday = (i % 6) + 1; // 周一到周六
		const startHour = 9 + (i % 4) * 2;
		const schId = `schedule_${String(i + 1).padStart(3, "0")}`;
		const studentSlice = studentIds.slice(i * 2, i * 2 + 8);
		schedules.set(schId, {
			id: schId,
			courseId: c.id,
			teacherId: c.teacherId,
			classroomId: classroomIds[i % classroomIds.length],
			weekday,
			startHour,
			endHour: startHour + 2,
			mode:
				i % 3 === 0
					? "one_on_one"
					: i % 3 === 1
						? "small_group"
						: "fixed_class",
			startDate: "2026-09-01",
			endDate: "2026-12-31",
			studentIds: studentSlice,
		});
	});
}

function seedProgress() {
	const studentIds = Array.from(studentProfiles.keys());
	const courseList = Array.from(courses.values());

	// 给每个学生在前 4 门课生成进度
	studentIds.forEach((sid, idx) => {
		const coursesForStudent = courseList.slice(idx % 3, (idx % 3) + 4);
		coursesForStudent.forEach((c) => {
			const allUnits = c.modules.flatMap((m) => m.units);
			allUnits.forEach((u, ui) => {
				const key = `${sid}:${u.id}`;
				// 70% 完成、20% 进行中、10% 未开始
				const rand = (idx + ui) % 10;
				const status =
					rand < 7 ? "completed" : rand < 9 ? "in_progress" : "not_started";
				const percent =
					status === "completed"
						? 100
						: status === "in_progress"
							? 30 + ((ui * 7) % 60)
							: 0;
				progress.set(key, {
					studentId: sid,
					unitId: u.id,
					courseId: c.id,
					status,
					percent,
					lastActivityAt: new Date(Date.now() - ui * 86400000).toISOString(),
					videoWatchedSeconds:
						status === "completed" ? 1800 : status === "in_progress" ? 600 : 0,
					practiceCount:
						status === "completed" ? 3 : status === "in_progress" ? 1 : 0,
					submissionCount: status === "completed" ? 1 : 0,
					quizScore: status === "completed" ? 70 + ((ui * 5) % 25) : null,
				});
			});
		});

		// 打卡热力图 — 过去 90 天随机生成
		for (let d = 0; d < 90; d++) {
			const date = new Date(Date.now() - d * 86400000)
				.toISOString()
				.slice(0, 10);
			const rand = (idx + d) % 7;
			if (rand < 4) {
				practiceDays.set(`${sid}:${date}`, {
					studentId: sid,
					date,
					minutes: 15 + ((idx + d) % 4) * 15,
				});
			}
		}
	});
}

function seedAssignmentsAndSubmissions() {
	const courseList = Array.from(courses.values());
	const studentIds = Array.from(studentProfiles.keys());

	// 给每门课的前 2 个作业型单元创建 Assignment
	courseList.forEach((c) => {
		const assignmentUnits = c.modules
			.flatMap((m) => m.units)
			.filter((u) => u.type === "assignment")
			.slice(0, 2);
		assignmentUnits.forEach((u, ai) => {
			const aid = `asg_${c.id}_${ai}`;
			assignments.set(aid, {
				id: aid,
				unitId: u.id,
				courseId: c.id,
				title: `${c.title.slice(0, 8)} — 作业 ${ai + 1}`,
				description: "请按本节所学笔画与结构，临摹范字 10 遍并提交最佳作品。",
				dueAt: new Date(Date.now() + (ai + 1) * 7 * 86400000).toISOString(),
				totalScore: 100,
			});

			// 给部分学生提交
			const subStudentIds = studentIds.slice(0, 6);
			subStudentIds.forEach((sid, si) => {
				const subId = `sub_${aid}_${si}`;
				submissions.set(subId, {
					id: subId,
					assignmentId: aid,
					studentId: sid,
					content: "已完成临摹，请老师批改。",
					imageUrl: `https://placehold.co/800x1000/efeee9/c96442?text=作品+${sid.slice(-2)}`,
					submittedAt: new Date(Date.now() - si * 3600000).toISOString(),
					version: 1,
					score: null,
					teacherComment: undefined,
				});
			});
		});
	});
}

function seedArtworks() {
	const studentIds = Array.from(studentProfiles.keys());
	studentIds.forEach((sid, i) => {
		for (let k = 0; k < 3; k++) {
			const aid = `art_${sid.slice(-2)}_${k}`;
			artworks.set(aid, {
				id: aid,
				studentId: sid,
				title: `作品 ${k + 1}`,
				imageUrl: `https://placehold.co/800x1000/efeee9/c96442?text=${sid.slice(-2)}-${k + 1}`,
				createdAt: new Date(Date.now() - (i * 3 + k) * 86400000).toISOString(),
				isFeatured: k === 0,
			});
		}
	});
}

function seedPayments() {
	const now = Date.now();
	const DAY = 86400000;
	for (const [parentId, pp] of parentProfiles.entries()) {
		const childId = pp.childIds[0];
		if (!childId) continue;
		// 1 已支付
		const payId1 = `pay_${parentId.slice(-2)}_1`;
		payments.set(payId1, {
			id: payId1,
			studentId: childId,
			parentId,
			title: "秋季班学费（第一期）",
			amount: 1280,
			dueAt: new Date(now - 7 * DAY).toISOString(),
			status: "paid",
			createdAt: new Date(now - 14 * DAY).toISOString(),
			paidAt: new Date(now - 8 * DAY).toISOString(),
		});
		// 1 待支付（7 天后到期）
		const payId2 = `pay_${parentId.slice(-2)}_2`;
		payments.set(payId2, {
			id: payId2,
			studentId: childId,
			parentId,
			title: "秋季班学费（第二期）",
			amount: 1280,
			dueAt: new Date(now + 7 * DAY).toISOString(),
			status: "pending",
			createdAt: new Date(now - 1 * DAY).toISOString(),
		});
		// 1 逾期（3 天前到期）
		const payId3 = `pay_${parentId.slice(-2)}_3`;
		payments.set(payId3, {
			id: payId3,
			studentId: childId,
			parentId,
			title: "教材资料费",
			amount: 260,
			dueAt: new Date(now - 3 * DAY).toISOString(),
			status: "overdue",
			createdAt: new Date(now - 10 * DAY).toISOString(),
		});
	}
}

function seedNotifications() {
	const now = new Date().toISOString();
	// 为每位家长生成缴费提醒 + 欢迎
	for (const [parentId, pp] of parentProfiles.entries()) {
		const childId = pp.childIds[0];
		if (!childId) continue;
		const payNotifId = `notif_pay_${parentId.slice(-2)}`;
		notifications.set(payNotifId, {
			id: payNotifId,
			userId: parentId,
			type: "payment_due",
			title: "缴费提醒",
			body: `您孩子 ${users.get(childId)?.name ?? ""} 的秋季班第二期学费将于 7 天内到期，请及时缴费。`,
			read: false,
			createdAt: now,
		});
		const welcomeNotifId = `notif_welcome_${parentId.slice(-2)}`;
		notifications.set(welcomeNotifId, {
			id: welcomeNotifId,
			userId: parentId,
			type: "class_reminder",
			title: "欢迎使用墨韵书院",
			body: "家长端已开通，您可以在此查看孩子的学习进度、缴费记录并提交对教师的评价。",
			read: false,
			createdAt: now,
		});
	}
	// 为第一名学生生成样本课前提醒
	const studentNotifId = `notif_class_student_01`;
	notifications.set(studentNotifId, {
		id: studentNotifId,
		userId: "user_student_01",
		type: "class_reminder",
		title: "课前提醒",
		body: "您明天 09:00 有《楷书入门 — 基本笔画》课程，请提前 10 分钟进入教室。",
		read: false,
		createdAt: now,
	});
}

export function initDb() {
	seedUsers();
	seedCourses();
	seedClassrooms();
	seedSchedules();
	seedProgress();
	seedAssignmentsAndSubmissions();
	seedArtworks();
	seedPayments();
	seedNotifications();
	console.log(
		`[db] seeded: ${users.size} users, ${courses.size} courses, ${schedules.size} schedules, ${progress.size} progress records, ${payments.size} payments, ${notifications.size} notifications`,
	);
}
