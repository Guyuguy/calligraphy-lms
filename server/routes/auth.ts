import { Hono } from "hono";
import { users } from "../db";
import type { LoginResponse, User } from "../types";

// 简化的 token：base64(userId:role:timestamp)
function makeToken(user: User): string {
	return btoa(`${user.id}:${user.role}:${Date.now()}`);
}

export function parseToken(
	token: string,
): { userId: string; role: string } | null {
	if (!token) return null;
	try {
		const decoded = atob(token);
		const parts = decoded.split(":");
		if (parts.length < 2) return null;
		const userId = parts[0];
		const role = parts[1];
		if (!userId || !role) return null;
		// 校验用户存在且角色匹配
		const user = users.get(userId);
		if (!user || user.role !== role) return null;
		return { userId, role };
	} catch {
		return null;
	}
}

export const auth = new Hono();

auth.post("/login", async (c) => {
	let body: { username?: string; password?: string };
	try {
		body = await c.req.json();
	} catch {
		body = {} as { username?: string; password?: string };
	}
	if (!body.username || !body.password) {
		return c.json(
			{ error: "invalid_credentials", message: "用户名或密码不能为空" },
			400,
		);
	}
	const user = Array.from(users.values()).find(
		(u) => u.username === body.username,
	);
	if (!user || user.password !== body.password) {
		return c.json(
			{ error: "invalid_credentials", message: "用户名或密码错误" },
			401,
		);
	}
	const token = makeToken(user);
	const resp: LoginResponse = { token, user };
	return c.json(resp);
});

auth.get("/me", (c) => {
	const authHeader = c.req.header("Authorization") ?? "";
	const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
	const parsed = parseToken(token);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);
	const user = users.get(parsed.userId);
	if (!user) return c.json({ error: "not_found", message: "用户不存在" }, 404);
	return c.json({ user });
});
