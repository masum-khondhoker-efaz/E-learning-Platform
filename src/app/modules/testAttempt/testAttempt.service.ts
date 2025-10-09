import prisma from '../../utils/prisma';
import {
  AttemptStatus,
  PaymentStatus,
  QuestionType,
  ResponseStatus,
} from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import { 
  calculatePagination, 
  formatPaginationResponse 
} from '../../utils/pagination';

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
    //Get courseId from testId
    const testDetails = await tx.test.findUnique({
      where: { id: data.testId },
     include: { section: { select: { courseId: true } } },
    });
    if (!testDetails) {
      throw new AppError(httpStatus.NOT_FOUND, 'Test not found');
    }
    if(!testDetails.section?.courseId){
      throw new AppError(httpStatus.NOT_FOUND, 'Test is not associated with any course');
    }

    // check already attempted or not
    const alreadyAttempted = await tx.testAttempt.findFirst({
      where: {
        testId: data.testId,
        userId: userId,
      },
    });
    if (alreadyAttempted) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'You have already submitted this test',
      );
    }

    //enrollment check
    const studentCheck = await tx.enrolledCourse.findFirst({
      where: {
        userId: userId,
        courseId: testDetails.section!.courseId,
        paymentStatus: PaymentStatus.COMPLETED,
      },
    });

    if (!studentCheck) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'You must be enrolled in the course to take the test',
      );
    }

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



const getTestAttemptListFromDb = async (userId: string,options: ISearchAndFilterOptions) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build the complete where clause manually
  const whereQuery: any = {};

  // Add search conditions
  if (options.searchTerm) {
    whereQuery.OR = [
      {
        user: {
          fullName: {
            contains: options.searchTerm,
            mode: 'insensitive' as const,
          },
        },
      },
      {
        user: {
          email: {
            contains: options.searchTerm,
            mode: 'insensitive' as const,
          },
        },
      },
      {
        test: {
          title: {
            contains: options.searchTerm,
            mode: 'insensitive' as const,
          },
        },
      },
      {
        test: {
          section: {
            course: {
              courseTitle: {
                contains: options.searchTerm,
                mode: 'insensitive' as const,
              },
            },
          },
        },
      },
    ];
  }

  // Add filter conditions
  if (options.status) {
    whereQuery.status = options.status;
  }

  if (options.isPassed !== undefined) {
    whereQuery.isPassed = options.isPassed;
  }

  // Filter by score range
  if (options.scoreMin !== undefined || options.scoreMax !== undefined) {
    whereQuery.score = {};
    if (options.scoreMin !== undefined) {
      whereQuery.score.gte = Number(options.scoreMin);
    }
    if (options.scoreMax !== undefined) {
      whereQuery.score.lte = Number(options.scoreMax);
    }
  }

  // Filter by percentage range
  if (options.percentageMin !== undefined || options.percentageMax !== undefined) {
    whereQuery.percentage = {};
    if (options.percentageMin !== undefined) {
      whereQuery.percentage.gte = Number(options.percentageMin);
    }
    if (options.percentageMax !== undefined) {
      whereQuery.percentage.lte = Number(options.percentageMax);
    }
  }

  // Filter by course level
  if (options.courseLevel) {
    whereQuery.test = {
      ...whereQuery.test,
      section: {
        course: {
          courseLevel: options.courseLevel,
        },
      },
    };
  }

  // Filter by category
  if (options.categoryName) {
    whereQuery.test = {
      ...whereQuery.test,
      section: {
        course: {
          category: {
            name: options.categoryName,
          },
        },
      },
    };
  }

  // Date range filter for attempt date
  if (options.startDate || options.endDate) {
    whereQuery.completedAt = {};
    if (options.startDate) {
      whereQuery.completedAt.gte = new Date(options.startDate);
    }
    if (options.endDate) {
      whereQuery.completedAt.lte = new Date(options.endDate);
    }
  }

  // Sorting
  const orderBy = {
    [sortBy]: sortOrder,
  };

  // Fetch total count for pagination
  const total = await prisma.testAttempt.count({ where: whereQuery });

  if (total === 0) {
    return formatPaginationResponse([], 0, page, limit);
  }

  // Fetch paginated data
  const testAttempts = await prisma.testAttempt.findMany({
    where: whereQuery,
    skip,
    take: limit,
    orderBy,
    include: {
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
          id: true,
          title: true,
          totalMarks: true,
          passingScore: true,
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
        },
      },
      responses: {
        select: {
          id: true,
          questionType: true,
          isCorrect: true,
          marksObtained: true,
          status: true,
        },
      },
      _count: {
        select: {
          responses: true,
        },
      },
    },
  });

  // Transform data to include additional calculated fields
  const transformedAttempts = testAttempts.map(attempt => ({
    id: attempt.id,
    userId: attempt.userId,
    testId: attempt.testId,
    score: attempt.score,
    percentage: attempt.percentage,
    isPassed: attempt.isPassed,
    totalMarks: attempt.totalMarks,
    timeSpent: attempt.timeSpent,
    status: attempt.status,
    completedAt: attempt.completedAt,
    createdAt: attempt.createdAt,
    
    // User details
    userFullName: attempt.user?.fullName,
    userEmail: attempt.user?.email,
    userImage: attempt.user?.image,
    
    // Test details
    testTitle: attempt.test?.title,
    testTotalMarks: attempt.test?.totalMarks,
    testPassingScore: attempt.test?.passingScore,
    
    // Course details
    sectionId: attempt.test?.section?.id,
    sectionTitle: attempt.test?.section?.title,
    courseId: attempt.test?.section?.course?.id,
    courseTitle: attempt.test?.section?.course?.courseTitle,
    courseLevel: attempt.test?.section?.course?.courseLevel,
    categoryName: attempt.test?.section?.course?.category?.name,
    
    // Response statistics
    totalResponses: attempt._count.responses,
    correctResponses: attempt.responses.filter(r => r.isCorrect === true).length,
    incorrectResponses: attempt.responses.filter(r => r.isCorrect === false).length,
    pendingResponses: attempt.responses.filter(r => r.status === 'SUBMITTED').length,
  }));

  return formatPaginationResponse(transformedAttempts, total, page, limit);
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
          section: { select: { courseId: true }},
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

