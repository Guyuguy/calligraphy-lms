import { useCallback, useEffect, useState } from "react";
import { api, getStoredToken, setAuthToken, type User } from "@/api/client";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { CourseDetail } from "@/pages/courses/CourseDetail";
import { CourseList } from "@/pages/courses/CourseList";
import { CourseRecommend } from "@/pages/courses/CourseRecommend";
import { Dashboard } from "@/pages/Dashboard";
import { Login } from "@/pages/Login";
import { Notifications } from "@/pages/notifications/Notifications";
import { ChildProgress } from "@/pages/parent/ChildProgress";
import { Evaluations } from "@/pages/parent/Evaluations";
import { ParentDashboard } from "@/pages/parent/ParentDashboard";
import { Payments } from "@/pages/parent/Payments";
import { ProgressView } from "@/pages/progress/ProgressView";
import { ScheduleView } from "@/pages/schedule/ScheduleView";
import { StudentDetail } from "@/pages/students/StudentDetail";
import { StudentList } from "@/pages/students/StudentList";
import { TeacherDetail } from "@/pages/teachers/TeacherDetail";
import { TeacherList } from "@/pages/teachers/TeacherList";
import { TeachingDashboard } from "@/pages/teaching/TeachingDashboard";

function parsePath(): string {
	const hash = window.location.hash.replace(/^#/, "");
	return hash || "/";
}

export function App() {
	const [user, setUser] = useState<User | null>(null);
	const [booting, setBooting] = useState(true);
	const [path, setPath] = useState(parsePath());

	// 初始化：尝试用本地 token 恢复会话
	useEffect(() => {
		const token = getStoredToken();
		if (!token) {
			setBooting(false);
			return;
		}
		api
			.get<{ user: User }>("/auth/me")
			.then((res) => setUser(res.user))
			.catch(() => setAuthToken(null))
			.finally(() => setBooting(false));
	}, []);

	// 监听 hash 路由变化
	useEffect(() => {
		const onChange = () => setPath(parsePath());
		window.addEventListener("hashchange", onChange);
		return () => window.removeEventListener("hashchange", onChange);
	}, []);

	const navigate = useCallback((p: string) => {
		window.location.hash = p;
	}, []);

	const handleLogin = (token: string, u: User) => {
		setAuthToken(token);
		setUser(u);
		navigate("/");
	};

	const handleLogout = () => {
		setAuthToken(null);
		setUser(null);
		navigate("/");
	};

	if (booting) {
		return (
			<div className="flex h-screen items-center justify-center text-text-muted">
				正在加载...
			</div>
		);
	}

	if (!user) {
		return <Login onLogin={handleLogin} />;
	}

	return (
		<div className="flex h-screen flex-col">
			<div className="flex flex-1 overflow-hidden">
				<Sidebar currentPath={path} onNavigate={navigate} role={user.role} />
				<div className="flex flex-1 flex-col overflow-hidden">
					<Topbar user={user} onLogout={handleLogout} onNavigate={navigate} />
					<main className="flex-1 overflow-y-auto bg-surface-0 ink-bg">
						<Router path={path} user={user} navigate={navigate} />
					</main>
				</div>
			</div>
		</div>
	);
}

interface RouterProps {
	path: string;
	user: User;
	navigate: (p: string) => void;
}

function Router({ path, user, navigate }: RouterProps) {
	// 路由匹配
	if (path === "/" || path === "")
		return <Dashboard user={user} navigate={navigate} />;
	if (path === "/recommend")
		return <CourseRecommend user={user} navigate={navigate} />;
	if (path === "/courses")
		return <CourseList user={user} navigate={navigate} />;
	if (path.startsWith("/courses/"))
		return (
			<CourseDetail
				id={path.slice("/courses/".length)}
				user={user}
				navigate={navigate}
			/>
		);
	if (path === "/students")
		return <StudentList user={user} navigate={navigate} />;
	if (path.startsWith("/students/"))
		return (
			<StudentDetail
				id={path.slice("/students/".length)}
				user={user}
				navigate={navigate}
			/>
		);
	if (path === "/teachers")
		return <TeacherList user={user} navigate={navigate} />;
	if (path.startsWith("/teachers/"))
		return (
			<TeacherDetail
				id={path.slice("/teachers/".length)}
				user={user}
				navigate={navigate}
			/>
		);
	if (path === "/schedule") return <ScheduleView user={user} />;
	if (path === "/progress") return <ProgressView user={user} />;
	if (path === "/teaching") return <TeachingDashboard user={user} />;
	if (path === "/notifications") return <Notifications />;
	if (path === "/parent")
		return <ParentDashboard user={user} navigate={navigate} />;
	if (path.startsWith("/parent/child/"))
		return (
			<ChildProgress
				childId={path.slice("/parent/child/".length)}
				user={user}
				navigate={navigate}
			/>
		);
	if (path === "/parent/payments") return <Payments user={user} />;
	if (path === "/parent/evaluations") return <Evaluations />;
	return <NotFound />;
}

function NotFound() {
	return (
		<div className="flex h-full items-center justify-center text-text-muted">
			<div className="text-center">
				<div className="font-serif text-4xl">404</div>
				<div className="mt-2 text-sm">页面不存在</div>
			</div>
		</div>
	);
}
