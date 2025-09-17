import { z } from 'zod';

// Base schema for each response
const baseResponseSchema = z.object({
  questionId: z.string(),
  questionType: z.enum(['MCQ', 'TRUE_FALSE', 'SHORT_ANSWER']),
});

// For MCQ and True/False
const optionResponseSchema = baseResponseSchema.extend({
  questionType: z.enum(['MCQ', 'TRUE_FALSE']),
  selectedOptions: z.array(z.string()),
});

// For Short Answer
const shortAnswerResponseSchema = baseResponseSchema.extend({
  questionType: z.literal('SHORT_ANSWER'),
  shortAnswer: z.string().optional(),
});

// Union of all possible responses
const responseSchema = z.union([
  optionResponseSchema,
  shortAnswerResponseSchema,
]);

// Main submission schema
const testAttemptSchema = z.object({
  body: z.object({
    testId: z.string(),
    responses: z
      .array(responseSchema)
      .min(1, 'At least one response is required'),
    totalTimeSpent: z
      .number()
      .min(0, 'Time spent cannot be negative')
      .optional(),
  }),
});

const updateAttemptSchema = z.object({
  body: z.object({
    responses: z
      .array(responseSchema)
      .min(1, 'At least one response is required')
      .optional(),
    totalTimeSpent: z
      .number()
      .min(0, 'Time spent cannot be negative')
      .optional(),
  }),
});

const gradingSchema = z.object({
  body: z.object({
    gradings: z
      .array(
        z.object({
          responseId: z.string(),
          marks: z.number().min(0, 'Awarded marks cannot be negative'),
          notes: z.string().optional(),
        }),
      )
      .min(1, 'At least one grading entry is required'),
  }),
});

export const testAttemptValidation = {
  testAttemptSchema,
  updateAttemptSchema,
  gradingSchema,
};
