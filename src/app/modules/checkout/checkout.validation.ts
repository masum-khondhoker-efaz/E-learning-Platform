import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    cartId: z.string(),
    }),
});

const markCheckoutSchema = z.object({
  params: z.object({
    checkoutId: z.string(),
    paymentId: z.string(),
  }),
});

const updateSchema = z.object({
  body: z.object({
    cartId: z.string().optional(),
    }),
});

export const checkoutValidation = {
createSchema,
updateSchema,
markCheckoutSchema,
};