import "./load-env.js";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import { authRouter } from "./routes/auth.js";
import { contactRouter } from "./routes/contact.js";
import { newsletterRouter } from "./routes/newsletter.js";
import { documentsRouter } from "./routes/documents.js";
import { adminRouter } from "./routes/admin.js";
import { winnersRouter } from "./routes/winners.js";
import { ensureDefaultAdmin } from "./models/Admin.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsStatic = path.join(__dirname, "..", "uploads");

const app = express();
const PORT = Number(process.env.PORT) || 5050;
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/promo-site";

/** Strip trailing slashes so https://app.vercel.app/ matches the browser's Origin header. */
function normalizeOrigin(url) {
  return String(url ?? "")
    .trim()
    .replace(/\/+$/, "");
}

function buildAllowedOrigins() {
  const raw =
    process.env.CLIENT_ORIGIN?.trim() || "http://localhost:5173";
  const list = raw
    .split(",")
    .map((s) => normalizeOrigin(s))
    .filter(Boolean);
  return new Set(list);
}

const allowedOrigins = buildAllowedOrigins();

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      const n = normalizeOrigin(origin);
      if (allowedOrigins.has(n)) return cb(null, true);
      console.warn(
        `[cors] Rejected Origin: ${origin}. Set CLIENT_ORIGIN on Railway to this value (comma-separate several). Currently allowed: ${[...allowedOrigins].join(", ") || "(none)"}`
      );
      return cb(null, false);
    },
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204,
  })
);
app.use(express.json({ limit: "64kb" }));
app.use("/uploads", express.static(uploadsStatic));

app.get("/api/health", (_req, res) => {
  const db = mongoose.connection.readyState;
  res.json({
    ok: true,
    db: db === 1 ? "connected" : db === 2 ? "connecting" : "disconnected",
  });
});

app.use("/api/auth", authRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/winners", winnersRouter);
app.use("/api/contact", contactRouter);
app.use("/api/newsletter", newsletterRouter);

function ensureJwtSecret() {
  if (process.env.JWT_SECRET?.trim()) return;
  process.env.JWT_SECRET = crypto.randomBytes(48).toString("base64url");
  console.warn(
    "[promo-server] JWT_SECRET is not set (add it in Railway → Variables). " +
      "Using a random secret for this run — user sessions reset on every deploy/restart until you set JWT_SECRET."
  );
}

async function main() {
  ensureJwtSecret();
  try {
    await mongoose.connect(MONGODB_URI);
    await ensureDefaultAdmin();
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection failed. Running in degraded mode.");
    console.error(err?.message ?? err);
  }
  app.listen(PORT, () => {
    console.log(`API http://localhost:${PORT}`);
    console.log(`CORS allowed origins: ${[...allowedOrigins].join(", ")}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
