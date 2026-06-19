import test from "node:test";
import assert from "node:assert/strict";
import {
  ORDER_STATUSES,
  canTransitionOrderStatus,
  getOrderTransitionError,
  requiresCompletedDocumentsForCompletion,
  serializeStatus,
} from "./order-workflow.service.js";

test("order workflow exposes all supported statuses", () => {
  assert.deepEqual(ORDER_STATUSES, [
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
  ]);
});

test("order workflow allows only valid forward transitions", () => {
  assert.equal(canTransitionOrderStatus("Pending Admin Review", "Accepted By Admin"), true);
  assert.equal(canTransitionOrderStatus("Accepted By Admin", "Notary Assigned"), true);
  assert.equal(canTransitionOrderStatus("Notary Assigned", "Accepted By Notary"), true);
  assert.equal(canTransitionOrderStatus("Accepted By Notary", "In Progress"), true);
  assert.equal(canTransitionOrderStatus("In Progress", "Completed"), true);

  assert.equal(canTransitionOrderStatus("Notary Assigned", "In Progress"), false);
  assert.equal(canTransitionOrderStatus("Pending Admin Review", "Completed"), false);
  assert.equal(canTransitionOrderStatus("Completed", "Cancelled"), false);
});

test("order workflow returns readable errors for invalid transitions", () => {
  assert.equal(
    getOrderTransitionError("Pending Admin Review", "Completed"),
    'Order in status "Pending Admin Review" cannot be completed.'
  );
  assert.equal(getOrderTransitionError("In Progress", "Completed"), null);
});

test("order status serialization matches dashboard buckets", () => {
  assert.equal(serializeStatus("Pending Admin Review"), "Pending");
  assert.equal(serializeStatus("Accepted By Admin"), "Pending");
  assert.equal(serializeStatus("Notary Assigned"), "Assigned");
  assert.equal(serializeStatus("Completed"), "Completed");
});

test("completion requires at least one completed document", () => {
  assert.equal(requiresCompletedDocumentsForCompletion({ completedDocuments: [] }), true);
  assert.equal(
    requiresCompletedDocumentsForCompletion({
      completedDocuments: [{ id: "doc-1", name: "signed.pdf" }],
    }),
    false
  );
});
