import { z } from 'zod';

const createReviewSchema = z.object({
  body: z.object({
    courseId: z.string().min(1, 'Course ID is required'),
    rating: z
      .number()
      .int()
      .min(1, 'Rating must be at least 1')
      .max(5, 'Rating cannot exceed 5'),
    comment: z.string(),
  }),
});

const updateReviewSchema = z.object({
  body: z.object({
    rating: z
      .number()
      .int()
      .min(1, 'Rating must be at least 1')
      .max(5, 'Rating cannot exceed 5')
      .optional(),
    comment: z.string().optional(),
  }),
});

export const reviewValidation = {
  createReviewSchema,
  updateReviewSchema,
};