const getMyTestAttemptsFromDb = async (userId: string, options: ISearchAndFilterOptions) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build the complete where clause manually
  const whereQuery: any = {
    userId: userId, // Always filter by the current user
  };

  // Add search conditions
  if (options.searchTerm) {
    whereQuery.OR = [
      {
        test: {
          title: {
            contains: options.searchTerm,
            mode: 'insensitive' as const,
          },
        },
      },
      {
        test: {
          section: {
            course: {
              courseTitle: {
                contains: options.searchTerm,
                mode: 'insensitive' as const,
              },
            },
          },
        },
      },
      {
        test: {
          section: {
            title: {
              contains: options.searchTerm,
              mode: 'insensitive' as const,
            },
          },
        },
      },
    ];
  }

  // Add filter conditions
  if (options.status) {
    whereQuery.status = options.status;
  }

  if (options.isPassed !== undefined) {
    whereQuery.isPassed = options.isPassed;
  }

  // Filter by score range
  if (options.scoreMin !== undefined || options.scoreMax !== undefined) {
    whereQuery.score = {};
    if (options.scoreMin !== undefined) {
      whereQuery.score.gte = Number(options.scoreMin);
    }
    if (options.scoreMax !== undefined) {
      whereQuery.score.lte = Number(options.scoreMax);
    }
  }

  // Filter by percentage range
  if (options.percentageMin !== undefined || options.percentageMax !== undefined) {
    whereQuery.percentage = {};
    if (options.percentageMin !== undefined) {
      whereQuery.percentage.gte = Number(options.percentageMin);
    }
    if (options.percentageMax !== undefined) {
      whereQuery.percentage.lte = Number(options.percentageMax);
    }
  }

  // Filter by course level
  if (options.courseLevel) {
    whereQuery.test = {
      ...whereQuery.test,
      section: {
        course: {
          courseLevel: options.courseLevel,
        },
      },
    };
  }

  // Filter by category
  if (options.categoryName) {
    whereQuery.test = {
      ...whereQuery.test,
      section: {
        course: {
          category: {
            name: options.categoryName,
          },
        },
      },
    };
  }

  // Date range filter for attempt date
  if (options.startDate || options.endDate) {
    whereQuery.completedAt = {};
    if (options.startDate) {
      whereQuery.completedAt.gte = new Date(options.startDate);
    }
    if (options.endDate) {
      whereQuery.completedAt.lte = new Date(options.endDate);
    }
  }

  // Sorting
  const orderBy = {
    [sortBy]: sortOrder,
  };

  // Fetch total count for pagination
  const total = await prisma.testAttempt.count({ where: whereQuery });

  if (total === 0) {
    return formatPaginationResponse([], 0, page, limit);
  }

  // Fetch paginated data
  const testAttempts = await prisma.testAttempt.findMany({
    where: whereQuery,
    skip,
    take: limit,
    orderBy,
    include: {
      test: {
        select: {
          id: true,
          title: true,
          totalMarks: true,
          passingScore: true,
          section: {
            select: {
              id: true,
              title: true,
              courseId: true,
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
        },
      },
      responses: {
        select: {
          id: true,
          questionType: true,
          isCorrect: true,
          marksObtained: true,
          status: true,
        },
      },
      _count: {
        select: {
          responses: true,
        },
      },
    },
  });

  // Transform data to include additional calculated fields
  const transformedAttempts = testAttempts.map(attempt => ({
    id: attempt.id,
    testId: attempt.testId,
    score: attempt.score,
    percentage: attempt.percentage,
    isPassed: attempt.isPassed,
    totalMarks: attempt.totalMarks,
    timeSpent: attempt.timeSpent,
    status: attempt.status,
    completedAt: attempt.completedAt,
    createdAt: attempt.createdAt,
    
    // Test details
    testTitle: attempt.test?.title,
    testTotalMarks: attempt.test?.totalMarks,
    testPassingScore: attempt.test?.passingScore,
    
    // Course details
    sectionId: attempt.test?.section?.id,
    sectionTitle: attempt.test?.section?.title,
    courseId: attempt.test?.section?.course?.id,
    courseTitle: attempt.test?.section?.course?.courseTitle,
    courseLevel: attempt.test?.section?.course?.courseLevel,
    categoryName: attempt.test?.section?.course?.category?.name,
    
    // Response statistics
    totalResponses: attempt._count.responses,
    correctResponses: attempt.responses.filter(r => r.isCorrect === true).length,
    incorrectResponses: attempt.responses.filter(r => r.isCorrect === false).length,
    pendingResponses: attempt.responses.filter(r => r.status === 'SUBMITTED').length,
    
    // Performance indicators
    grade: attempt.isPassed ? 'PASSED' : 'FAILED',
    accuracyRate: attempt._count.responses > 0 
      ? (attempt.responses.filter(r => r.isCorrect === true).length / attempt._count.responses * 100).toFixed(2)
      : '0.00',
  }));

  return formatPaginationResponse(transformedAttempts, total, page, limit);
};

const getMyTestAttemptByIdFromDb = async (
  userId: string,
  testAttemptId: string,
) => {
  const result = await prisma.testAttempt.findFirst({
    where: {
      id: testAttemptId,
      userId: userId,
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
          section: { select: { courseId: true }},
        },
      },
    },
  });

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'testAttempt not found');
  }
  if (result.status !== AttemptStatus.GRADED) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You can only view details of graded attempts',
    );
  }
  return result;
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
  getMyTestAttemptByIdFromDb,
  updateTestAttemptIntoDb,
  gradeShortAnswers,
  deleteTestAttemptItemFromDb,
};
