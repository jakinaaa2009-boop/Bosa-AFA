import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { Router } from "express";
import multer from "multer";
import mongoose from "mongoose";
import { Barimt } from "../models/Barimt.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { publicAssetUrl } from "../publicUrl.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "..", "..", "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "") || ".jpg";
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
});

export const documentsRouter = Router();

function toDto(doc) {
  const o = doc.toObject?.() ?? doc;
  return {
    id: String(o._id),
    docNumber: o.docNumber,
    price: o.price,
    imageUrl: publicAssetUrl(`/uploads/${o.imageFile}`),
    createdAt: o.createdAt,
  };
}

documentsRouter.get("/", requireAuth, async (req, res) => {
  try {
    const list = await Barimt.find({ user: req.userId })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ documents: list.map(toDto) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Баримтууд ачаалахад алдаа гарлаа." });
  }
});

documentsRouter.post("/", requireAuth, (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "Файл 5MB-аас их байна." });
      }
      return res.status(400).json({ error: "Файл оруулахад алдаа гарлаа." });
    }
    if (err) return next(err);
    next();
  });
}, async (req, res) => {
  try {
    const { docNumber, price } = req.body ?? {};
    if (typeof docNumber !== "string" || !docNumber.trim()) {
      return res.status(400).json({ error: "Баримтын дугаар оруулна уу." });
    }
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      return res.status(400).json({ error: "Үнэ буруу байна." });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Зөвхөн зураг оруулна уу." });
    }

    const doc = await Barimt.create({
      user: req.userId,
      docNumber: docNumber.trim(),
      price: priceNum,
      imageFile: req.file.filename,
    });
    res.status(201).json({ document: toDto(doc) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Хадгалахад алдаа гарлаа." });
  }
});

documentsRouter.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Буруу дугаар." });
    }
    const doc = await Barimt.findOne({ _id: id, user: req.userId });
    if (!doc) {
      return res.status(404).json({ error: "Баримт олдсонгүй." });
    }
    const filePath = path.join(uploadsDir, doc.imageFile);
    await fs.promises.unlink(filePath).catch(() => {});
    await Barimt.deleteOne({ _id: id, user: req.userId });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Устгахад алдаа гарлаа." });
  }
});
