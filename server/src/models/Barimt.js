import mongoose from "mongoose";

const barimtSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    docNumber: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    imageFile: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

barimtSchema.index({ user: 1, createdAt: -1 });

export const Barimt = mongoose.model("Barimt", barimtSchema);
