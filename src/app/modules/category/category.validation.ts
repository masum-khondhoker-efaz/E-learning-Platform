import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
  }),
});

const updateSchema = z.object({
  body: z.object({
    name: z.string().optional(),
  }),
});

export const categoryValidation = {
  createSchema,
  updateSchema,
};
