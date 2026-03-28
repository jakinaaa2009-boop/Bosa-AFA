import { Router } from "express";
import { NewsletterSubscriber } from "../models/NewsletterSubscriber.js";

export const newsletterRouter = Router();

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

newsletterRouter.post("/", async (req, res) => {
  try {
    const { email } = req.body ?? {};
    if (typeof email !== "string") {
      return res.status(400).json({ error: "email is required" });
    }
    const e = email.trim().toLowerCase();
    if (!e || !emailRegex.test(e)) {
      return res.status(400).json({ error: "Invalid email" });
    }
    await NewsletterSubscriber.updateOne(
      { email: e },
      { $setOnInsert: { email: e } },
      { upsert: true }
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    if (err.code === 11000) {
      return res.json({ ok: true, alreadySubscribed: true });
    }
    console.error(err);
    res.status(500).json({ error: "Could not subscribe" });
  }
});
