import { LogOut, Moon, Sun, User as UserIcon } from "lucide-react";
import type { User } from "@/api/client";
import { ROLE_LABELS } from "@/api/client";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";

interface TopbarProps {
	user: User;
	onLogout: () => void;
	onNavigate: (path: string) => void;
}

export function Topbar({ user, onLogout }: TopbarProps) {
	const { theme, toggle } = useTheme();
	return (
		<header className="flex h-14 items-center justify-between gap-2 border-b border-border bg-surface-1 px-3 pl-16 md:px-6 md:pl-6">
			<div className="hidden text-sm text-text-muted sm:block">
				欢迎回来，{user.name}
			</div>
			<div className="flex items-center gap-1.5 sm:gap-2">
				<NotificationBell
					onNavigateNotifications={() => {
						window.location.hash = "/notifications";
					}}
				/>
				<Button
					variant="ghost"
					size="icon"
					onClick={toggle}
					aria-label="切换主题"
				>
					{theme === "light" ? (
						<Moon className="size-4" />
					) : (
						<Sun className="size-4" />
					)}
				</Button>
				<div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 sm:px-3">
					<UserIcon className="size-4 shrink-0 text-brand" />
					<div className="text-sm">
						<span className="font-medium">{user.name}</span>
						<span className="ml-2 hidden text-xs text-text-muted sm:inline">
							{ROLE_LABELS[user.role]}
						</span>
					</div>
				</div>
				<Button
					variant="ghost"
					size="icon"
					onClick={onLogout}
					aria-label="退出登录"
				>
					<LogOut className="size-4" />
				</Button>
			</div>
		</header>
	);
}
