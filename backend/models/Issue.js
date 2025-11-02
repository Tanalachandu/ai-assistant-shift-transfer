import mongoose from "mongoose";

const issueSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["understaffed_shift", "possible_absenteeism", "sudden_leave"], required: true },
    severity: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    message: { type: String, required: true },
    metadata: { type: Object, default: {} },
    resolved: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Issue", issueSchema);


