import prisma from '../../utils/prisma';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { PaymentStatus, UserRoleEnum } from '@prisma/client';
import { Course, Section, StudentProgress } from './studentProgress.interface';

const markLessonCompleted = async (
  userId: string,
  lessonId: string,
  role: UserRoleEnum,
) => {
  return await prisma.$transaction(async tx => {
    // 1. Get lesson details
    const lesson = await tx.lesson.findUnique({
      where: { id: lessonId },
      include: {
        section: {
          include: {
            course: true,
            Lesson: true, // include all lessons of this section
          },
        },
      },
    });

    if (!lesson) {
      throw new AppError(httpStatus.NOT_FOUND, 'Lesson not found');
    }

    // 2. Check enrollment depending on role
    if (role === UserRoleEnum.EMPLOYEE) {
      const employeeEnrollment = await tx.employeeCredential.findFirst({
        where: {
          userId: userId,
          paymentStatus: PaymentStatus.COMPLETED,
          courseId: lesson.section.courseId,
        },
      });

      if (!employeeEnrollment) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          'You are not assigned to this course',
        );
      }
    } else {
      const enrollment = await tx.enrolledCourse.findFirst({
        where: {
          userId: userId,
          paymentStatus: PaymentStatus.COMPLETED,
          courseId: lesson.section.courseId,
        },
      });

      if (!enrollment) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          'You are not enrolled in this course',
        );
      }
    }

    // 3. Ensure all previous lessons are completed
    const previousLessons = await tx.lesson.findMany({
      where: {
        sectionId: lesson.sectionId,
        order: { lt: lesson.order },
      },
      select: { id: true },
    });

    if (previousLessons.length > 0) {
      const previousLessonIds = previousLessons.map(l => l.id);

      const incompleteLesson = await tx.studentProgress.findFirst({
        where: {
          lessonId: { in: previousLessonIds },
          isCompleted: false,
          ...(role === UserRoleEnum.EMPLOYEE
            ? { userId: userId } // still stored as userId in your progress table
            : { userId: userId }),
        },
      });

      if (incompleteLesson) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          'Please complete previous lessons before marking this one as completed',
        );
      }
    }

    // 4. Upsert progress for this lesson
    let progress = await tx.studentProgress.findFirst({
      where: {
        lessonId,
        ...(role === UserRoleEnum.EMPLOYEE
          ? { userId: userId }
          : { userId: userId }),
      },
    });

    if (progress) {
      progress = await tx.studentProgress.update({
        where: { id: progress.id },
        data: { isCompleted: true },
      });
    } else {
      progress = await tx.studentProgress.create({
        data: {
          userId: userId,
          courseId: lesson.section.courseId,
          sectionId: lesson.sectionId,
          lessonId,
          isCompleted: true,
        },
      });
    }

    // 5. Calculate course progress
    const courseProgress = await calculateProgressInsideTransaction(
      tx,
      userId,
      lesson.section.courseId,
    );

    // 6. Return response with details
    const progressWithDetails = await tx.studentProgress.findUnique({
      where: { id: progress.id },
      include: {
        lesson: { select: { title: true, order: true } },
        section: { select: { title: true, order: true } },
        course: { select: { courseTitle: true } },
      },
    });

    return {
      ...progressWithDetails,
      overallProgress: courseProgress.overallProgress,
      completedLessons: courseProgress.completedLessons,
      totalLessons: courseProgress.totalLessonsAndTests,
    };
  });
};

