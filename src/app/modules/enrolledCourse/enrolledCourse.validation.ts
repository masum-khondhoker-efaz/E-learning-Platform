import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    courseId: z.string().min(1, 'CourseId is required'),
  }),
});

const updateSchema = z.object({
  body: z.object({
    courseId: z.string().optional(),
  }),
});

export const enrolledCourseValidation = {
  createSchema,
  updateSchema,
};
