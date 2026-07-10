export const ORDER_STATUSES = [
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
];

export const ORDER_STATUS_TRANSITIONS = {
  "Pending Admin Review": ["Accepted By Admin", "Rejected By Admin", "Cancelled"],
  "Accepted By Admin": ["Notary Assigned", "Rejected By Admin", "Cancelled"],
  "Rejected By Admin": [],
  "Notary Assigned": ["Accepted By Notary", "Rejected By Notary", "Needs Reassignment", "Cancelled"],
  "Accepted By Notary": ["In Progress", "Needs Reassignment", "Cancelled"],
  "Rejected By Notary": ["Needs Reassignment"],
  "Needs Reassignment": ["Notary Assigned", "Cancelled"],
  "In Progress": ["Completed", "Cancelled"],
  "Completed": [],
  "Cancelled": [],
};

const TRANSITION_LABELS = {
  "Accepted By Admin": "accepted by admin",
  "Rejected By Admin": "rejected by admin",
  "Notary Assigned": "assigned to a notary",
  "Accepted By Notary": "accepted by the notary",
  "Rejected By Notary": "rejected by the notary",
  "Needs Reassignment": "returned for reassignment",
  "In Progress": "started",
  "Completed": "completed",
  "Cancelled": "cancelled",
};

export const serializeStatus = (status) => {
  switch (status) {
    case "Pending Admin Review":
    case "Accepted By Admin":
    case "Needs Reassignment":
      return "Pending";
    case "Rejected By Admin":
      return "Rejected";
    case "Notary Assigned":
    case "Accepted By Notary":
      return "Assigned";
    default:
      return status;
  }
};

export const canTransitionOrderStatus = (currentStatus, nextStatus) => {
  if (!currentStatus || !nextStatus) return false;
  if (currentStatus === nextStatus) return true;
  return (ORDER_STATUS_TRANSITIONS[currentStatus] || []).includes(nextStatus);
};

export const getOrderTransitionError = (currentStatus, nextStatus) => {
  if (canTransitionOrderStatus(currentStatus, nextStatus)) {
    return null;
  }

  const target = TRANSITION_LABELS[nextStatus] || nextStatus;
  return `Order in status "${currentStatus}" cannot be ${target}.`;
};

export const isTerminalOrderStatus = (status) =>
  status === "Completed" || status === "Cancelled" || status === "Rejected By Admin";

export const requiresCompletedDocumentsForCompletion = (order) =>
  (order.completedDocuments || []).length === 0;
