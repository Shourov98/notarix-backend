import { EmailJobModel } from "./email-job.model.js";

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

  await EmailJobModel.create(emailJob);

  console.log(`Email queued for ${to}: ${subject}`);
  return emailJob;
};
