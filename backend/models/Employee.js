import mongoose from "mongoose";

const employeeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, default: "" },
  skill_match: { type: Number, default: 0 },
  preference: { type: Number, default: 0 },
  availability: { type: Number, default: 0 },
  attendance_score: { type: Number, default: 0 },
  recent_swaps: { type: Number, default: 0 },
  preferredShift: { type: String, enum: ["morning", "evening", "none"], default: "none" },
});

export default mongoose.model("Employee", employeeSchema);
