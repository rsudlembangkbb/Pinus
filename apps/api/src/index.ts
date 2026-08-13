import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { AppEnv } from "./lib/app-context.js";
import { HttpError } from "./lib/errors.js";
import { dbMiddleware } from "./middleware/db.js";
import { authRoutes } from "./modules/auth/routes.js";
import { auditRoutes } from "./modules/audit/routes.js";
import { deductionRuleRoutes } from "./modules/master-data/deduction-rules.js";
import { employeeRoutes } from "./modules/master-data/employees.js";
import { indexingWeightRoutes } from "./modules/master-data/indexing-weights.js";
import { jobGradeRoutes } from "./modules/master-data/job-grades.js";
import { minimumRequirementRoutes } from "./modules/master-data/minimum-requirements.js";
import { proportionSchemeRoutes } from "./modules/master-data/proportion-schemes.js";
import { tariffRoutes } from "./modules/master-data/tariffs.js";
import { workUnitRoutes } from "./modules/master-data/work-units.js";
import { importRoutes } from "./modules/import/routes.js";
import { calculationRoutes } from "./modules/calculation/routes.js";
import { workflowRoutes } from "./modules/workflow/routes.js";
import { transparencyRoutes } from "./modules/transparency/routes.js";
import { reportRoutes } from "./modules/reports/routes.js";
import { userRoutes } from "./modules/users/routes.js";
import { dashboardRoutes } from "./modules/dashboard/routes.js";
import { notificationRoutes } from "./modules/notifications/routes.js";

const app = new Hono<AppEnv>();

app.use("*", logger());
app.use("*", async (c, next) => {
  const cors_ = cors({
    origin: c.env.CORS_ORIGIN,
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
  return cors_(c, next);
});
app.use("*", dbMiddleware);

app.onError((err, c) => {
  if (err instanceof HttpError) {
    return c.json({ error: { code: err.code, message: err.message, details: err.details } }, err.status);
  }
  console.error(err);
  return c.json({ error: { code: "INTERNAL_ERROR", message: "Terjadi kesalahan pada server" } }, 500);
});

app.get("/api/health", (c) => c.json({ status: "ok", env: c.env.APP_ENV, time: new Date().toISOString() }));

app.route("/api/auth", authRoutes);
app.route("/api/master/employees", employeeRoutes);
app.route("/api/master/work-units", workUnitRoutes);
app.route("/api/master/proportion-schemes", proportionSchemeRoutes);
app.route("/api/master/job-grades", jobGradeRoutes);
app.route("/api/master/indexing-weights", indexingWeightRoutes);
app.route("/api/master/deduction-rules", deductionRuleRoutes);
app.route("/api/master/minimum-requirements", minimumRequirementRoutes);
app.route("/api/master/tariffs", tariffRoutes);
app.route("/api/import", importRoutes);
app.route("/api/calculation", calculationRoutes);
app.route("/api/workflow", workflowRoutes);
app.route("/api/transparency", transparencyRoutes);
app.route("/api/reports", reportRoutes);
app.route("/api/users", userRoutes);
app.route("/api/dashboard", dashboardRoutes);
app.route("/api/notifications", notificationRoutes);
app.route("/api/audit", auditRoutes);

export default app;
