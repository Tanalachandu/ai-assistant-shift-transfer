import mongoose from "mongoose";

const leaveSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    reason: { type: String, default: "" },
    status: { type: String, enum: ["requested", "approved", "rejected"], default: "requested" },
  },
  { timestamps: true }
);

leaveSchema.index({ employee: 1, date: 1 });

export default mongoose.model("Leave", leaveSchema);


