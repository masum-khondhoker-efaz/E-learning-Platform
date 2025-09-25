import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    companyId: z.string().nonempty({ message: 'companyId is required' }),
    // description: z.string().optional(),
    }),
});

const updateSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    }),
});

export const companyPurchaseValidation = {
createSchema,
updateSchema,
};