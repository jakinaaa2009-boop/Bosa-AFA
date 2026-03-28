import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const adminSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 64,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
  },
  { timestamps: true }
);

adminSchema.set("toJSON", {
  transform(_doc, ret) {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

export const Admin = mongoose.model("Admin", adminSchema);

export async function ensureDefaultAdmin() {
  const username = "admin";
  const plainPassword = "admin123";
  const passwordHash = await bcrypt.hash(plainPassword, 10);

  await Admin.updateOne(
    { username },
    { $set: { username, passwordHash } },
    { upsert: true }
  );
}
