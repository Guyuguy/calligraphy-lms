import {
	BarChart3,
	BookOpen,
	Calendar,
	GraduationCap,
	HeartHandshake,
	LayoutDashboard,
	PenTool,
	Sparkles,
	Users,
} from "lucide-react";
import type { Role } from "@/api/client";
import { cn } from "@/lib/utils";

interface NavItem {
	label: string;
	path: string;
	icon: React.ComponentType<{ className?: string }>;
	roles?: Role[]; // 不指定则所有角色可见
}

const NAV_ITEMS: NavItem[] = [
	{ label: "工作台", path: "/", icon: LayoutDashboard },
	{
		label: "课程推荐",
		path: "/recommend",
		icon: Sparkles,
		roles: ["student", "parent"],
	},
	{ label: "课程管理", path: "/courses", icon: BookOpen },
	{ label: "排课表", path: "/schedule", icon: Calendar },
	{
		label: "学生管理",
		path: "/students",
		icon: GraduationCap,
		roles: ["admin", "academic_head", "teacher", "ta"],
	},
	{
		label: "教师管理",
		path: "/teachers",
		icon: Users,
		roles: ["admin", "academic_head"],
	},
	{
		label: "学习进度",
		path: "/progress",
		icon: BarChart3,
		roles: ["student", "parent", "teacher"],
	},
	{
		label: "家长中心",
		path: "/parent",
		icon: HeartHandshake,
		roles: ["parent"],
	},
	{
		label: "教学进度",
		path: "/teaching",
		icon: PenTool,
		roles: ["teacher", "academic_head", "admin"],
	},
];

interface SidebarProps {
	currentPath: string;
	onNavigate: (path: string) => void;
	role: Role;
}

export function Sidebar({ currentPath, onNavigate, role }: SidebarProps) {
	const items = NAV_ITEMS.filter(
		(item) => !item.roles || item.roles.includes(role),
	);

	return (
		<aside className="flex w-56 flex-col border-r border-border bg-surface-1">
			<div className="flex h-14 items-center gap-2 border-b border-border px-5">
				<PenTool className="size-5 text-brand" />
				<span className="font-serif text-base font-semibold">墨韵书院</span>
			</div>
			<nav className="flex-1 space-y-1 p-3">
				{items.map((item) => {
					const Icon = item.icon;
					const active =
						currentPath === item.path ||
						(item.path !== "/" && currentPath.startsWith(item.path));
					return (
						<button
							key={item.path}
							type="button"
							onClick={() => onNavigate(item.path)}
							className={cn(
								"flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
								active
									? "bg-brand text-white shadow-sm"
									: "text-text-secondary hover:bg-surface-2 hover:text-text-primary",
							)}
						>
							<Icon className="size-4" />
							<span>{item.label}</span>
						</button>
					);
				})}
			</nav>
			<div className="border-t border-border p-3 text-xs text-text-muted">
				<div className="px-3 py-2">
					<div className="font-medium text-text-secondary">硬笔书法 LMS</div>
					<div className="mt-0.5">v0.1 · MVP</div>
				</div>
			</div>
		</aside>
	);
}
