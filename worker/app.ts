import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./runtime";
import { setEnv } from "./runtime";
import { handleAdminCoordinatorRequests } from "./handlers/admin-coordinator-requests";
import { handleAdminEventRequests } from "./handlers/admin-event-requests";
import { handleAdminReviewCoordinator } from "./handlers/admin-review-coordinator";
import { handleAdminReviewEvent } from "./handlers/admin-review-event";
import { handleAuthChangePassword } from "./handlers/auth-change-password";
import { handleAuthDeleteAccount } from "./handlers/auth-delete-account";
import { handleAuthExportData } from "./handlers/auth-export-data";
import { handleAuthForgotPassword } from "./handlers/auth-forgot-password";
import { handleAuthLogin } from "./handlers/auth-login";
import { handleAuthMe } from "./handlers/auth-me";
import {
  handleAuthMagicLinkConsume,
  handleAuthMagicLinkRequest,
  handleAuthOAuthCallback,
  handleAuthOAuthStart,
  handleOrganizerProfile,
} from "./handlers/auth-oauth";
import { handleAuthPreferences } from "./handlers/auth-preferences";
import { handleAuthProfile } from "./handlers/auth-profile";
import { handleAuthRegister } from "./handlers/auth-register";
import { handleAuthResendVerification } from "./handlers/auth-resend-verification";
import { handleAuthResetPassword } from "./handlers/auth-reset-password";
import { handleAuthVerifyEmail } from "./handlers/auth-verify-email";
import { handleCoordinatorApply } from "./handlers/coordinator-apply";
import { handleEventsShare } from "./handlers/events-share";
import { handleEventsDisplay } from "./handlers/events-display";
import { handleEventsJoin } from "./handlers/events-join";
import { handleEvents } from "./handlers/events";
import { handleEventsManage } from "./handlers/events-manage";
import { handleEventsPairings } from "./handlers/events-pairings";
import {
  handleEventsRegister,
  handleEventsGuestRegister,
  handleEventsClaimRegister,
  handleEventsDecklistsExport,
} from "./handlers/events-register";
import { handleEventsStaff } from "./handlers/events-staff";
import { handleEventsCompanion, handleEventsCompanionPull } from "./handlers/events-companion";
import { handleHealth } from "./handlers/health";
import { handleLeaderboard } from "./handlers/leaderboard";
import { handlePublicUser, handlePublicUserAvatar } from "./handlers/users-public";
import { handleMetagame } from "./handlers/metagame";
import { handleNews } from "./handlers/news";
import { handleRules } from "./handlers/rules";
import { checkRateLimit } from "./_shared/rate-limit";

const app = new Hono<{ Bindings: Env }>();

app.use(
  "*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "If-None-Match"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["ETag"],
  }),
);

app.use("*", async (c, next) => {
  setEnv(c.env);
  await next();
});

app.use("/api/auth/*", async (c, next) => {
  if (c.req.method === "POST") {
    const ip = c.req.header("cf-connecting-ip") ?? "anon";
    const rate = checkRateLimit(`auth:${ip}`, 40, 60_000);
    if (!rate.ok) return c.json({ error: "Too many requests" }, 429);
  }
  await next();
});

app.get("/api/health", (c) => handleHealth(c.req.raw));

app.post("/api/auth/login", (c) => handleAuthLogin(c.req.raw));
app.post("/api/auth/register", (c) => handleAuthRegister(c.req.raw));
app.post("/api/auth/forgot-password", (c) => handleAuthForgotPassword(c.req.raw));
app.post("/api/auth/reset-password", (c) => handleAuthResetPassword(c.req.raw));
app.post("/api/auth/verify-email", (c) => handleAuthVerifyEmail(c.req.raw));
app.post("/api/auth/resend-verification", (c) => handleAuthResendVerification(c.req.raw));
app.get("/api/auth/me", (c) => handleAuthMe(c.req.raw));
app.patch("/api/auth/preferences", (c) => handleAuthPreferences(c.req.raw));
app.get("/api/auth/profile", (c) => handleAuthProfile(c.req.raw));
app.patch("/api/auth/profile", (c) => handleAuthProfile(c.req.raw));
app.post("/api/auth/change-password", (c) => handleAuthChangePassword(c.req.raw));
app.get("/api/auth/export", (c) => handleAuthExportData(c.req.raw));
app.post("/api/auth/delete-account", (c) => handleAuthDeleteAccount(c.req.raw));
app.get("/api/auth/oauth/start", (c) => handleAuthOAuthStart(c.req.raw));
app.get("/api/auth/oauth/callback", (c) => handleAuthOAuthCallback(c.req.raw));
app.post("/api/auth/magic-link", (c) => handleAuthMagicLinkRequest(c.req.raw));
app.post("/api/auth/magic-link/consume", (c) => handleAuthMagicLinkConsume(c.req.raw));

