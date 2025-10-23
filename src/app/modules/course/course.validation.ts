import { test } from 'node:test';
import { z } from 'zod';

const testSchema = z.object({
  testId: z.string().min(1, 'Test field is required'),
});

const lessonSchema = z.object({
  title: z.string().min(1, 'Lesson title is required'),
  order: z.number().int().min(1, 'Lesson order must be at least 1'),
  tempKey: z.string().optional(),
});

const sectionSchema = z.object({
  title: z.string().min(1, 'Section title is required'),
  order: z.number().int().min(1, 'Section order must be at least 1'),
  lessons: z.array(lessonSchema).min(1, 'At least one lesson is required'),
  tests: z.array(testSchema).optional(),
});

const lessonUpdateSchema = z.object({
  title: z.string().min(1, 'Lesson title is required').optional(),
  order: z.number().int().min(1, 'Lesson order must be at least 1').optional(),
  tempKey: z.string().optional(),
});

const sectionUpdateSchema = z.object({
  title: z.string().min(1, 'Section title is required').optional(),
  order: z.number().int().min(1, 'Section order must be at least 1').optional(),
  lessons: z
    .array(lessonUpdateSchema)
    .min(1, 'At least one lesson is required')
    .optional(),
  tests: z.array(testSchema).optional(),
});

const createCourseSchema = z.object({
  body: z.object({
    courseTitle: z.string().min(1, 'Course title is required'),
    courseShortDescription: z.string().min(1, 'Short description is required'),
    courseDescription: z.string().min(1, 'Description is required'),
    courseLevel: z.string().min(1, 'Course level is required'),
    categoryId: z.string().min(1, 'Category ID is required'),
    certificate: z.boolean().optional().default(false),
    lifetimeAccess: z.boolean().optional().default(false),
    price: z.number().nonnegative('Price must be >= 0'),
    discountPrice: z
      .number()
      .nonnegative('Discount must be >= 0')
      .optional()
      .default(0),
    instructorName: z.string().min(1, 'Instructor name is required'),
    instructorDesignation: z.string().optional(),
    instructorDescription: z.string().optional(),
    sections: z.array(sectionSchema).min(1, 'At least one section is required'),
  }),
});

const updateCourseSchema = z.object({
  body: z.object({
    courseTitle: z.string().min(1, 'Course title is required').optional(),
    courseShortDescription: z
      .string()
      .min(1, 'Short description is required')
      .optional(),
    courseDescription: z.string().min(1, 'Description is required').optional(),
    courseLevel: z.string().min(1, 'Course level is required').optional(),
    categoryId: z.string().min(1, 'Category ID is required').optional(),
    certificate: z.boolean().optional(),
    lifetimeAccess: z.boolean().optional(),
    price: z.number().nonnegative('Price must be >= 0').optional(),
    discountPrice: z.number().nonnegative('Discount must be >= 0').optional(),
    instructorName: z.string().min(1, 'Instructor name is required').optional(),
    instructorImage: z.string().url('Must be a valid URL').optional(),
    instructorDesignation: z.string().optional(),
    instructorDescription: z.string().optional(),
    courseThumbnail: z.string().url('Must be a valid URL').optional(),
    sections: z
      .array(sectionUpdateSchema)
      .min(1, 'At least one section is required')
      .optional(),
  }),
});

export const courseValidation = {
  createCourseSchema,
  updateCourseSchema,
};
