import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    heading: z.string().optional(),
    content: z.string().min(1, 'Name is required'),
  }),
});

const updateSchema = z.object({
  body: z.object({
    heading: z.string().optional(),
    content: z.string().min(1, 'Name is required'),
  }),
});

export const helpAndSupportValidation = {
  createSchema,
  updateSchema,
};
