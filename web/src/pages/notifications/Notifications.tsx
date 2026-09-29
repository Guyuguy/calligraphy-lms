import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api, NOTIFICATION_TYPE_LABELS, type Notification } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatTime(iso: string): string {
	const d = new Date(iso);
	return d.toLocaleString("zh-CN", {
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	});
}

export function Notifications() {
	const [list, setList] = useState<Notification[]>([]);
	const [filter, setFilter] = useState<"all" | "unread">("all");
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		setLoading(true);
		const q = filter === "unread" ? "?read=false" : "";
		api
			.get<{ notifications: Notification[] }>(`/notifications${q}`)
			.then((res) => setList(res.notifications))
			.catch(() => setList([]))
			.finally(() => setLoading(false));
	}, [filter]);

	const markRead = async (id: string) => {
		await api.post(`/notifications/${id}/read`);
		setList((prev) =>
			prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
		);
	};

	const markAllRead = async () => {
		await api.post("/notifications/read-all");
		setList((prev) => prev.map((n) => ({ ...n, read: true })));
	};

	const remove = async (id: string) => {
		await api.del(`/notifications/${id}`);
		setList((prev) => prev.filter((n) => n.id !== id));
	};

	return (
		<div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-2">
					<Bell className="size-5 text-brand" />
					<h1 className="font-serif text-xl sm:text-2xl">通知中心</h1>
				</div>
				<div className="flex items-center gap-2">
					<div className="flex rounded-md border border-border">
						<button
							type="button"
							onClick={() => setFilter("all")}
							className={cn(
								"px-3 py-1 text-sm",
								filter === "all"
									? "bg-brand text-white"
									: "text-text-muted hover:bg-surface-2",
							)}
						>
							全部
						</button>
						<button
							type="button"
							onClick={() => setFilter("unread")}
							className={cn(
								"px-3 py-1 text-sm",
								filter === "unread"
									? "bg-brand text-white"
									: "text-text-muted hover:bg-surface-2",
							)}
						>
							未读
						</button>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={markAllRead}
						disabled={list.every((n) => n.read)}
					>
						<CheckCheck className="mr-1 size-4" />
						全部已读
					</Button>
				</div>
			</div>

			{loading ? (
				<div className="py-12 text-center text-sm text-text-muted">
					加载中...
				</div>
			) : list.length === 0 ? (
				<div className="py-16 text-center text-sm text-text-muted">
					{filter === "unread" ? "暂无未读通知" : "暂无通知"}
				</div>
			) : (
				<ul className="space-y-2">
					{list.map((n) => (
						<li
							key={n.id}
							className={cn(
								"rounded-md border border-border bg-surface-1 p-4",
								!n.read && "border-brand/40 bg-brand/5",
							)}
						>
							<div className="flex items-start justify-between gap-3">
								<div className="flex-1 space-y-1">
									<div className="flex items-center gap-2">
										{!n.read && (
											<span className="size-2 shrink-0 rounded-full bg-brand" />
										)}
										<span className="font-medium">{n.title}</span>
										<Badge variant="outline" className="text-[10px]">
											{NOTIFICATION_TYPE_LABELS[n.type]}
										</Badge>
									</div>
									<p className="text-sm text-text-muted">{n.body}</p>
									<div className="text-xs text-text-muted">
										{formatTime(n.createdAt)}
									</div>
								</div>
								<div className="flex shrink-0 items-center gap-1">
									{!n.read && (
										<Button
											variant="ghost"
											size="icon"
											onClick={() => markRead(n.id)}
											aria-label="标记已读"
										>
											<CheckCheck className="size-4" />
										</Button>
									)}
									<Button
										variant="ghost"
										size="icon"
										onClick={() => remove(n.id)}
										aria-label="删除"
									>
										<Trash2 className="size-4" />
									</Button>
								</div>
							</div>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
