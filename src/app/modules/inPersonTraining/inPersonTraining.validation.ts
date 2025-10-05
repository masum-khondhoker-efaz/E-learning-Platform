import { z } from 'zod';

const InPersonTrainingStatusEnum = z.enum([
  'PENDING',
  'CONFIRMED',
  'CANCELLED',
  'COMPLETED',
]);
const createSchema = z.object({
  body: z.object({
    // userId: z.string().min(1, 'User ID is required'), // MongoDB ObjectId
    courseId: z.string().min(1, 'Course ID is required'),
    location: z.string().optional(),
    duration: z.number().int().positive().optional(), // hours
    price: z.number().positive().optional(),
    status: InPersonTrainingStatusEnum.optional().default('PENDING'),
  }),
});

const updateSchema = z.object({
  body: z.object({
    location: z.string().optional(),
    duration: z.number().int().positive().optional(), // hours
    price: z.number().positive().optional(),
    status: InPersonTrainingStatusEnum.optional(),
  }),
});

export const inPersonTrainingValidation = {
  createSchema,
  updateSchema,
};
