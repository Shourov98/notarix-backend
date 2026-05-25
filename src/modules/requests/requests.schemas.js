import { z } from "zod";

export const createRequestSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional().default(""),
    companyName: z.string().optional().default(""),
    contactType: z.string().min(1),
    requestType: z.string().min(1),
    state: z.string().optional().default(""),
    message: z.string().optional().default(""),
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});

export const rejectRequestSchema = z.object({
  body: z.object({
    reason: z.string().min(1),
  }),
  query: z.object({}).passthrough(),
  params: z.object({
    id: z.string().min(1),
  }),
});
