import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
     userId: z.string().optional(),
    subject: z.string().optional(),
    type: z.enum(['CUSTOMER_QUESTION', 'CUSTOMER_COMPLAINT'], {
      required_error: 'Type is required!',
    }),
    saloonOwnerId: z.string().optional(),
    message: z.string().optional(),
    }),
});

const updateSchema = z.object({
  body: z.object({
    userId: z.string().optional(),
    subject: z.string().optional(),
    type: z.enum(['CUSTOMER_QUESTION', 'CUSTOMER_COMPLAINT'], {
      required_error: 'Type is required!',
    }).optional(),
    saloonOwnerId: z.string().optional(),
    message: z.string().optional(),
    }),
});

export const supportRepliesValidation = {
createSchema,
updateSchema,
};