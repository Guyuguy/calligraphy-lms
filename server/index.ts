import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { initDb } from "./db";
import { auth } from "./routes/auth";
import { coursesRouter } from "./routes/courses";
import { dashboardRouter } from "./routes/dashboard";
import { notificationsRouter } from "./routes/notifications";
import { parentRouter } from "./routes/parent";
import { paymentsRouter } from "./routes/payments";
import { portfolioRouter } from "./routes/portfolio";
import { progressRouter } from "./routes/progress";
import { recommendationsRouter } from "./routes/recommendations";
import { classroomRouter, scheduleRouter } from "./routes/schedule";
import { submissionsRouter } from "./routes/submissions";
import { teachingRouter } from "./routes/teaching";
import { usersRouter } from "./routes/users";

initDb();

const app = new Hono();

app.use("*", logger());
app.use(
	"*",
	cors({
		origin: ["http://localhost:5175", "http://127.0.0.1:5175"],
		allowHeaders: ["Content-Type", "Authorization"],
		allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
	}),
);

app.get("/api/health", (c) => c.json({ ok: true, ts: Date.now() }));

app.route("/api/auth", auth);
app.route("/api/users", usersRouter);
app.route("/api/courses", coursesRouter);
app.route("/api/recommendations", recommendationsRouter);
app.route("/api/schedules", scheduleRouter);
app.route("/api/classrooms", classroomRouter);
app.route("/api/progress", progressRouter);
app.route("/api/teaching", teachingRouter);
app.route("/api/submissions", submissionsRouter);
app.route("/api/notifications", notificationsRouter);
app.route("/api/parent", parentRouter);
app.route("/api/payments", paymentsRouter);
app.route("/api/portfolios", portfolioRouter);
app.route("/api/dashboard", dashboardRouter);

const port = Number(process.env.PORT ?? 3001);
console.log(`[calligraphy-lms] server listening on http://localhost:${port}`);

export default {
	port,
	fetch: app.fetch,
};