const markTestCompleted = async (
  id: string, // userId or employeeId
  testId: string,
  role: UserRoleEnum,
) => {
  return await prisma.$transaction(async tx => {
    // 1. Get the test with section -> course
    const test = await tx.test.findUnique({
      where: { id: testId },
      include: {
        section: { include: { course: true } },
      },
    });

    if (!test) {
      // || !test.isPublished
      throw new AppError(httpStatus.NOT_FOUND, 'Test not found or unpublished');
    }

    const courseId = test.section?.courseId;
    const sectionId = test.sectionId;

    if (!courseId) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Test not linked to any course',
      );
    }

    // 2. Verify enrollment / employee assignment
    if (role === UserRoleEnum.EMPLOYEE) {
      const employeeEnrollment = await tx.employeeCredential.findFirst({
        where: { userId: id, courseId },
      });

      if (!employeeEnrollment) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          'You are not assigned to this course',
        );
      }
    } else {
      const enrollment = await tx.enrolledCourse.findFirst({
        where: { userId: id, courseId },
      });

      if (!enrollment) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          'You are not enrolled in this course',
        );
      }
    }

    // 3. Ensure all previous tests are attempted
    const previousTests = await tx.test.findMany({
      where: {
        section: { courseId },
        createdAt: { lt: test.createdAt },
        isPublished: true,
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    if (previousTests.length > 0) {
      const previousTestIds = previousTests.map(t => t.id);
      const attemptedTests = await tx.testAttempt.findMany({
        where: {
          userId: id,
          testId: { in: previousTestIds },
          status: 'SUBMITTED',
        },
        select: { testId: true },
      });

      const attemptedIds = attemptedTests.map(t => t.testId);
      const notAttempted = previousTestIds.filter(
        tid => !attemptedIds.includes(tid),
      );

      if (notAttempted.length > 0) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          'Please attempt all previous tests before marking this test as completed',
        );
      }
    }

    // 4. Upsert progress for this test
    let progress = await tx.studentProgress.findFirst({
      where: {
        testId,
        userId: id,
      },
    });
    if (!progress) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        'Progress record not found for this test',
      );
    }

    if (progress) {
      progress = await tx.studentProgress.update({
        where: { id: progress.id },
        data: { isCompleted: true },
      });
    } else {
      progress = await tx.studentProgress.create({
        data: {
          userId: id,
          courseId,
          sectionId: sectionId!,
          // lessonId: '000000000000000000000000', // dummy lessonId (if nullable, remove this)
          testId,
          isCompleted: true,
        },
      });
    }

    // 5. Recalculate overall course progress
    const courseProgress = await calculateProgressInsideTransaction(
      tx,
      id,
      courseId,
    );

    // 6. Return combined response
    return {
      testId,
      courseId,
      overallProgress: courseProgress.overallProgress,
      completedLessons: courseProgress.completedLessons,
      totalLessons: courseProgress.totalLessonsAndTests,
      message: 'Test marked as completed successfully',
    };
  });
};

const markCourseCompleted = async (
  userId: string,
  courseId: string,
  role: UserRoleEnum,
) => {
  return await prisma.$transaction(async tx => {
    // 1️⃣ Role-based enrollment validation
    const enrollmentCheck =
      role === UserRoleEnum.EMPLOYEE
        ? await tx.employeeCredential.findFirst({
            where: { userId, courseId },
          })
        : await tx.enrolledCourse.findFirst({
            where: { userId, courseId },
          });

    if (!enrollmentCheck) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        role === UserRoleEnum.EMPLOYEE
          ? 'You are not assigned to this course'
          : 'You are not enrolled in this course',
      );
    }

    // 2️⃣ Fetch all sections, lessons, and tests
    const course = await tx.course.findUnique({
      where: { id: courseId },
      include: {
        Section: {
          include: { Lesson: true, Test: true },
        },
      },
    });

    if (!course) {
      throw new AppError(httpStatus.NOT_FOUND, 'Course not found');
    }

    // 3️⃣ Collect all content IDs in one unified array
    const contentItems = course.Section.flatMap(section => [
      ...section.Lesson.map(lesson => ({
        id: lesson.id,
        type: 'lesson' as const,
        sectionId: section.id,
      })),
      ...section.Test.map(test => ({
        id: test.id,
        type: 'test' as const,
        sectionId: section.id,
      })),
    ]);

    // 4️⃣ Helper to upsert progress for each content item
    const upsertProgress = async (item: {
      id: string;
      type: 'lesson' | 'test';
      sectionId: string;
    }) => {
      const whereClause =
        item.type === 'lesson'
          ? { lessonId: item.id, userId }
          : { testId: item.id, userId };

      const existing = await tx.studentProgress.findFirst({ where: whereClause });

      if (existing) {
        await tx.studentProgress.update({
          where: { id: existing.id },
          data: { isCompleted: true },
        });
      } else {
        await tx.studentProgress.create({
          data: {
            userId,
            courseId,
            sectionId: item.sectionId,
            isCompleted: true,
            ...(item.type === 'lesson'
              ? { lessonId: item.id }
              : { testId: item.id }),
          },
        });
      }
    };

    // 5️⃣ Mark all lessons & tests as completed
    await Promise.all(contentItems.map(item => upsertProgress(item)));

    // 6️⃣ Compute updated progress
    const progress = await calculateProgressInsideTransaction(tx, userId, courseId);

    // 7️⃣ Return summary
    return {
      courseId,
      overallProgress: progress.overallProgress,
      completedItems: progress.completedLessons, // lessons + tests
      totalItems: progress.totalLessonsAndTests,
      message: 'Course marked as completed successfully',
    };
  });
};


