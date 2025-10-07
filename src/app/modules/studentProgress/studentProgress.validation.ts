import { test } from 'node:test';
import { z } from 'zod';

const markTestCompletedSchema = z.object({
  body: z.object({
    testId: z.string({ required_error: 'Test ID is required' }),
  }),
});
const markLessonCompletedSchema = z.object({
  body: z.object({
    lessonId: z.string({ required_error: 'Lesson ID is required' })
  })
});

    
const updateSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    }),
});

export const studentProgressValidation = {
  markTestCompletedSchema,
  markLessonCompletedSchema,
  updateSchema,
};