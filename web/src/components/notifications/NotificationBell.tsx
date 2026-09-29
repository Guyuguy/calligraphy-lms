import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { api, NOTIFICATION_TYPE_LABELS, type Notification } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NotificationBellProps {
	onNavigateNotifications: () => void;
}

function formatTime(iso: string): string {
	const d = new Date(iso);
	const now = new Date();
	const diffMs = now.getTime() - d.getTime();
	const diffMin = Math.floor(diffMs / 60000);
	if (diffMin < 1) return "刚刚";
	if (diffMin < 60) return `${diffMin} 分钟前`;
	const diffHour = Math.floor(diffMin / 60);
	if (diffHour < 24) return `${diffHour} 小时前`;
	const diffDay = Math.floor(diffHour / 24);
	if (diffDay < 7) return `${diffDay} 天前`;
	return d.toLocaleDateString("zh-CN");
}

export function NotificationBell({
	onNavigateNotifications,
}: NotificationBellProps) {
	const [unread, setUnread] = useState(0);
	const [recent, setRecent] = useState<Notification[]>([]);
	const [open, setOpen] = useState(false);

	// 轮询未读数
	useEffect(() => {
		const fetchUnread = () => {
			api
				.get<{ count: number }>("/notifications/unread-count")
				.then((res) => setUnread(res.count))
				.catch(() => {});
		};
		fetchUnread();
		const timer = setInterval(fetchUnread, 30000);
		return () => clearInterval(timer);
	}, []);

	// 打开下拉时拉取最近 5 条
	useEffect(() => {
		if (!open) return;
		api
			.get<{ notifications: Notification[] }>("/notifications?limit=5")
			.then((res) => setRecent(res.notifications))
			.catch(() => {});
	}, [open]);

	const markRead = async (id: string) => {
		await api.post(`/notifications/${id}/read`);
		setRecent((prev) =>
			prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
		);
		setUnread((u) => Math.max(0, u - 1));
	};

	return (
		<DropdownMenu.Root open={open} onOpenChange={setOpen}>
			<DropdownMenu.Trigger asChild>
				<Button
					variant="ghost"
					size="icon"
					aria-label="通知"
					className="relative"
				>
					<Bell className="size-4" />
					{unread > 0 && (
						<span
							className={cn(
								"absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center",
								"rounded-full bg-status-error text-[10px] font-medium text-white",
							)}
						>
							{unread > 9 ? "9+" : unread}
						</span>
					)}
				</Button>
			</DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content
					align="end"
					sideOffset={8}
					className={cn(
						"w-80 rounded-md border border-border bg-surface-1 p-1 shadow-md",
						"z-50 outline-none",
					)}
				>
					<div className="flex items-center justify-between px-3 py-2 text-xs text-text-muted">
						<span>通知</span>
						{unread > 0 && (
							<button
								type="button"
								className="text-brand hover:underline"
								onClick={() => {
									api.post("/notifications/read-all").then(() => {
										setUnread(0);
										setRecent((prev) =>
											prev.map((n) => ({ ...n, read: true })),
										);
									});
								}}
							>
								全部已读
							</button>
						)}
					</div>
					<DropdownMenu.Separator className="my-1 h-px bg-border" />
					{recent.length === 0 ? (
						<div className="px-3 py-6 text-center text-xs text-text-muted">
							暂无通知
						</div>
					) : (
						recent.map((n) => (
							<DropdownMenu.Item
								key={n.id}
								onSelect={() => {
									if (!n.read) markRead(n.id);
								}}
								className={cn(
									"flex cursor-pointer flex-col gap-1 rounded-sm px-3 py-2 text-sm outline-none",
									"data-[highlighted]:bg-surface-2",
									!n.read && "bg-brand/5",
								)}
							>
								<div className="flex items-center justify-between gap-2">
									<div className="flex items-center gap-2">
										{!n.read && (
											<span className="size-1.5 shrink-0 rounded-full bg-brand" />
										)}
										<span className="font-medium">{n.title}</span>
									</div>
									<Badge variant="outline" className="text-[10px]">
										{NOTIFICATION_TYPE_LABELS[n.type]}
									</Badge>
								</div>
								<div className="line-clamp-2 text-xs text-text-muted">
									{n.body}
								</div>
								<div className="text-[10px] text-text-muted">
									{formatTime(n.createdAt)}
								</div>
							</DropdownMenu.Item>
						))
					)}
					<DropdownMenu.Separator className="my-1 h-px bg-border" />
					<DropdownMenu.Item
						onSelect={() => {
							setOpen(false);
							onNavigateNotifications();
						}}
						className="cursor-pointer rounded-sm px-3 py-2 text-center text-sm text-brand outline-none data-[highlighted]:bg-surface-2"
					>
						查看全部
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>
	);
}
