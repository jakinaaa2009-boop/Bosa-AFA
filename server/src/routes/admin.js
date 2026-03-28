import { Router } from "express";
import mongoose from "mongoose";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { User } from "../models/User.js";
import { Barimt } from "../models/Barimt.js";
import { Winner } from "../models/Winner.js";
import { publicAssetUrl } from "../publicUrl.js";

export const adminRouter = Router();

function ensureDbConnected(res) {
  if (mongoose.connection.readyState === 1) return true;
  res.status(503).json({ error: "MongoDB холболт алга." });
  return false;
}

adminRouter.get("/overview", requireAdmin, async (_req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        users: [],
        documents: [],
        warning: "MongoDB холболт алга. Одоогоор админ дата хоосон байна.",
      });
    }

    const [users, docs] = await Promise.all([
      User.find({})
        .sort({ createdAt: -1 })
        .select("_id phone email age createdAt")
        .lean(),
      Barimt.find({})
        .sort({ createdAt: -1 })
        .populate("user", "phone email age")
        .lean(),
    ]);

    res.json({
      users: users.map((u) => ({
        id: String(u._id),
        phone: u.phone,
        email: u.email,
        age: u.age,
        createdAt: u.createdAt,
      })),
      documents: docs.map((d) => ({
        id: String(d._id),
        docNumber: d.docNumber,
        price: d.price,
        imageUrl: publicAssetUrl(`/uploads/${d.imageFile}`),
        createdAt: d.createdAt,
        user: d.user
          ? {
              id: String(d.user._id),
              phone: d.user.phone,
              email: d.user.email,
              age: d.user.age,
            }
          : null,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Админ дата ачаалахад алдаа гарлаа." });
  }
});

adminRouter.get("/wheel", requireAdmin, async (_req, res) => {
  try {
    if (!ensureDbConnected(res)) return;

    const [totalDocs, usedDocIds, recentWinners] = await Promise.all([
      Barimt.countDocuments({}),
      Winner.find({}).distinct("doc"),
      Winner.find({})
        .sort({ createdAt: -1 })
        .limit(20)
        .select("docNumber contact prize createdAt")
        .lean(),
    ]);

    const usedSet = new Set(usedDocIds.map((id) => String(id)));
    const remainingCount = Math.max(0, totalDocs - usedSet.size);

    res.json({
      totalDocs,
      usedCount: usedSet.size,
      remainingCount,
      winners: recentWinners.map((w) => ({
        id: String(w._id),
        docNumber: w.docNumber,
        contact: w.contact,
        prize: w.prize,
        createdAt: w.createdAt,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Wheel дата ачаалахад алдаа гарлаа." });
  }
});

adminRouter.post("/wheel/spin", requireAdmin, async (req, res) => {
  try {
    if (!ensureDbConnected(res)) return;

    const prizeRaw = String(req.body?.prize ?? "").trim();
    const prize = prizeRaw || "Lucky Wheel";

    const usedDocIds = await Winner.find({}).distinct("doc");
    const candidates = await Barimt.find({
      _id: { $nin: usedDocIds },
    })
      .populate("user", "phone")
      .lean();

    if (!candidates.length) {
      return res.status(400).json({ error: "Сугалах баримт үлдээгүй байна." });
    }

    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    const contact = picked.user?.phone ?? "unknown";

    const winner = await Winner.create({
      doc: picked._id,
      user: picked.user?._id ?? picked.user,
      docNumber: picked.docNumber,
      contact,
      prize,
    });

    res.status(201).json({
      winner: {
        id: String(winner._id),
        docNumber: winner.docNumber,
        contact: winner.contact,
        prize: winner.prize,
        createdAt: winner.createdAt,
      },
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "Энэ баримт аль хэдийн ялагчаар сонгогдсон." });
    }
    console.error(err);
    res.status(500).json({ error: "Сугалаа эргүүлэхэд алдаа гарлаа." });
  }
});
