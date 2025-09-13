import { z } from 'zod';

const createTermAndConditionSchema = z.object({
  body: z.object({
    // heading: z.string({
    //   required_error: 'Heading is required!',
    // }),
    content: z.string({
      required_error: 'Content is required!',
    }),
  }),
});

const updateTermAndConditionSchema = z.object({
  body: z.object({
    // heading: z.string().optional(),
    content: z.string().optional(),
  }),
});
export const termAndConditionValidation = {
  createTermAndConditionSchema,
  updateTermAndConditionSchema,
};