const getALessonMaterialByIdFromDb = async (
  userId: string,
  lessonMaterialId: string,
  role: UserRoleEnum,
) => {
  const lessonMaterial = await prisma.lesson.findUnique({
    where: { id: lessonMaterialId },
    include: {
      section: {
        include: {
          course: true,
        },
      },
    },
  });

  if (!lessonMaterial) {
    throw new AppError(httpStatus.NOT_FOUND, 'Lesson material not found');
  }

  const courseId = lessonMaterial.section.course.id;

  // Role-based access
  if (role === UserRoleEnum.EMPLOYEE) {
    const employeeEnrollment = await prisma.employeeCredential.findFirst({
      where: {
        userId: userId,
        courseId,
        paymentStatus: PaymentStatus.COMPLETED,
      },
    });
    if (!employeeEnrollment) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'You are not assigned to this course',
      );
    }
  } else {
    const enrollment = await prisma.enrolledCourse.findFirst({
      where: {
        userId,
        courseId,
        paymentStatus: PaymentStatus.COMPLETED,
      },
    });
    if (!enrollment) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'You are not enrolled in this course',
      );
    }
  }

  // Get all previous lessons in the course
  const lessons = await prisma.lesson.findMany({
    where: {
      section: { courseId },
      OR: [
        {
          sectionId: lessonMaterial.sectionId,
          order: { lt: lessonMaterial.order },
        },
        { section: { order: { lt: lessonMaterial.section.order } } },
      ],
    },
  });

  // Check progress
  if (lessons.length > 0) {
    const completedLessons = await prisma.studentProgress.findMany({
      where: {
        userId,
        isCompleted: true,
        lessonId: { in: lessons.map(l => l.id) },
      },
    });

    if (completedLessons.length < lessons.length) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'Please complete previous lessons to access this material',
      );
    }
  }

  return lessonMaterial;
};

// Helper function to calculate progress inside transaction
const calculateProgressInsideTransaction = async (
  tx: any,
  userId: string,
  courseId: string,
) => {
  const progress = await tx.studentProgress.findMany({
    where: {
      userId,
      courseId,
    },
  });

  // Fetch course with sections, lessons, and tests
  const course = await tx.course.findUnique({
    where: { id: courseId },
    include: {
      Section: {
        include: {
          Lesson: true,
          Test: true, // include tests now
        },
      },
    },
  });

  if (!course) {
    throw new AppError(httpStatus.NOT_FOUND, 'Course not found');
  }

  const totalLessonsAndTests: number = (course as Course).Section.reduce(
    (sum: number, section: Section) => {
      const lessonsCount: number = section.Lesson.length;
      const testsCount: number = section.Test.length;
      return sum + lessonsCount + testsCount;
    },
    0,
  );

  // Count completed items (lessons/tests) from StudentProgress

  const completedItems: number = (progress as StudentProgress[]).filter(
    (p: StudentProgress) => p.isCompleted,
  ).length;

  const overallProgress =
    totalLessonsAndTests > 0
      ? (completedItems / totalLessonsAndTests) * 100
      : 0;

  return {
    overallProgress: Math.round(overallProgress),
    completedLessons: completedItems,
    totalLessonsAndTests: totalLessonsAndTests,
  };
};

const markLessonIncomplete = async (userId: string, lessonId: string) => {
  return await prisma.$transaction(async tx => {
    const progress = await tx.studentProgress.findUnique({
      where: {
        userId_lessonId: {
          userId: userId,
          lessonId: lessonId,
        },
      },
    });

    if (!progress) {
      throw new AppError(httpStatus.NOT_FOUND, 'Progress record not found');
    }

    const updatedProgress = await tx.studentProgress.update({
      where: { id: progress.id },
      data: {
        isCompleted: false,
      },
      include: {
        lesson: {
          select: {
            title: true,
          },
        },
      },
    });

    return updatedProgress;
  });
};

