import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true }, // e.g., ai_assign, ai_unassign
    actor: { type: String, default: "ai" }, // ai/system/user
    message: { type: String, required: true },
    before: { type: Object, default: {} },
    after: { type: Object, default: {} },
    metadata: { type: Object, default: {} },
  },
  { timestamps: true }
);

export default mongoose.model("AuditLog", auditLogSchema);


