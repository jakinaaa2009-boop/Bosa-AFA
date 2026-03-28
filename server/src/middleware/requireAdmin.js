import jwt from "jsonwebtoken";

export function requireAdmin(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Админ нэвтэрнэ үү." });
  }

  const token = header.slice(7);
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ error: "Серверийн тохиргоо дутуу." });
  }

  try {
    const payload = jwt.verify(token, secret);
    if (payload?.role !== "admin") {
      return res.status(403).json({ error: "Админ эрх шаардлагатай." });
    }
    req.adminId = payload.sub;
    req.adminUsername = payload.username;
    next();
  } catch {
    return res.status(401).json({ error: "Токен буруу эсвэл хугацаа дууссан." });
  }
}
