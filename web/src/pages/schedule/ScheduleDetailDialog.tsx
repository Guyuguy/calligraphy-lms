import { Calendar, Clock, GraduationCap, MapPin, Users } from "lucide-react";
import type { ComponentType } from "react";
import {
	LEVEL_LABELS,
	SCHEDULE_MODE_LABELS,
	type Schedule,
	STAGE_LABELS,
} from "@/api/client";
import { Badge } from "@/components/ui/badge";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

const WEEKDAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

interface ScheduleDetailDialogProps {
	schedule: Schedule | null;
	onClose: () => void;
}

export function ScheduleDetailDialog({
	schedule,
	onClose,
}: ScheduleDetailDialogProps) {
	return (
		<Dialog open={schedule !== null} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="sm:max-w-md">
				{schedule && <Body schedule={schedule} />}
			</DialogContent>
		</Dialog>
	);
}

function Body({ schedule }: { schedule: Schedule }) {
	const weekdayLabel = WEEKDAYS[schedule.weekday - 1] ?? "";
	const timeRange = `${String(schedule.startHour).padStart(2, "0")}:00 - ${String(schedule.endHour).padStart(2, "0")}:00`;

	return (
		<>
			<DialogHeader>
				<DialogTitle>{schedule.courseTitle}</DialogTitle>
				<DialogDescription>
					{weekdayLabel} · {timeRange}
				</DialogDescription>
			</DialogHeader>

			<div className="space-y-3">
				{schedule.courseCover && (
					<img
						src={schedule.courseCover}
						alt={schedule.courseTitle}
						className="h-32 w-full rounded-md object-cover"
					/>
				)}

				<div className="flex flex-wrap gap-2">
					{schedule.stage && (
						<Badge variant="outline">{STAGE_LABELS[schedule.stage]}</Badge>
					)}
					{schedule.level && (
						<Badge variant="outline">{LEVEL_LABELS[schedule.level]}</Badge>
					)}
					<Badge variant="info">{SCHEDULE_MODE_LABELS[schedule.mode]}</Badge>
				</div>

				<div className="space-y-2 text-sm">
					<InfoRow
						icon={GraduationCap}
						label="主讲教师"
						value={schedule.teacherName ?? "-"}
					/>
					<InfoRow
						icon={MapPin}
						label="教室"
						value={
							schedule.classroomLocation
								? `${schedule.classroomName}（${schedule.classroomLocation}）`
								: (schedule.classroomName ?? "-")
						}
					/>
					<InfoRow
						icon={Users}
						label="报名人数"
						value={`${schedule.studentCount ?? 0} 人`}
					/>
					<InfoRow
						icon={Calendar}
						label="起止日期"
						value={`${schedule.startDate} 至 ${schedule.endDate}`}
					/>
					<InfoRow
						icon={Clock}
						label="上课时间"
						value={`${weekdayLabel} ${timeRange}`}
					/>
				</div>
			</div>
		</>
	);
}

function InfoRow({
	icon: Icon,
	label,
	value,
}: {
	icon: ComponentType<{ className?: string }>;
	label: string;
	value: string;
}) {
	return (
		<div className="flex items-start gap-3">
			<Icon className="mt-0.5 size-4 text-text-muted" />
			<span className="w-20 text-text-muted">{label}</span>
			<span className="flex-1">{value}</span>
		</div>
	);
}
