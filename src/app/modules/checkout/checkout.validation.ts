import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
     all: z.boolean().optional(), // checkout all items if true
    courseIds: z.array(z.string()).optional(), // specific courseIds for partial checkout
    }),
});

const markCheckoutSchema = z.object({
  body: z.object({
    checkoutId: z.string({
      required_error: 'checkoutId is required',
    }),
    paymentId: z.string({
      required_error: 'paymentId is required',
    }),
  }),
});

const updateSchema = z.object({
  body: z.object({
     all: z.boolean().optional(), // checkout all items if true
    courseIds: z.array(z.string()).optional(), // specific courseIds for partial checkout
    }),
});

export const checkoutValidation = {
createSchema,
updateSchema,
markCheckoutSchema,
};