import { Images, Plus, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import {
	api,
	type ParentChild,
	type ParentChildrenResponse,
	type User,
} from "@/api/client";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArtworkUploader } from "./ArtworkUploader";
import { Timeline } from "./Timeline";
import { WorkWall } from "./WorkWall";

interface PortfolioProps {
	user: User;
	navigate: (p: string) => void;
}

const EDIT_ROLES = ["teacher", "academic_head", "admin"];

export function Portfolio({ user }: PortfolioProps) {
	const [tab, setTab] = useState<string>(
		user.role === "student" || user.role === "parent" ? "timeline" : "wall",
	);
	const [refreshKey, setRefreshKey] = useState(0);
	const [uploaderOpen, setUploaderOpen] = useState(false);

	// 学生选择(家长/教师/教务/管理员需要)
	// 学生本人: 默认自己,无选择器
	// 家长: 默认第一个孩子,可切换
	// 教师/教务/管理员/助教: 默认空,需选择
	const [children, setChildren] = useState<ParentChild[]>([]);
	const [selectedStudentId, setSelectedStudentId] = useState<string>(
		user.role === "student" ? user.id : "",
	);

	useEffect(() => {
		if (user.role === "parent") {
			api
				.get<ParentChildrenResponse>("/parent/children")
				.then((r) => {
					setChildren(r.children);
					if (r.children.length > 0 && r.children[0].user) {
						setSelectedStudentId(r.children[0].user.id);
					}
				})
				.catch(() => {});
		}
	}, [user.role]);

	const canEdit = EDIT_ROLES.includes(user.role);
	const canUpload = user.role === "student" || EDIT_ROLES.includes(user.role);
	const canDeleteArtwork =
		user.role === "student" || EDIT_ROLES.includes(user.role);
	// 学生/家长只读;教师/教务/管理员可编辑标注
	const annotationReadonly = !canEdit;

	const triggerRefresh = () => setRefreshKey((k) => k + 1);

	const handleUploadClick = () => {
		if (user.role === "student") {
			setSelectedStudentId(user.id);
		}
		setUploaderOpen(true);
	};

	// 学生选择器(教师/教务/管理员/家长)
	const studentSelector = (user.role === "parent" ||
		EDIT_ROLES.includes(user.role)) && (
		<div className="mb-3 flex items-center gap-2">
			<label htmlFor="stu-select" className="text-sm text-text-muted">
				选择学生:
			</label>
			{user.role === "parent" ? (
				<select
					id="stu-select"
					value={selectedStudentId}
					onChange={(e) => setSelectedStudentId(e.target.value)}
					className="rounded-md border border-border bg-card px-2 py-1 text-sm"
				>
					{children.length === 0 && <option value="">加载中...</option>}
					{children.map((c) =>
						c.user ? (
							<option key={c.user.id} value={c.user.id}>
								{c.user.name}
							</option>
						) : null,
					)}
				</select>
			) : (
				<input
					id="stu-select"
					type="text"
					placeholder="输入学生 ID(如 user_student_01)"
					value={selectedStudentId}
					onChange={(e) => setSelectedStudentId(e.target.value)}
					className="flex-1 max-w-xs rounded-md border border-border bg-card px-2 py-1 text-sm"
				/>
			)}
		</div>
	);

	return (
		<PageContainer
			title="作品集"
			description="学生书法作品的时间轴、批注与作品墙"
			actions={
				canUpload && (
					<Button onClick={handleUploadClick}>
						<Upload className="size-4" />
						上传作品
					</Button>
				)
			}
		>
			<Tabs value={tab} onValueChange={setTab}>
				<TabsList>
					<TabsTrigger value="timeline">
						<Images className="size-3.5" />
						时间轴
					</TabsTrigger>
					<TabsTrigger value="wall">
						<Plus className="size-3.5" />
						作品墙
					</TabsTrigger>
				</TabsList>

				<TabsContent value="timeline" className="mt-4">
					{studentSelector}
					{selectedStudentId ? (
						<Timeline
							key={selectedStudentId}
							studentId={selectedStudentId}
							readonly={annotationReadonly}
							canDeleteArtwork={canDeleteArtwork}
							refreshKey={refreshKey}
						/>
					) : (
						<div className="rounded-md border border-border bg-surface-1 p-8 text-center text-text-muted">
							{user.role === "parent"
								? "请选择孩子"
								: "请输入学生 ID 以查看时间轴"}
						</div>
					)}
				</TabsContent>

				<TabsContent value="wall" className="mt-4">
					<WorkWall
						readonly={annotationReadonly}
						canDeleteArtwork={canDeleteArtwork}
						refreshKey={refreshKey}
					/>
				</TabsContent>
			</Tabs>

			{canUpload && selectedStudentId && (
				<ArtworkUploader
					open={uploaderOpen}
					studentId={selectedStudentId}
					onOpenChange={setUploaderOpen}
					onUploaded={triggerRefresh}
				/>
			)}
		</PageContainer>
	);
}
