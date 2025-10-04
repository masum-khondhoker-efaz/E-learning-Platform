import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    }),
});

const updateSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format').optional(),
    }),
});

export const newsletterSubscriberValidation = {
createSchema,
updateSchema,
};