import prisma from '../../utils/prisma';
import {
  AttemptStatus,
  QuestionType,
  ResponseStatus,
  UserRoleEnum,
  UserStatus,
} from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

const createTestAttemptIntoDb = async (userId: string, data: any) => {
  const result = await prisma.testAttempt.create({
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'testAttempt not created');
  }
  return result;
};

function arraysEqual(
  selectedOptions: any,
  correctOptionIds: string[],
): boolean | null {
  if (!Array.isArray(selectedOptions) || !Array.isArray(correctOptionIds))
    return null;
  if (selectedOptions.length !== correctOptionIds.length) return false;
  const selectedSet = new Set(selectedOptions);
  const correctSet = new Set(correctOptionIds);
  if (selectedSet.size !== correctSet.size) return false;
  for (const id of selectedSet) {
    if (!correctSet.has(id)) return false;
  }
  return true;
}

const submitTestAttemptIntoDb = async (userId: string, data: any) => {
  return await prisma.$transaction(async tx => {
    // Check if test exists
    const test = await tx.test.findUnique({
      where: { id: data.testId },
      include: {
        questions: {
          include: {
            options: true,
          },
        },
      },
    });

    if (!test) {
      throw new AppError(httpStatus.NOT_FOUND, 'Test not found');
    }

    // Check if user has already attempted this test
    const existingAttempt = await tx.testAttempt.findFirst({
      where: {
        testId: data.testId,
        userId: userId,
      },
    });

    if (existingAttempt) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'You have already attempted this test',
      );
    }

    // Validate all questions belong to this test
    const questionIds = data.responses.map((r: any) => r.questionId);
    const testQuestionIds = test.questions.map(q => q.id);

    const invalidQuestions = questionIds.filter(
      (id: string) => !testQuestionIds.includes(id),
    );
    if (invalidQuestions.length > 0) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Invalid question IDs: ${invalidQuestions.join(', ')}`,
      );
    }

    let totalAutoScore = 0;
    const hasShortAnswers = data.responses.some(
      (r: any) => r.questionType === QuestionType.SHORT_ANSWER,
    );

    // Create test attempt
    const attempt = await tx.testAttempt.create({
      data: {
        userId: userId,
        testId: data.testId,
        score: 0, // Will be updated after calculating
        percentage: 0, // Will be updated after calculating
        isPassed: false, // Will be updated after calculating
        totalMarks: test.totalMarks!,
        timeSpent: data.totalTimeSpent,
        status: hasShortAnswers
          ? AttemptStatus.UNDER_REVIEW
          : AttemptStatus.GRADED,
        completedAt: new Date(),
      },
    });
    // Process each response
    for (const responseData of data.responses) {
      const question = test.questions.find(
        q => q.id === responseData.questionId,
      );
      if (!question) continue;

      let isCorrect: boolean | null = null;
      let marksObtained: number | null = null;
      let status: ResponseStatus = ResponseStatus.SUBMITTED;

      // Auto-grade MCQ and TRUE_FALSE questions
      if (
        question.type === QuestionType.MCQ ||
        question.type === QuestionType.TRUE_FALSE
      ) {
        const correctOptionIds = question.options
          .filter(opt => opt.isCorrect)
          .map(opt => opt.id);

        const selectedOptions = responseData.selectedOptions || [];
        isCorrect = arraysEqual(selectedOptions, correctOptionIds);
        marksObtained = isCorrect ? question.marks : 0;
        status = ResponseStatus.AUTO_GRADED;
        totalAutoScore += marksObtained;
      }

      // Create user response
      await tx.userResponse.create({
        data: {
          attemptId: attempt.id,
          questionId: responseData.questionId,
          questionType: question.type as QuestionType,
          selectedOptions: responseData.selectedOptions || [],
          shortAnswer: responseData.shortAnswer || null,
          isCorrect: isCorrect,
          marksObtained: marksObtained,
          status: status,
          timeSpent: responseData.timeSpent || 0,
        },
      });
    }

    // Update attempt with auto-score and final status
    if (test.totalMarks == null) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'Test totalMarks is null',
      );
    }
    const percentage = (totalAutoScore / test.totalMarks) * 100;
    const isPassed = percentage >= test.passingScore;

    const updatedAttempt = await tx.testAttempt.update({
      where: { id: attempt.id },
      data: {
        score: totalAutoScore,
        percentage: percentage,
        isPassed: isPassed,
        completedAt: new Date(),
        // Only update status if no short answers (otherwise keep as UNDER_REVIEW)
        status: hasShortAnswers
          ? AttemptStatus.UNDER_REVIEW
          : AttemptStatus.GRADED,
      },
      include: {
        responses: {
          include: {
            question: {
              select: {
                title: true,
                type: true,
                marks: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            image: true,
          },
        },
        test: {
          select: {
            title: true,
            totalMarks: true,
            passingScore: true,
          },
        },
      },
    });

    return updatedAttempt;
  });
};

const getTestAttemptListFromDb = async (userId: string) => {
  const result = await prisma.testAttempt.findMany();
  if (result.length === 0) {
    return { message: 'No testAttempt found' };
  }
  return result;
};

const getTestAttemptByIdFromDb = async (
  userId: string,
  testAttemptId: string,
) => {
  const result = await prisma.testAttempt.findUnique({
    where: {
      id: testAttemptId,
    },
    include: {
      responses: {
        include: {
          question: {
            select: {
              title: true,
              type: true,
              marks: true,
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          image: true,
        },
      },
      test: {
        select: {
          title: true,
          totalMarks: true,
          passingScore: true,
        },
      },
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'testAttempt not found');
  }
  return result;
};

const updateTestAttemptIntoDb = async (
  userId: string,
  testAttemptId: string,
  data: any,
) => {
  const result = await prisma.testAttempt.update({
    where: {
      id: testAttemptId,
      userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'testAttemptId, not updated');
  }
  return result;
};

const gradeShortAnswers = async (
  userId: string,
  attemptId: string,
  gradings: any[],
) => {
  // Validate gradings parameter
  if (!gradings || !Array.isArray(gradings)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Gradings must be provided as an array',
    );
  }

  return await prisma.$transaction(async tx => {
    // Check if attempt exists and get details
    const attempt = await tx.testAttempt.findUnique({
      where: { id: attemptId },
      include: {
        test: true,
        responses: {
          include: {
            question: true,
          },
        },
      },
    });

    if (!attempt) {
      throw new AppError(httpStatus.NOT_FOUND, 'Test attempt not found');
    }

    let totalManualScore = 0;

    // Process each grading
    for (const grading of gradings) {
      const response = await tx.userResponse.findUnique({
        where: { id: grading.responseId },
        include: {
          question: true,
        },
      });

      if (!response) {
        throw new AppError(
          httpStatus.NOT_FOUND,
          `Response not found: ${grading.responseId}`,
        );
      }

      if (response.question.type !== QuestionType.SHORT_ANSWER) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Cannot manually grade non-short answer questions',
        );
      }

      if (response.status === ResponseStatus.MANUAL_GRADED) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Response already graded');
      }

      // Validate marks don't exceed question maximum
      if (grading.marks > response.question.marks) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `Marks cannot exceed question maximum of ${response.question.marks}`,
        );
      }

      // Update the response with manual grading
      await tx.userResponse.update({
        where: { id: grading.responseId },
        data: {
          marksObtained: grading.marks,
          isCorrect: grading.marks > 0,
          status: ResponseStatus.MANUAL_GRADED,
          instructorNotes: grading.notes || null,
        },
      });

      totalManualScore += grading.marks;
    }

    // Recalculate total score
    const allResponses = await tx.userResponse.findMany({
      where: { attemptId: attemptId },
    });

    const totalScore = allResponses.reduce(
      (sum, response) => sum + (response.marksObtained || 0),
      0,
    );
    const percentage = (totalScore / attempt.totalMarks) * 100;
    const isPassed = percentage >= attempt.test.passingScore;

    // Check if all responses are graded
    const allGraded = allResponses.every(
      r => r.status !== ResponseStatus.SUBMITTED,
    );

    const updatedAttempt = await tx.testAttempt.update({
      where: { id: attemptId },
      data: {
        score: totalScore,
        percentage: percentage,
        isPassed: isPassed,
        status: allGraded ? AttemptStatus.GRADED : AttemptStatus.UNDER_REVIEW,
      },
      include: {
        responses: {
          include: {
            question: {
              select: {
                title: true,
                type: true,
                marks: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            image: true,
          },
        },
        test: {
          select: {
            title: true,
            totalMarks: true,
            passingScore: true,
          },
        },
      },
    });

    return updatedAttempt;
  });
};

const getMyTestAttemptsFromDb = async (userId: string) => {
  const result = await prisma.testAttempt.findMany({
    where: { userId: userId },
    include: {
      test: {
        select: {
          title: true,
          totalMarks: true,
          passingScore: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (result.length === 0) {
    return { message: 'No test attempts found' };
  }
  // Show only graded attempts
   const gradedAttempts = result.filter(attempt => attempt.status === AttemptStatus.GRADED);
   return gradedAttempts;
};

const deleteTestAttemptItemFromDb = async (
  userId: string,
  testAttemptId: string,
) => {
  const deletedItem = await prisma.testAttempt.delete({
    where: {
      id: testAttemptId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'testAttemptId, not deleted');
  }

  return deletedItem;
};

export const testAttemptService = {
  createTestAttemptIntoDb,
  submitTestAttemptIntoDb,
  getTestAttemptListFromDb,
  getTestAttemptByIdFromDb,
  getMyTestAttemptsFromDb,
  updateTestAttemptIntoDb,
  gradeShortAnswers,
  deleteTestAttemptItemFromDb,
};
