import { z } from 'zod';

const certificateContentSchema = z.object({
  body: z.object({
    courseId: z.string().min(1, 'Course ID is required'), // MongoDB ObjectId
    title: z.string().min(1, 'Title is required'), // Certificate title
    htmlContent: z.string().min(1, 'HTML content is required'), // HTML template string
    placeholders: z
      .array(
        z.enum([
          '${fullName}',
          '${dob}',
          '${startDate}',
          '${endDate}',
          '${certificateNumber}',
        ]),
      )
      // .nonempty('At least one placeholder required'),
  }),
});

const updateSchema = z.object({
  body: z.object({
    courseId: z.string().min(1, 'Course ID is required').optional(), // MongoDB ObjectId
    title: z.string().min(1, 'Title is required').optional(), // Certificate title
    htmlContent: z.string().min(1, 'HTML content is required').optional(), // HTML template string
    placeholders: z
      .array(
        z.enum([
          '${fullName}',
          '${dob}',
          '${startDate}',
          '${endDate}',
          '${certificateNumber}',
        ]),
      )
      // .nonempty('At least one placeholder required')
      .optional(),
  }),
});

export const certificateContentValidation = {
  certificateContentSchema,
  updateSchema,
};
