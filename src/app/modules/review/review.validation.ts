import { z } from 'zod';

const createReviewSchema = z.object({
  body: z.object({
    barberId: z.string().min(1, 'Barber ID is required'),
    saloonOwnerId: z.string().min(1, 'Saloon Owner ID is required'),
    bookingId: z.string().min(1, 'Booking ID is required'),
    rating: z
      .number()
      .int()
      .min(1, 'Rating must be at least 1')
      .max(5, 'Rating cannot exceed 5'),
    comment: z.string().optional(),
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
