import mongoose from "mongoose";

const winnerSchema = new mongoose.Schema(
  {
    doc: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Barimt",
      required: true,
      unique: true,
      index: true,
    },
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
    contact: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    prize: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
      default: "Lucky Wheel",
    },
  },
  { timestamps: true }
);

winnerSchema.index({ createdAt: -1 });

export const Winner = mongoose.model("Winner", winnerSchema);
