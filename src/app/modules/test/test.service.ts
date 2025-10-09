import prisma from '../../utils/prisma';
import { AttemptStatus, QuestionType } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { ITest } from './test.interface';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import { 
  calculatePagination, 
  formatPaginationResponse 
} from '../../utils/pagination';

const createTestIntoDb = async (userId: string, data: ITest) => {
  const findExistingTest = await prisma.test.findFirst({
    where: {
      title: data.title,
      // courseId: data.courseId,
      userId: userId,
    },
  });
  if (findExistingTest) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Test with this title already exists for the course',
    );
  }

  // Validate question orders are unique
  // const questionOrders = data.questions.map(q => q.order);
  // if (new Set(questionOrders).size !== questionOrders.length) {
  //   throw new AppError(
  //     httpStatus.BAD_REQUEST,
  //     'Question orders must be unique within a test',
  //   );
  // }

  // Validate total marks consistency
  const totalQuestionsMarks = data.questions.reduce(
    (sum, q) => sum + (q.marks ?? 0),
    0,
  );
  if (totalQuestionsMarks !== data.totalMarks) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Total questions marks (${totalQuestionsMarks}) must equal test total marks (${data.totalMarks})`,
    );
  }

  return await prisma.$transaction(async tx => {
    const test = await tx.test.create({
      data: {
        userId: userId,
        // courseId: data.courseId,
        title: data.title,
        description: data.description ? data.description : null,
        passingScore: data.passingScore,
        totalMarks: data.totalMarks,
        timeLimit: data.timeLimit,
      },
    });
    if (!test) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Test creation failed');
    }

    // Create questions one by one to get their IDs
    const createdQuestions = [];
    for (const question of data.questions) {
      // Validate question type
      const validQuestionTypes = Object.values(QuestionType);
      if (!validQuestionTypes.includes(question.type as QuestionType)) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `Invalid question type: ${question.type}`,
        );
      }

      // Validate options/answers based on type
      if (
        (question.type === QuestionType.MCQ ||
          question.type === QuestionType.TRUE_FALSE) &&
        (!question.options || question.options.length === 0)
      ) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'MCQ/TrueFalse questions must have options',
        );
      }

      if (
        question.type === QuestionType.SHORT_ANSWER &&
        (!question.answers || question.answers.length === 0)
      ) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Short answer questions must have answers',
        );
      }

      const createdQuestion = await tx.question.create({
        data: {
          testId: test.id,
          title: question.title,
          description: question.description ? question.description : null,
          type: question.type as QuestionType,
          marks: question.marks,
          explanation: question.explanation ? question.explanation : null,
          order: question.order,
        },
      });
      createdQuestions.push({ ...question, id: createdQuestion.id });
    }

    // Create options for each question
    const createOptions = createdQuestions.flatMap(question => {
      if (
        question.type === QuestionType.MCQ ||
        question.type === QuestionType.TRUE_FALSE
      ) {
        return (question.options || []).map(option => ({
          questionId: question.id,
          text: option.text,
          isCorrect: option.isCorrect,
          order: option.order,
        }));
      }
      return [];
    });

    if (createOptions.length > 0) {
      await tx.option.createMany({
        data: createOptions,
      });
    }

    // Create answers for each question
    const createAnswers = createdQuestions.flatMap(question => {
      if (question.type === QuestionType.SHORT_ANSWER) {
        return (question.answers || []).map(answer => ({
          questionId: question.id,
          text: answer.text,
          isCorrect: answer.isCorrect !== false, // Default to true if not specified
        }));
      }
      return [];
    });

    if (createAnswers.length > 0) {
      await tx.answer.createMany({
        data: createAnswers,
      });
    }

    if (createdQuestions.length === 0) {
      throw new AppError(httpStatus.BAD_REQUEST, 'No questions were created');
    }

    return await tx.test.findUnique({
      where: { id: test.id },
      include: {
        questions: {
          include: {
            options: true,
            answers: true,
          },
          orderBy: { order: 'asc' },
        },
      },
    });
  });
};

const getTestListFromDb = async (userId: string, options: ISearchAndFilterOptions) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build the complete where clause manually
  const whereQuery: any = {};

  // Add search conditions
  if (options.searchTerm) {
    whereQuery.OR = [
      {
        title: {
          contains: options.searchTerm,
          mode: 'insensitive' as const,
        },
      },
      {
        description: {
          contains: options.searchTerm,
          mode: 'insensitive' as const,
        },
      },
      {
        section: {
          course: {
            courseTitle: {
              contains: options.searchTerm,
              mode: 'insensitive' as const,
            },
          },
        },
      },
      {
        section: {
          title: {
            contains: options.searchTerm,
            mode: 'insensitive' as const,
          },
        },
      },
    ];
  }

  // Add filter conditions
  if (options.courseLevel) {
    whereQuery.section = {
      ...whereQuery.section,
      course: {
        courseLevel: options.courseLevel,
      },
    };
  }

  if (options.categoryName) {
    whereQuery.section = {
      ...whereQuery.section,
      course: {
        category: {
          name: options.categoryName,
        },
      },
    };
  }

  // Filter by passing score range
  if (options.passingScoreMin !== undefined || options.passingScoreMax !== undefined) {
    whereQuery.passingScore = {};
    if (options.passingScoreMin !== undefined) {
      whereQuery.passingScore.gte = Number(options.passingScoreMin);
    }
    if (options.passingScoreMax !== undefined) {
      whereQuery.passingScore.lte = Number(options.passingScoreMax);
    }
  }

  // Filter by total marks range
  if (options.totalMarksMin !== undefined || options.totalMarksMax !== undefined) {
    whereQuery.totalMarks = {};
    if (options.totalMarksMin !== undefined) {
      whereQuery.totalMarks.gte = Number(options.totalMarksMin);
    }
    if (options.totalMarksMax !== undefined) {
      whereQuery.totalMarks.lte = Number(options.totalMarksMax);
    }
  }

  // Filter by time limit range
  if (options.timeLimitMin !== undefined || options.timeLimitMax !== undefined) {
    whereQuery.timeLimit = {};
    if (options.timeLimitMin !== undefined) {
      whereQuery.timeLimit.gte = Number(options.timeLimitMin);
    }
    if (options.timeLimitMax !== undefined) {
      whereQuery.timeLimit.lte = Number(options.timeLimitMax);
    }
  }

  // Filter by published status
  if (options.isPublished !== undefined) {
    whereQuery.isPublished = options.isPublished;
  }

  // Sorting
  const orderBy = {
    [sortBy]: sortOrder,
  };

  // Fetch total count for pagination
  const total = await prisma.test.count({ where: whereQuery });

  if (total === 0) {
    return formatPaginationResponse([], 0, page, limit);
  }

  // Fetch paginated data
  const tests = await prisma.test.findMany({
    where: whereQuery,
    skip,
    take: limit,
    orderBy,
    include: {
      section: {
        select: {
          id: true,
          title: true,
          course: {
            select: {
              id: true,
              courseTitle: true,
              courseLevel: true,
              category: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
      questions: {
        select: {
          id: true,
          type: true,
          marks: true,
        },
      },
      _count: {
        select: {
          questions: true,
          TestAttempt: true,
        },
      },
    },
  });

  // Transform data to include additional calculated fields
  const transformedTests = tests.map(test => ({
    id: test.id,
    title: test.title,
    description: test.description,
    passingScore: test.passingScore,
    totalMarks: test.totalMarks,
    timeLimit: test.timeLimit,
    isPublished: test.isPublished,
    createdAt: test.createdAt,
    updatedAt: test.updatedAt,
    sectionId: test.sectionId,
    sectionTitle: test.section?.title,
    courseId: test.section?.course?.id,
    courseTitle: test.section?.course?.courseTitle,
    courseLevel: test.section?.course?.courseLevel,
    categoryName: test.section?.course?.category?.name,
    totalQuestions: test._count.questions,
    totalAttempts: test._count.TestAttempt,
    questionTypes: [...new Set(test.questions.map(q => q.type))],
  }));

  return formatPaginationResponse(transformedTests, total, page, limit);
};

const getTestForTakingFromDb = async (userId: string, testId: string) => {
  // 1. Fetch the test with section (or course if attached directly)
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      section: { include: { course: true } }, 
      questions: {
        include: {
          options: true,
        },
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!test ) { // || !test.isPublished
    throw new AppError(httpStatus.NOT_FOUND, 'Test not found or unpublished');
  }

  // 2. Get courseId
  const courseId = test.section?.courseId;

  // 3. Get all previous tests for the course (ordered by createdAt or order)
  const previousTests = await prisma.test.findMany({
    where: {
      sectionId: test.sectionId,
      createdAt: { lt: test.createdAt }, // tests created before this test
      isPublished: true,
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });

  if (previousTests.length > 0) {
    const previousTestIds = previousTests.map((t) => t.id);

    // 4. Check if user has attempted all previous tests
    const attemptedTests = await prisma.testAttempt.findMany({
      where: {
        userId,
        testId: { in: previousTestIds },
        status: AttemptStatus.SUBMITTED,
      },
      select: { testId: true },
    });

    const attemptedTestIds = attemptedTests.map((t) => t.testId);

    const notAttempted = previousTestIds.filter(
      (id) => !attemptedTestIds.includes(id),
    );

    if (notAttempted.length > 0) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'You must complete all previous tests in this course before attempting this one',
      );
    }
  }

  // 5. Return the test with questions
  return test;
};


const getTestByIdFromDb = async (userId: string, testId: string) => {
  const result = await prisma.test.findUnique({
    where: {
      id: testId,
    },
    include: {
      questions: {
        include: {
          options: true,
          // answers: true,
        },
        orderBy: { order: 'asc' },
      },
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'test not found');
  }
  return result;
};

const updateTestIntoDb = async (userId: string, testId: string, data: any) => {
  return await prisma.$transaction(async tx => {
    // Check if test exists and belongs to user
    const existingTest = await tx.test.findFirst({
      where: {
        id: testId,
        userId: userId,
      },
      include: {
        questions: {
          include: {
            options: true,
            answers: true,
          },
        },
      },
    });

    if (!existingTest) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        'Test not found or you do not have permission to update it',
      );
    }

    // Check for duplicate title (excluding current test)
    if (data.title && data.title !== existingTest.title) {
      const duplicateTest = await tx.test.findFirst({
        where: {
          title: data.title,
          // courseId: existingTest.courseId,
          userId: userId,
          id: { not: testId },
        },
      });
      if (duplicateTest) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Test with this title already exists for the course',
        );
      }
    }

    // Validate total marks if questions are being updated
    if (data.questions && Array.isArray(data.questions)) {
      const totalQuestionsMarks = data.questions.reduce(
        (sum: number, q: any) => sum + q.marks,
        0,
      );
      const testTotalMarks =
        data.totalMarks !== undefined
          ? data.totalMarks
          : existingTest.totalMarks;

      if (totalQuestionsMarks !== testTotalMarks) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `Total questions marks (${totalQuestionsMarks}) must equal test total marks (${testTotalMarks})`,
        );
      }

      // Validate question orders are unique
      const questionOrders = data.questions.map((q: any) => q.order);
      if (new Set(questionOrders).size !== questionOrders.length) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Question orders must be unique within a test',
        );
      }
    }

    // Update test basic info
    const updatedTest = await tx.test.update({
      where: {
        id: testId,
        userId: userId,
      },
      data: {
        title: data.title,
        description:
          data.description !== undefined
            ? data.description
            : existingTest.description,
        passingScore:
          data.passingScore !== undefined
            ? data.passingScore
            : existingTest.passingScore,
        totalMarks:
          data.totalMarks !== undefined
            ? data.totalMarks
            : existingTest.totalMarks,
        timeLimit:
          data.timeLimit !== undefined
            ? data.timeLimit
            : existingTest.timeLimit,
      },
    });

    if (!updatedTest) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Test update failed');
    }

    // Handle questions update if provided
    if (data.questions && Array.isArray(data.questions)) {
      const existingQuestions = existingTest.questions;
      const questionsToKeep: string[] = [];

      // Process each question from update data
      for (const questionData of data.questions) {
        let questionId = questionData.id;

        // Validate question type
        if (questionData.type) {
          const validQuestionTypes = Object.values(QuestionType);
          if (!validQuestionTypes.includes(questionData.type as QuestionType)) {
            throw new AppError(
              httpStatus.BAD_REQUEST,
              `Invalid question type: ${questionData.type}`,
            );
          }
        }

        if (questionId) {
          // Update existing question
          await tx.question.update({
            where: { id: questionId },
            data: {
              title: questionData.title,
              description:
                questionData.description !== undefined
                  ? questionData.description
                  : undefined,
              type: questionData.type,
              marks: questionData.marks,
              explanation:
                questionData.explanation !== undefined
                  ? questionData.explanation
                  : undefined,
              order: questionData.order,
            },
          });
          questionsToKeep.push(questionId);

          // Handle options update for MCQ/TrueFalse
          if (
            (questionData.type === QuestionType.MCQ ||
              questionData.type === QuestionType.TRUE_FALSE) &&
            questionData.options
          ) {
            // Delete existing options
            await tx.option.deleteMany({
              where: { questionId: questionId },
            });

            // Create new options
            if (questionData.options.length > 0) {
              await tx.option.createMany({
                data: questionData.options.map(
                  (option: any, index: number) => ({
                    questionId: questionId,
                    text: option.text,
                    isCorrect: option.isCorrect,
                    order:
                      option.order !== undefined ? option.order : index + 1,
                  }),
                ),
              });
            }
          }

          // Handle answers update for ShortAnswer
          if (
            questionData.type === QuestionType.SHORT_ANSWER &&
            questionData.answers
          ) {
            // Delete existing answers
            // await tx.answer.deleteMany({
            //   where: { questionId: questionId },
            // });
            // // Create new answers
            // if (questionData.answers.length > 0) {
            //   await tx.answer.createMany({
            //     data: questionData.answers.map((answer: any) => ({
            //       questionId: questionId,
            //       text: answer.text,
            //       isCorrect: answer.isCorrect !== false,
            //     })),
            //   });
            // }
          }
        } else {
          // Create new question
          const newQuestion = await tx.question.create({
            data: {
              testId: testId,
              title: questionData.title,
              description: questionData.description,
              type: questionData.type as QuestionType,
              marks: questionData.marks,
              explanation: questionData.explanation,
              order: questionData.order,
            },
          });
          questionsToKeep.push(newQuestion.id);

          // Create options for new question
          if (
            (questionData.type === QuestionType.MCQ ||
              questionData.type === QuestionType.TRUE_FALSE) &&
            questionData.options &&
            questionData.options.length > 0
          ) {
            await tx.option.createMany({
              data: questionData.options.map((option: any, index: number) => ({
                questionId: newQuestion.id,
                text: option.text,
                isCorrect: option.isCorrect,
                order: option.order !== undefined ? option.order : index + 1,
              })),
            });
          }

          // Create answers for new question
          // if (
          //   questionData.type === QuestionType.SHORT_ANSWER &&
          //   questionData.answers &&
          //   questionData.answers.length > 0
          // ) {
          //   await tx.answer.createMany({
          //     data: questionData.answers.map((answer: any) => ({
          //       questionId: newQuestion.id,
          //       text: answer.text,
          //       isCorrect: answer.isCorrect !== false,
          //     })),
          //   });
          // }
        }
      }

      // Delete questions that are no longer present
      const questionsToDelete = existingQuestions.filter(
        q => !questionsToKeep.includes(q.id),
      );
      if (questionsToDelete.length > 0) {
        const questionIdsToDelete = questionsToDelete.map(q => q.id);

        // Delete options and answers first (due to foreign key constraints)
        await tx.option.deleteMany({
          where: { questionId: { in: questionIdsToDelete } },
        });

        await tx.answer.deleteMany({
          where: { questionId: { in: questionIdsToDelete } },
        });

        // Delete the questions
        await tx.question.deleteMany({
          where: { id: { in: questionIdsToDelete } },
        });
      }
    }

    // Return the fully updated test with all relations
    return await tx.test.findUnique({
      where: { id: testId },
      include: {
        questions: {
          include: {
            options: true,
            answers: true,
          },
          orderBy: { order: 'asc' },
        },
      },
    });
  });
};

const deleteTestItemFromDb = async (userId: string, testId: string) => {
  const deletedItem = await prisma.test.delete({
    where: {
      id: testId,
      userId: userId,
    },
    include: {
      questions: {
        include: {
          options: true,
          // answers: true
        },
      },
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'testId, not deleted');
  }

  return deletedItem;
};

export const testService = {
  createTestIntoDb,
  getTestListFromDb,
  getTestForTakingFromDb,
  getTestByIdFromDb,
  updateTestIntoDb,
  deleteTestItemFromDb,
};
