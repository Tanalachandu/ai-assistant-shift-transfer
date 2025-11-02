import mongoose from "mongoose";

const shiftSchema = new mongoose.Schema({
  date: { type: String, required: true },
  urgency: { type: Number, default: 0.5 },
  shiftType: { type: String, enum: ["morning", "evening", "custom"], default: "morning" },
  startTime: { type: String, default: "09:00" }, // HH:MM (24h)
  endTime: { type: String, default: "17:00" },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Employee",
    default: null
  }
});

export default mongoose.model("Shift", shiftSchema);
