import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    userEmail: z.string().email('Invalid email format'),
    userPhone: z.string(),
    message: z.string().min(1, 'Message is required'),
  }),
});

const updateSchema = z.object({
  body: z.object({
    message: z.string().min(1, 'Message is required'),
  }),
});

export const supportValidation = {
  createSchema,
  updateSchema,
};
