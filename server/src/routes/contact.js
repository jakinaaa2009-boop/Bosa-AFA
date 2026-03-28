import { Router } from "express";
import { ContactMessage } from "../models/ContactMessage.js";

export const contactRouter = Router();

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

contactRouter.post("/", async (req, res) => {
  try {
    const { name, email, message } = req.body ?? {};
    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof message !== "string"
    ) {
      return res
        .status(400)
        .json({ error: "name, email, and message are required" });
    }
    const n = name.trim();
    const e = email.trim();
    const m = message.trim();
    if (!n || !e || !m) {
      return res.status(400).json({ error: "All fields must be non-empty" });
    }
    if (!emailRegex.test(e)) {
      return res.status(400).json({ error: "Invalid email" });
    }
    await ContactMessage.create({ name: n, email: e, message: m });
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not save message" });
  }
});
