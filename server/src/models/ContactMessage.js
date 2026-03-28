import mongoose from "mongoose";

const contactMessageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, maxlength: 254 },
    message: { type: String, required: true, trim: true, maxlength: 4000 },
  },
  { timestamps: true }
);

export const ContactMessage = mongoose.model(
  "ContactMessage",
  contactMessageSchema
);
