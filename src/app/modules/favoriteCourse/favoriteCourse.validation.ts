import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    courseId: z.string({ required_error: 'courseId is required' }),
    }),
});

const updateSchema = z.object({
  body: z.object({
    courseId: z.string().optional(),
    }),
});

export const favoriteCourseValidation = {
createSchema,
updateSchema,
};