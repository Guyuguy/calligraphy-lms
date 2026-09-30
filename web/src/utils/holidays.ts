// 2026 年中国大陆法定节假日 + 调休工作日表
// 依据国务院办公厅发布的 2026 年放假安排通知:
//
// 元旦:1/1(周四)-1/3(周六)放假调休,共 3 天。1/4(周日)上班。
// 春节:2/15(腊月二十八、周日)-2/23(正月初七、周一)放假调休,共 9 天。2/14(周六)、2/28(周六)上班。
// 清明节:4/4(周六)-4/6(周一)放假,共 3 天。
// 劳动节:5/1(周五)-5/5(周二)放假调休,共 5 天。5/9(周六)上班。
// 端午节:6/19(周五)-6/21(周日)放假,共 3 天。
// 中秋节:9/25(周五)-9/27(周日)放假,共 3 天。
// 国庆节:10/1(周四)-10/7(周三)放假调休,共 7 天。9/20(周日)、10/10(周六)上班。

export const HOLIDAYS_2026: Record<string, string> = {
	// 元旦 (1/1 周四 - 1/3 周六,共 3 天)
	"2026-01-01": "元旦",
	"2026-01-02": "元旦",
	"2026-01-03": "元旦",

	// 春节 (2/15 腊月二十八 周日 - 2/23 正月初七 周一,共 9 天)
	"2026-02-15": "春节",
	"2026-02-16": "春节",
	"2026-02-17": "春节",
	"2026-02-18": "春节",
	"2026-02-19": "春节",
	"2026-02-20": "春节",
	"2026-02-21": "春节",
	"2026-02-22": "春节",
	"2026-02-23": "春节",

	// 清明节 (4/4 周六 - 4/6 周一,共 3 天)
	"2026-04-04": "清明节",
	"2026-04-05": "清明节",
	"2026-04-06": "清明节",

	// 劳动节 (5/1 周五 - 5/5 周二,共 5 天)
	"2026-05-01": "劳动节",
	"2026-05-02": "劳动节",
	"2026-05-03": "劳动节",
	"2026-05-04": "劳动节",
	"2026-05-05": "劳动节",

	// 端午节 (6/19 周五 - 6/21 周日,共 3 天)
	"2026-06-19": "端午节",
	"2026-06-20": "端午节",
	"2026-06-21": "端午节",

	// 中秋节 (9/25 周五 - 9/27 周日,共 3 天)
	"2026-09-25": "中秋节",
	"2026-09-26": "中秋节",
	"2026-09-27": "中秋节",

	// 国庆节 (10/1 周四 - 10/7 周三,共 7 天)
	"2026-10-01": "国庆节",
	"2026-10-02": "国庆节",
	"2026-10-03": "国庆节",
	"2026-10-04": "国庆节",
	"2026-10-05": "国庆节",
	"2026-10-06": "国庆节",
	"2026-10-07": "国庆节",
};

// 调休上班日 (周末但需上班)
export const WORKDAYS_2026: Record<string, string> = {
	"2026-01-04": "元旦调休",
	"2026-02-14": "春节调休",
	"2026-02-28": "春节调休",
	"2026-05-09": "劳动节调休",
	"2026-09-20": "国庆节调休",
	"2026-10-10": "国庆节调休",
};

export function getHoliday(dateStr: string): string | null {
	return HOLIDAYS_2026[dateStr] ?? null;
}

export function isAdjustedWorkday(dateStr: string): boolean {
	return WORKDAYS_2026[dateStr] !== undefined;
}

// 判断某日是否为休息日 (周末且非调休上班日,或法定节假日)
export function isRestDay(dateStr: string): boolean {
	if (getHoliday(dateStr)) return true;
	const date = new Date(dateStr);
	const day = date.getDay(); // 0=Sun, 6=Sat
	const isWeekend = day === 0 || day === 6;
	return isWeekend && !isAdjustedWorkday(dateStr);
}

// 获取某日的特殊状态: holiday | adjustedWorkday | null
export function getDayStatus(dateStr: string): {
	type: "holiday" | "adjustedWorkday";
	name: string;
} | null {
	if (getHoliday(dateStr)) {
		return { type: "holiday", name: getHoliday(dateStr) as string };
	}
	if (isAdjustedWorkday(dateStr)) {
		return { type: "adjustedWorkday", name: WORKDAYS_2026[dateStr] };
	}
	return null;
}
