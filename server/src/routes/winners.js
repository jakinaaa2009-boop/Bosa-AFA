import { Router } from "express";
import mongoose from "mongoose";
import { Winner } from "../models/Winner.js";

export const winnersRouter = Router();

winnersRouter.get("/", async (_req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ winners: [], warning: "MongoDB холболт алга." });
    }

    const winners = await Winner.find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .select("docNumber contact prize createdAt")
      .lean();

    res.json({
      winners: winners.map((w) => ({
        id: String(w._id),
        docNumber: w.docNumber,
        contact: w.contact,
        prize: w.prize,
        createdAt: w.createdAt,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ялагчдын мэдээлэл ачаалахад алдаа гарлаа." });
  }
});
