import { mutateStore } from "../../store.js";

export const queueEmail = async ({
  to,
  subject,
  html,
  text,
  category = "transactional",
}) => {
  const emailJob = {
    id: `email-${Date.now()}`,
    to,
    subject,
    html,
    text,
    category,
    status: "queued",
    createdAt: new Date().toISOString(),
  };

  await mutateStore((store) => {
    store.emailQueue = [emailJob, ...(store.emailQueue || [])];
  });

  console.log(`Email queued for ${to}: ${subject}`);
  return emailJob;
};
