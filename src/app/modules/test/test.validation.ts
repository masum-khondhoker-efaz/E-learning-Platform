import { z } from 'zod';

// ------------------- Option -------------------
const optionSchema = z.object({
  questionId: z.string().optional(), // set internally usually
  text: z.string(),
  isCorrect: z.boolean().default(false),
  order: z.number(),
});

// ------------------- Answer -------------------
const answerSchema = z.object({
  id: z.string().optional(),
  questionId: z.string().optional(),
  text: z.string(),
  isCorrect: z.boolean().default(true),
});

// ------------------- Question -------------------
const questionSchema = z.object({
  testId: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  type: z.enum(['MCQ', 'TRUE_FALSE', 'SHORT_ANSWER']), // your QuestionType enum
  marks: z.number().default(1),
  explanation: z.string().optional(),
  order: z.number().optional(),
  isActive: z.boolean().default(true),

  options: z.array(optionSchema).optional(), // for MCQ, True/False
  answers: z.array(answerSchema).optional(), // for short answers
});

// ------------------- Test -------------------
const createTestSchema = z.object({
  body: z.object({
    courseId: z.string().min(1, 'Course ID is required'),
    title: z.string().min(1, 'Test title is required'),
    description: z.string().optional(),
    passingScore: z.number().default(60),
    totalMarks: z.number().default(100),
    timeLimit: z.number().optional(),
    isActive: z.boolean().default(true),
    isPublished: z.boolean().default(false),

    questions: z.array(questionSchema),
  }),
});

// ------------------- Update Schema -------------------
const updateTestSchema = createTestSchema.deepPartial();

export const testValidation = {
  createTestSchema,
  updateTestSchema,
};
