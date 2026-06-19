import { z } from "zod";

const objectIdLike = z.string().trim().min(1).optional();
const trimmedString = z.string().trim().min(1);

export const supportTicketCreateSchema = z
  .object({
    body: z.object({}),
  })
  .passthrough()
  .transform((req) => ({
    body: {
      subject: trimmedString.parse(req.body?.subject),
      body: z.string().trim().min(1).parse(req.body?.body),
      priority: z
        .enum(["low", "normal", "high", "urgent"])
        .default("normal")
        .parse(req.body?.priority),
      requesterEmail: z
        .string()
        .trim()
        .email()
        .optional()
        .parse(req.body?.requesterEmail),
    },
  }));

export const supportTicketUpdateSchema = z
  .object({
    body: z.object({}),
  })
  .passthrough()
  .transform((req) => ({
    body: {
      status: z
        .enum(["Open", "Pending", "Resolved", "Closed"])
        .optional()
        .parse(req.body?.status),
      assigneeId: objectIdLike.parse(req.body?.assigneeId),
      notes: z.union([z.string().trim().min(1), z.array(z.any())]).optional().parse(req.body?.notes),
      reply: z.string().trim().min(1).optional().parse(req.body?.reply),
      replyAuthor: z.string().trim().min(1).optional().parse(req.body?.replyAuthor),
    },
  }));

export const companySettingsUpdateSchema = z
  .object({
    body: z.object({}),
  })
  .passthrough()
  .transform((req) => ({
    body: {
      name: z.string().trim().min(1).optional().parse(req.body?.name),
      legalName: z.string().trim().min(1).optional().parse(req.body?.legalName),
      taxId: z.string().trim().optional().parse(req.body?.taxId),
      supportEmail: z.string().trim().email().optional().parse(req.body?.supportEmail),
      supportPhone: z.string().trim().optional().parse(req.body?.supportPhone),
      address: z
        .object({
          line1: z.string().trim().optional(),
          line2: z.string().trim().optional(),
          city: z.string().trim().optional(),
          state: z.string().trim().optional(),
          zip: z.string().trim().optional(),
          country: z.string().trim().optional(),
        })
        .partial()
        .optional()
        .parse(req.body?.address),
      branding: z
        .object({
          primaryColor: z.string().trim().optional(),
          accentColor: z.string().trim().optional(),
          logoUrl: z.string().trim().optional(),
        })
        .partial()
        .optional()
        .parse(req.body?.branding),
    },
  }));

export const notificationPreferencesUpdateSchema = z
  .object({
    body: z.object({}),
  })
  .passthrough()
  .transform((req) => ({
    body: {
      email: z.boolean().optional().parse(req.body?.email),
      inApp: z.boolean().optional().parse(req.body?.inApp),
      orderEvents: z.boolean().optional().parse(req.body?.orderEvents),
      messageEvents: z.boolean().optional().parse(req.body?.messageEvents),
      weeklyDigest: z.boolean().optional().parse(req.body?.weeklyDigest),
    },
  }));
