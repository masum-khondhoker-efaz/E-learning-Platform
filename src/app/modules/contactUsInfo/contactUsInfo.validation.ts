import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    location: z.string({
      required_error: 'Location is required',
    }),
    email: z
      .string({
        required_error: 'Email is required',
      })
      .email('Invalid email address'),
    phoneNumber: z.string({
      required_error: 'Phone Number is required',
    }),
  }),
});

const updateSchema = z.object({
  body: z.object({
    location: z.string().optional(),
    email: z.string().email('Invalid email address').optional(),
    phoneNumber: z.string().optional(),
  }),
});

export const contactUsInfoValidation = {
  createSchema,
  updateSchema,
};
