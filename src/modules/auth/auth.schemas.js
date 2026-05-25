import { z } from "zod";

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});

export const emailSchema = z.object({
  body: z.object({
    email: z.string().email(),
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    email: z.string().email(),
    otp: z.string().min(4).max(6),
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    email: z.string().email(),
    new_password: z.string().min(8),
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1),
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});

export const changePasswordSchema = z.object({
  body: z.object({
    current_password: z.string().min(1),
    new_password: z.string().min(8),
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});