app.get("/api/organizers/:id", (c) => handleOrganizerProfile(c.req.raw, { id: c.req.param("id") }));

app.get("/api/events", (c) => handleEvents(c.req.raw));
app.get("/api/events/join/:code", (c) => handleEventsJoin(c.req.raw, { code: c.req.param("code") }));
app.get("/api/events/:id/og.png", (c) => handleEventsShare(c.req.raw, { id: c.req.param("id") }));
app.get("/api/events/:id/share", (c) => handleEventsShare(c.req.raw, { id: c.req.param("id") }));
app.get("/api/events/:id/display", (c) => handleEventsDisplay(c.req.raw, { id: c.req.param("id") }));
app.post("/api/events", (c) => handleEvents(c.req.raw));
app.patch("/api/events/:id", (c) => handleEventsManage(c.req.raw, { id: c.req.param("id") }));
app.delete("/api/events/:id", (c) => handleEventsManage(c.req.raw, { id: c.req.param("id") }));
app.post("/api/events/:id/register/guest", (c) => handleEventsGuestRegister(c.req.raw, { id: c.req.param("id") }));
app.post("/api/events/:id/register/claim", (c) => handleEventsClaimRegister(c.req.raw, { id: c.req.param("id") }));
app.get("/api/events/:id/register", (c) => handleEventsRegister(c.req.raw, { id: c.req.param("id") }));
app.post("/api/events/:id/register", (c) => handleEventsRegister(c.req.raw, { id: c.req.param("id") }));
app.patch("/api/events/:id/register", (c) => handleEventsRegister(c.req.raw, { id: c.req.param("id") }));
app.delete("/api/events/:id/register", (c) => handleEventsRegister(c.req.raw, { id: c.req.param("id") }));
app.get("/api/events/:id/decklists", (c) => handleEventsDecklistsExport(c.req.raw, { id: c.req.param("id") }));
app.get("/api/events/:id/staff", (c) => handleEventsStaff(c.req.raw, { id: c.req.param("id") }));
app.post("/api/events/:id/staff", (c) => handleEventsStaff(c.req.raw, { id: c.req.param("id") }));
app.patch("/api/events/:id/staff", (c) => handleEventsStaff(c.req.raw, { id: c.req.param("id") }));
app.post("/api/events/:id/companion/pull", (c) => handleEventsCompanionPull(c.req.raw, { id: c.req.param("id") }));
app.get("/api/events/:id/companion", (c) => handleEventsCompanion(c.req.raw, { id: c.req.param("id") }));
app.post("/api/events/:id/companion", (c) => handleEventsCompanion(c.req.raw, { id: c.req.param("id") }));
app.get("/api/events/:id/pairings", (c) => handleEventsPairings(c.req.raw, { id: c.req.param("id") }));
app.post("/api/events/:id/pairings", (c) => handleEventsPairings(c.req.raw, { id: c.req.param("id") }));
app.patch("/api/events/:id/pairings", (c) => handleEventsPairings(c.req.raw, { id: c.req.param("id") }));

app.get("/api/leaderboard", (c) => handleLeaderboard(c.req.raw));
app.get("/api/users/:id/avatar", (c) => handlePublicUserAvatar(c.req.raw, { id: c.req.param("id") }));
app.get("/api/users/:id", (c) => handlePublicUser(c.req.raw, { id: c.req.param("id") }));
app.get("/api/metagame", (c) => handleMetagame(c.req.raw));
app.get("/api/news", (c) => handleNews(c.req.raw));
app.post("/api/news", (c) => handleNews(c.req.raw));
app.get("/api/rules", (c) => handleRules(c.req.raw));
app.post("/api/rules", (c) => handleRules(c.req.raw));

app.get("/api/coordinator/apply", (c) => handleCoordinatorApply(c.req.raw));
app.post("/api/coordinator/apply", (c) => handleCoordinatorApply(c.req.raw));

app.get("/api/admin/coordinator-requests", (c) => handleAdminCoordinatorRequests(c.req.raw));
app.get("/api/admin/event-requests", (c) => handleAdminEventRequests(c.req.raw));
app.post("/api/admin/review-coordinator", (c) => handleAdminReviewCoordinator(c.req.raw));
app.post("/api/admin/review-event", (c) => handleAdminReviewEvent(c.req.raw));

app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));

app.onError((err, c) => {
  const message = err instanceof Error ? err.message : "Internal server error";
  if (
    message.includes("Database not configured") ||
    message.includes("DATABASE_URL") ||
    message.includes("connection string format for `neon()`")
  ) {
    return c.json({ error: message }, 503);
  }
  console.error(err);
  return c.json({ error: message }, 500);
});

export default app;
