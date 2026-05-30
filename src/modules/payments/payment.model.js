import mongoose from "mongoose";

const paymentFileSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    file: { type: String, default: null },
    mimeType: { type: String, default: "" },
    size: { type: Number, default: null },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const paymentSideSchema = new mongoose.Schema(
  {
    amount: { type: Number, default: 0 },
    status: { type: String, default: "Pending" },
    method: { type: String, default: "" },
    dueDate: { type: Date, default: null },
    paidDate: { type: Date, default: null },
    releaseDays: { type: Number, default: null },
    notes: { type: String, default: "" },
    transactionReference: { type: String, default: "" },
    proof: { type: paymentFileSchema, default: null },
  },
  { _id: false }
);

const paymentAuditSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    target: { type: String, required: true },
    action: { type: String, required: true },
    status: { type: String, default: "" },
    note: { type: String, default: "" },
    changedById: { type: String, default: null },
    changedByRole: { type: String, default: null },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    orderId: { type: String, required: true, unique: true, index: true },
    orderStatus: { type: String, default: "" },
    serviceType: { type: String, default: "" },
    clientUserId: { type: String, required: true, index: true },
    clientName: { type: String, default: "" },
    clientEmail: { type: String, default: "", lowercase: true, index: true },
    clientCompany: { type: String, default: "" },
    notaryId: { type: String, default: null, index: true },
    notaryName: { type: String, default: "" },
    notaryEmail: { type: String, default: "", lowercase: true },
    totalClientAmount: { type: Number, default: 0 },
    notaryPayoutAmount: { type: Number, default: 0 },
    companyRevenueAmount: { type: Number, default: 0 },
    clientPayment: { type: paymentSideSchema, default: () => ({}) },
    notaryPayout: { type: paymentSideSchema, default: () => ({}) },
    auditLog: { type: [paymentAuditSchema], default: [] },
  },
  {
    timestamps: true,
  }
);

export const PaymentModel =
  mongoose.models.Payment || mongoose.model("Payment", paymentSchema);