const getACourseDetailsFromDb = async (userId: string, courseId: string) => {
  // Check if user is enrolled in the course
  const enrollment = await prisma.enrolledCourse.findFirst({
    where: {
      userId: userId,
      courseId: courseId,
    },
  });

  if (!enrollment) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You are not enrolled in this course',
    );
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      Section: {
        include: {
          Lesson: {
            select: {
              id: true,
              title: true,
              content: true,
              order: true,
            },
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!course) {
    throw new AppError(httpStatus.NOT_FOUND, 'Course not found');
  }

  return course;
};

const getAllCourseProgress = async (userId: string) => {
  const enrollments = await prisma.enrolledCourse.findMany({
    where: { userId: userId },
    select: {
      courseId: true,
      course: {
        select: {
          id: true,
          courseTitle: true,
        },
      },
    },
  });

  const progressData = await Promise.all(
    enrollments.map(async enrollment => {
      const progress = await getAStudentProgress(userId, enrollment.courseId);
      // Exclude progressBySection from the response
      const { progressBySection, lessons, ...restProgress } = progress;
      return {
        courseId: enrollment.courseId,
        courseTitle: enrollment.course.courseTitle,
        progress: restProgress,
      };
    }),
  );

  return progressData;
};

const getAStudentProgress = async (userId: string, courseId: string) => {
  const progress = await prisma.studentProgress.findMany({
    where: {
      userId: userId,
      courseId: courseId,
    },
    include: {
      lesson: {
        select: {
          id: true,
          title: true,
          order: true,
        },
      },
      section: {
        select: {
          id: true,
          title: true,
          order: true,
        },
      },
    },
    orderBy: [
      {
        section: {
          order: 'asc',
        },
      },
      {
        lesson: {
          order: 'asc',
        },
      },
    ],
  });

  // Calculate overall course progress
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      Section: {
        include: {
          Lesson: true,
        },
      },
    },
  });

  if (!course) {
    throw new AppError(httpStatus.NOT_FOUND, 'Course not found');
  }

  const totalLessons = course.Section.reduce(
    (sum, section) => sum + section.Lesson.length,
    0,
  );
  const completedLessons = progress.filter(p => p.isCompleted).length;
  const overallProgress =
    totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;

  return {
    overallProgress: Math.round(overallProgress),
    completedLessons,
    totalLessons,
    progressBySection: course.Section.map(section => ({
      sectionId: section.id,
      sectionTitle: section.title,
      completed: progress.filter(
        p => p.sectionId === section.id && p.isCompleted,
      ).length,
      total: section.Lesson.length,
      progress:
        section.Lesson.length > 0
          ? Math.round(
              (progress.filter(p => p.sectionId === section.id && p.isCompleted)
                .length /
                section.Lesson.length) *
                100,
            )
          : 0,
    })),
    lessons: progress,
  };
};

const getLessonCompletionStatus = async (userId: string, lessonId: string) => {
  const progress = await prisma.studentProgress.findUnique({
    where: {
      userId_lessonId: {
        userId: userId,
        lessonId: lessonId,
      },
    },
    include: {
      lesson: {
        select: {
          title: true,
        },
      },
    },
  });

  return {
    isCompleted: progress?.isCompleted || false,
    completedAt: progress?.updatedAt,
    lesson: progress?.lesson,
  };
};

const getCourseCompletionStatus = async (userId: string, courseId: string, role: UserRoleEnum) => {
  // Fetch the course with both lessons and tests
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      Section: {
        include: {
          Lesson: true,
          Test: true, // Include tests to count them
        },
      },
    },
  });

  if (!course) {
    throw new AppError(httpStatus.NOT_FOUND, 'Course not found');
  }

// check if user is enrolled in the course
  if (role === UserRoleEnum.EMPLOYEE) {
    const employeeEnrollment = await prisma.employeeCredential.findFirst({
      where: {
        userId: userId,
        courseId: courseId,
      },
    });
    if (!employeeEnrollment) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'You are not assigned to this course',
      );
    }
  } else {
  const enrollment = await prisma.enrolledCourse.findFirst({
    where: {
      userId: userId,
      courseId: courseId,
    },
  }); 
  if (!enrollment) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You are not enrolled in this course',
    );
  }
}


  //  Count all lessons + tests in the course
  const totalLessonsAndTests = course.Section.reduce(
    (sum, section) => sum + section.Lesson.length + section.Test.length,
    0,
  );

  // Count completed items (both lessons and tests)
  const completedProgress = await prisma.studentProgress.count({
    where: {
      userId: userId,
      courseId: courseId,
      isCompleted: true,
    },
  });

  // Determine completion status and percentage
  const isCourseCompleted = completedProgress === totalLessonsAndTests;

  return {
    isCompleted: isCourseCompleted,
    completedItems: completedProgress,
    totalItems: totalLessonsAndTests,
    progressPercentage:
      totalLessonsAndTests > 0
        ? Math.round((completedProgress / totalLessonsAndTests) * 100)
        : 0,
  };
};

export const studentProgressService = {
  markLessonCompleted,
  markTestCompleted,
  markCourseCompleted,
  getALessonMaterialByIdFromDb,
  markLessonIncomplete,
  getACourseDetailsFromDb,
  getAllCourseProgress,
  getAStudentProgress,
  getLessonCompletionStatus,
  getCourseCompletionStatus,
};
