import mongoose from "mongoose";

const orderDocumentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    status: {
      type: String,
      enum: ["Pending", "Verified", "Rejected"],
      default: "Pending",
    },
    reviewNote: { type: String, default: "" },
    provider: { type: String, default: "local" },
    file: { type: String, default: null },
    url: { type: String, default: null },
    mimeType: { type: String, default: null },
    size: { type: Number, default: null },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    note: { type: String, default: "" },
    changedById: { type: String, default: null },
    changedByRole: { type: String, default: null },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    clientUserId: { type: String, required: true, index: true },
    clientEmail: { type: String, required: true, lowercase: true, index: true },
    clientName: { type: String, required: true },
    clientCompany: { type: String, default: "" },
    vendorCode: { type: String, default: "" },
    serviceType: { type: String, required: true },
    signerFirstName: { type: String, required: true },
    signerLastName: { type: String, required: true },
    signerName: { type: String, required: true },
    signerPhone: { type: String, required: true },
    signerEmail: { type: String, required: true, lowercase: true },
    hasSecondarySigner: { type: Boolean, default: false },
    propertyAddress: {
      line1: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zip: { type: String, required: true },
      timeZone: { type: String, default: "" },
    },
    signingDate: { type: String, required: true },
    signingTime: { type: String, required: true },
    feeAmount: { type: Number, required: true },
    paymentStatus: { type: String, default: "Pending" },
    paymentMethod: { type: String, default: "" },
    dueDate: { type: String, default: "" },
    paidDate: { type: String, default: "" },
    paymentNotes: { type: String, default: "" },
    paperSize: { type: String, default: "Letter" },
    preferredInk: { type: String, default: "Black" },
    estimatedPages: { type: String, default: "" },
    isRon: { type: Boolean, default: false },
    specialInstructions: { type: String, default: "" },
    documents: { type: [orderDocumentSchema], default: [] },
    completedDocuments: { type: [orderDocumentSchema], default: [] },
    adminReviewReason: { type: String, default: "" },
    notaryOfferAmount: { type: Number, default: null },
    payoutReleaseDays: { type: Number, default: null },
    payoutDueDate: { type: Date, default: null },
    assignmentNotes: { type: String, default: "" },
    status: {
      type: String,
      enum: [
        "Pending Admin Review",
        "Accepted By Admin",
        "Rejected By Admin",
        "Notary Assigned",
        "Accepted By Notary",
        "Rejected By Notary",
        "Needs Reassignment",
        "In Progress",
        "Completed",
        "Cancelled",
      ],
      default: "Pending Admin Review",
    },
    notaryId: { type: String, default: null },
    notary: { type: String, default: "Unassigned" },
    statusHistory: { type: [statusHistorySchema], default: [] },
  },
  {
    timestamps: true,
  }
);

export const OrderModel =
  mongoose.models.Order || mongoose.model("Order", orderSchema);
