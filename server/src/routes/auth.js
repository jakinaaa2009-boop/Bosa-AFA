import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User, normalizePhone } from "../models/User.js";
import { Admin } from "../models/Admin.js";

export const authRouter = Router();

const BCRYPT_ROUNDS = 10;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ADMIN_FALLBACK_USER = process.env.ADMIN_USERNAME || "admin";
const ADMIN_FALLBACK_PASS = process.env.ADMIN_PASSWORD || "admin123";

function signToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return jwt.sign(
    { sub: String(user._id), phone: user.phone },
    secret,
    { expiresIn: "7d" }
  );
}

function isDuplicateKeyError(err) {
  return err?.code === 11000 || /E11000/i.test(String(err?.message ?? ""));
}

function duplicateFieldMessage(err) {
  const kv = err?.keyValue;
  if (kv && typeof kv === "object") {
    if ("phone" in kv) return "Энэ утасны дугаараар бүртгэл бий.";
    if ("email" in kv) return "Энэ и-мэйлээр бүртгэл бий.";
  }
  const msg = String(err?.message ?? "");
  if (/phone/i.test(msg) && /dup/i.test(msg)) {
    return "Энэ утасны дугаараар бүртгэл бий.";
  }
  return "Энэ и-мэйлээр бүртгэл бий.";
}

authRouter.post("/register", async (req, res) => {
  try {
    const { phone, email, age, password } = req.body ?? {};
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone || normalizedPhone.length < 8) {
      return res.status(400).json({
        error: "Утасны дугаар хамгийн багадаа 8 тэмдэгт байна.",
      });
    }
    if (typeof email !== "string" || !emailRegex.test(email.trim())) {
      return res.status(400).json({ error: "И-мэйл хаяг буруу байна." });
    }
    const ageNum = Number(age);
    if (!Number.isInteger(ageNum) || ageNum < 1 || ageNum > 120) {
      return res.status(400).json({ error: "Нас 1–120 хооронд байх ёстой." });
    }
    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({
        error: "Нууц үг хамгийн багадаа 6 тэмдэгт байна.",
      });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await User.create({
      phone: normalizedPhone,
      email: email.trim().toLowerCase(),
      age: ageNum,
      passwordHash,
    });

    const token = signToken(user);
    const u = user.toJSON();
    res.status(201).json({
      token,
      user: { id: u._id, phone: u.phone, email: u.email, age: u.age },
    });
  } catch (err) {
    if (err.message === "JWT_SECRET is not set") {
      console.error(err);
      return res.status(500).json({ error: "Серверийн тохиргоо дутуу (JWT_SECRET)." });
    }
    if (err.name === "ValidationError") {
      const first = Object.values(err.errors ?? {})[0];
      return res.status(400).json({
        error: first?.message ?? "Өгөгдөл буруу байна.",
      });
    }
    if (isDuplicateKeyError(err)) {
      return res.status(409).json({ error: duplicateFieldMessage(err) });
    }
    console.error(err);
    const hint =
      process.env.NODE_ENV !== "production"
        ? `: ${err.message}`
        : "";
    res.status(500).json({ error: `Бүртгэл амжилтгүй.${hint}` });
  }
});

authRouter.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body ?? {};
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone || typeof password !== "string") {
      return res.status(400).json({ error: "Утас болон нууц үг оруулна уу." });
    }

    const user = await User.findOne({ phone: normalizedPhone }).select(
      "+passwordHash"
    );
    if (!user) {
      return res.status(401).json({ error: "Дугаар эсвэл нууц үг буруу." });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "Дугаар эсвэл нууц үг буруу." });
    }

    const token = signToken(user);
    const u = user.toJSON();
    res.json({
      token,
      user: { id: u._id, phone: u.phone, email: u.email, age: u.age },
    });
  } catch (err) {
    if (err.message === "JWT_SECRET is not set") {
      console.error(err);
      return res.status(500).json({ error: "Серверийн тохиргоо дутуу." });
    }
    console.error(err);
    res.status(500).json({ error: "Нэвтрэх амжилтгүй." });
  }
});

authRouter.post("/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body ?? {};
    const normalizedUsername = String(username ?? "").trim().toLowerCase();
    if (!normalizedUsername || typeof password !== "string") {
      return res.status(400).json({ error: "Нэвтрэх нэр болон нууц үг оруулна уу." });
    }

    let admin = null;
    if (mongoose.connection.readyState === 1) {
      admin = await Admin.findOne({ username: normalizedUsername }).select(
        "+passwordHash"
      );
    }

    // Fallback when MongoDB is not available locally.
    if (!admin && mongoose.connection.readyState !== 1) {
      if (
        normalizedUsername === String(ADMIN_FALLBACK_USER).toLowerCase() &&
        password === ADMIN_FALLBACK_PASS
      ) {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
          throw new Error("JWT_SECRET is not set");
        }
        const token = jwt.sign(
          { sub: "admin-fallback", username: ADMIN_FALLBACK_USER, role: "admin" },
          secret,
          { expiresIn: "7d" }
        );
        return res.json({
          token,
          admin: { id: "admin-fallback", username: ADMIN_FALLBACK_USER },
        });
      }
      return res.status(401).json({ error: "Нэвтрэх нэр эсвэл нууц үг буруу." });
    }

    if (!admin) {
      return res.status(401).json({ error: "Нэвтрэх нэр эсвэл нууц үг буруу." });
    }

    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "Нэвтрэх нэр эсвэл нууц үг буруу." });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET is not set");
    }

    const token = jwt.sign(
      { sub: String(admin._id), username: admin.username, role: "admin" },
      secret,
      { expiresIn: "7d" }
    );

    const a = admin.toJSON();
    res.json({
      token,
      admin: { id: a._id, username: a.username },
    });
  } catch (err) {
    if (err.message === "JWT_SECRET is not set") {
      console.error(err);
      return res.status(500).json({ error: "Серверийн тохиргоо дутуу." });
    }
    console.error(err);
    res.status(500).json({ error: "Админ нэвтрэх амжилтгүй." });
  }
});
