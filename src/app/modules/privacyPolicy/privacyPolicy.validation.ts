import { z } from 'zod';

const createPrivacyPolicySchema = z.object({
  body: z.object({
    heading: z.string().optional(),
    content: z.string({
      required_error: 'Content is required!',
    }),
  }),
});

const updatePrivacyPolicySchema = z.object({
  body: z.object({
    heading: z.string().optional(),
    content: z.string(),
  }),
});

export const privacyPolicyValidation = {
  createPrivacyPolicySchema,
  updatePrivacyPolicySchema,
};
