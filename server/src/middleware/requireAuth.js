import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Нэвтэрнэ үү." });
  }
  const token = header.slice(7);
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ error: "Серверийн тохиргоо дутуу." });
  }
  try {
    const payload = jwt.verify(token, secret);
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: "Токен буруу эсвэл хугацаа дууссан." });
  }
}
