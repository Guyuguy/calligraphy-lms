import {
	BarChart3,
	BookOpen,
	Calendar,
	GraduationCap,
	HeartHandshake,
	LayoutDashboard,
	Menu,
	PenTool,
	Sparkles,
	Users,
	X,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { Role } from "@/api/client";
import { cn } from "@/lib/utils";

interface NavItem {
	label: string;
	path: string;
	icon: React.ComponentType<{ className?: string }>;
	roles?: Role[];
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
	const [mobileOpen, setMobileOpen] = useState(false);

	// 路由变化时关闭抽屉
	// biome-ignore lint/correctness/useExhaustiveDependencies: 路由变化时需要关闭抽屉
	useEffect(() => {
		setMobileOpen(false);
	}, [currentPath]);

	// 锁定背景滚动
	useEffect(() => {
		if (mobileOpen) {
			document.body.style.overflow = "hidden";
			return () => {
				document.body.style.overflow = "";
			};
		}
	}, [mobileOpen]);

	const items = NAV_ITEMS.filter(
		(item) => !item.roles || item.roles.includes(role),
	);

	const nav = (
		<nav className="flex-1 space-y-1 overflow-y-auto p-3">
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
							"flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-sm transition-colors",
							active
								? "bg-brand text-white shadow-sm"
								: "text-text-secondary hover:bg-surface-2 hover:text-text-primary",
						)}
					>
						<Icon className="size-4 shrink-0" />
						<span>{item.label}</span>
					</button>
				);
			})}
		</nav>
	);

	const brand = (
		<div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-5">
			<PenTool className="size-5 text-brand" />
			<span className="font-serif text-base font-semibold">墨韵书院</span>
		</div>
	);

	const footer = (
		<div className="border-t border-border p-3 text-xs text-text-muted">
			<div className="px-3 py-2">
				<div className="font-medium text-text-secondary">硬笔书法 LMS</div>
				<div className="mt-0.5">v0.1 · MVP</div>
			</div>
		</div>
	);

	return (
		<>
			{/* 桌面端：固定侧边栏 */}
			<aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-surface-1 md:flex">
				{brand}
				{nav}
				{footer}
			</aside>

			{/* 手机端：汉堡按钮 + 抽屉 */}
			<button
				type="button"
				onClick={() => setMobileOpen(true)}
				className="fixed left-3 top-3 z-30 flex size-10 items-center justify-center rounded-md border border-border bg-surface-1 shadow-sm md:hidden"
				aria-label="打开菜单"
			>
				<Menu className="size-5" />
			</button>

			{/* 抽屉遮罩 */}
			{mobileOpen && (
				<button
					type="button"
					className="fixed inset-0 z-40 block bg-black/40 backdrop-blur-sm md:hidden"
					onClick={() => setMobileOpen(false)}
					aria-label="关闭菜单"
				/>
			)}

			{/* 手机端抽屉 */}
			<aside
				className={cn(
					"fixed inset-y-0 left-0 z-50 flex w-64 max-w-[85vw] flex-col border-r border-border bg-surface-1 shadow-xl transition-transform duration-200 md:hidden",
					mobileOpen ? "translate-x-0" : "-translate-x-full",
				)}
			>
				<div className="relative">
					{brand}
					<button
						type="button"
						onClick={() => setMobileOpen(false)}
						className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-text-muted hover:bg-surface-2"
						aria-label="关闭菜单"
					>
						<X className="size-4" />
					</button>
				</div>
				{nav}
				{footer}
			</aside>
		</>
	);
}
