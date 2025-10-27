import { Test } from './../../../../node_modules/.prisma/client/index.d';
import prisma from '../../utils/prisma';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { PaymentStatus, UserRoleEnum } from '@prisma/client';
import { AttemptStatus } from '@prisma/client';

// markLessonCompleted
const markLessonCompleted = async (
  userId: string,
  lessonId: string,
  role: UserRoleEnum,
) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Load lesson + section + course
    const lesson = await tx.lesson.findUnique({
      where: { id: lessonId },
      include: {
        section: {
          include: { course: true },
        },
      },
    });
    if (!lesson) throw new AppError(httpStatus.NOT_FOUND, 'Lesson not found');

    const courseId = lesson.section.courseId;

    // 2. Verify enrollment / assignment
    if (role === UserRoleEnum.EMPLOYEE) {
      const emp = await tx.employeeCredential.findFirst({
        where: { userId, courseId, paymentStatus: PaymentStatus.COMPLETED },
      });
      if (!emp) throw new AppError(httpStatus.FORBIDDEN, 'You are not assigned to this course');
    } else {
      
      const enrol = await tx.enrolledCourse.findFirst({
        where: { userId, courseId, paymentStatus: PaymentStatus.COMPLETED },
      });
      if (!enrol) throw new AppError(httpStatus.FORBIDDEN, 'You are not enrolled in this course');
    }

    // 3. Ensure previous lessons in same section are completed
    const prevLessons = await tx.lesson.findMany({
      where: { sectionId: lesson.sectionId, order: { lt: lesson.order } },
      select: { id: true },
    });

    if (prevLessons.length > 0) {
      const prevIds = prevLessons.map(l => l.id);
      const notCompleted = await tx.studentProgress.findFirst({
        where: {
          userId,
          lessonId: { in: prevIds },
          isCompleted: false,
        },
      });
      if (notCompleted) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          'Please complete previous lessons before accessing this one',
        );
      }
    }

    // 4. Upsert studentProgress for this lesson
    let sp = await tx.studentProgress.findFirst({
      where: { userId, lessonId },
    });

    if (sp) {
      if (!sp.isCompleted) {
        sp = await tx.studentProgress.update({
          where: { id: sp.id },
          data: { isCompleted: true },
        });
      }
    } else {
      
      sp = await tx.studentProgress.create({
        data: {
          userId,
          courseId,
          sectionId: lesson.sectionId,
          lessonId,
          isCompleted: true,
        },
      });

    }

    // 5. Recalculate course progress and update enrolledCourse
    const progress = await updateEnrolledCourseProgress(tx, userId, courseId);

    // 6. Return helpful payload
    return {
      progressRecord: sp,
      overallProgress: progress.overallProgress,
      breakdown: progress.breakdown,
    };
  });
};

// markTestCompleted
const markTestCompleted = async (
  userId: string,
  testId: string,
  role: UserRoleEnum,
) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Load test + section + course
    const test = await tx.test.findUnique({
      where: { id: testId },
      include: { section: { include: { course: true } } },
    });
    if (!test) throw new AppError(httpStatus.NOT_FOUND, 'Test not found');

    // if (!test.isPublished) {
    //   throw new AppError(httpStatus.BAD_REQUEST, 'Test is not published');
    // }

    const courseId = test.section?.courseId;
    const sectionId = test.sectionId;
    if (!courseId) throw new AppError(httpStatus.BAD_REQUEST, 'Test not linked to a course');

    // 2. Verify enrollment / assignment
    if (role === UserRoleEnum.EMPLOYEE) {
      const emp = await tx.employeeCredential.findFirst({
        where: { userId, courseId, paymentStatus: PaymentStatus.COMPLETED },
      });
      if (!emp) throw new AppError(httpStatus.FORBIDDEN, 'You are not assigned to this course');
    } else {
      const enrol = await tx.enrolledCourse.findFirst({
        where: { userId, courseId, paymentStatus: PaymentStatus.COMPLETED },
      });
      if (!enrol) throw new AppError(httpStatus.FORBIDDEN, 'You are not enrolled in this course');
    }

    // 3. Ensure previous tests (published) are attempted/completed
    const prevTests = await tx.test.findMany({
      where: {
        section: { courseId },
        isPublished: true,
        createdAt: { lt: test.createdAt },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    if (prevTests.length > 0) {
      const prevIds = prevTests.map(t => t.id);
      const attempts = await tx.testAttempt.findMany({
        where: { userId, testId: { in: prevIds }, status: AttemptStatus.SUBMITTED },
        select: { testId: true },
      });
      const attemptedSet = new Set(attempts.map(a => a.testId));
      const notAttempted = prevIds.filter(id => !attemptedSet.has(id));
      if (notAttempted.length > 0) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          'Please attempt previous tests before taking this test',
        );
      }
    }

    // 4. Upsert studentProgress for this test (mark completed)
    let sp = await tx.studentProgress.findFirst({
      where: { userId, testId },
    });

    if (sp) {
      if (!sp.isCompleted) {
        sp = await tx.studentProgress.update({
          where: { id: sp.id },
          data: { isCompleted: true },
        });
      }
    } else {
      sp = await tx.studentProgress.create({
        data: {
          userId,
          courseId,
          sectionId: sectionId!,
          testId,
          isCompleted: true,
        },
      });
    }

    // 5. Recalculate and update enrolledCourse progress
    const progress = await updateEnrolledCourseProgress(tx, userId, courseId);

    // 6. Return
    return {
      progressRecord: sp,
      overallProgress: progress.overallProgress,
      breakdown: progress.breakdown,
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

      const existing = await tx.studentProgress.findFirst({
        where: whereClause,
      });

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
    const progress = await calculateProgressInsideTransaction(
      tx,
      userId,
      courseId,
    );

    // 7️⃣ Return summary
    return {
      courseId,
      overallProgress: progress.overallProgress,
      completedItems: progress.completedItems, // lessons + tests
      totalItems: progress.totalItems,
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

// const updateEnrolledCourseProgress = async (tx: any, userId: string, courseId: string) => {
//   const progress = await calculateProgressInsideTransaction(tx, userId, courseId);
  
//   await tx.enrolledCourse.updateMany({
//     where: {
//       userId: userId,
//       courseId: courseId,
//     },
//     data: {
//       progress: progress.overallProgress,
//       isCompleted: progress.overallProgress >= 100,
//       updatedAt: new Date(),
//     },
//   });
  
//   return progress;
// };

// Helper function to calculate progress inside transaction
// helper-progress.ts (or inside your studentProgress.service.ts)
// --- calculate within transaction (used by mark* functions) ---
const calculateProgressInsideTransaction = async (
  tx: any,
  userId: string,
  courseId: string,
) => {
  // get all progress rows for this user+course (completed or not, we'll filter)
  const progressRows = await tx.studentProgress.findMany({
    where: { userId, courseId, isCompleted: true },
    select: { lessonId: true, testId: true },
  });

  // sets of completed ids
  type ProgressRow = { lessonId?: string | null; testId?: string | null };

  const completedLessonIds: Set<string> = new Set<string>(
    (progressRows as ProgressRow[])
      .filter(p => !!p.lessonId)
      .map(p => p.lessonId as string),
  );
  const completedTestIds: Set<string> = new Set<string>(
    (progressRows as ProgressRow[])
      .filter(p => !!p.testId)
      .map(p => p.testId as string),
  );

  // fetch course structure: count lessons, count published tests
  const course = await tx.course.findUnique({
    where: { id: courseId },
    include: {
      Section: {
        include: {
          Lesson: { select: { id: true } },
          Test: { where: { isPublished: true }, select: { id: true } },
        },
      },
    },
  });

  if (!course) {
    return {
      completedItems: 0,
      totalItems: 0,
      progressPercentage: 0,
      overallProgress: 0,
      breakdown: {
        completedLessons: 0,
        completedTests: 0,
        totalLessons: 0,
        totalTests: 0,
      },
    };
  }

  // compute totals and completed counts
  let totalLessons = 0;
  let totalTests = 0;
  let completedLessons = 0;
  let completedTests = 0;

  for (const section of course.Section) {
    if (section.Lesson) {
      totalLessons += section.Lesson.length;
      for (const l of section.Lesson) {
        if (completedLessonIds.has(l.id)) completedLessons++;
      }
    }
    if (section.Test) {
      totalTests += section.Test.length;
      for (const t of section.Test) {
        if (completedTestIds.has(t.id)) completedTests++;
      }
    }
  }

  const totalItems = totalLessons + totalTests;
  const completedItems = completedLessons + completedTests;
  const progressPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  return {
    completedItems,
    totalItems,
    progressPercentage,
    overallProgress: progressPercentage,
    breakdown: {
      completedLessons,
      completedTests,
      totalLessons,
      totalTests,
    },
  };
};

// Non-transaction wrapper (uses prisma directly)
const calculateCourseProgress = async (userId: string, courseId: string) => {
  const progress = await prisma.studentProgress.findMany({
    where: { userId, courseId },
  });

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      Section: {
        include: {
          Lesson: true,
          Test: true, // ✅ include all tests (not filtered by isPublished)
        },
      },
    },
  });

  if (!course) {
    return {
      completedItems: 0,
      totalItems: 0,
      progressPercentage: 0,
      overallProgress: 0,
      breakdown: {
        completedLessons: 0,
        completedTests: 0,
        totalLessons: 0,
        totalTests: 0,
      },
    };
  }

  let totalItems = 0;
  let completedItems = 0;
  let totalLessons = 0;
  let totalTests = 0;
  let completedLessons = 0;
  let completedTests = 0;

  // ✅ Count lessons and tests equally
  course.Section.forEach(section => {
    // Lessons
    section.Lesson.forEach(lesson => {
      totalItems++;
      totalLessons++;
      const lessonProgress = progress.find(
        p => p.lessonId === lesson.id && p.isCompleted
      );
      if (lessonProgress) {
        completedItems++;
        completedLessons++;
      }
    });

    // Tests
    section.Test.forEach(test => {
      totalItems++;
      totalTests++;
      const testProgress = progress.find(
        p => p.testId === test.id && p.isCompleted
      );
      if (testProgress) {
        completedItems++;
        completedTests++;
      }
    });
  });

  const progressPercentage =
    totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

  return {
    completedItems,
    totalItems,
    progressPercentage: Math.round(progressPercentage),
    overallProgress: Math.round(progressPercentage),
    breakdown: {
      completedLessons,
      completedTests,
      totalLessons,
      totalTests,
    },
  };
};


// updates the enrolledCourse progress/isCompleted inside a transaction
const updateEnrolledCourseProgress = async (tx: any, userId: string, courseId: string) => {
  const progress = await calculateProgressInsideTransaction(tx, userId, courseId);

  // find the enrolledCourse row
  const enrolled = await tx.enrolledCourse.findFirst({
    where: { userId, courseId },
  });

  if (!enrolled) {
    // no enrolled row — nothing to update (or throw depending on your policy)
    return progress;
  }

  // update progress fields
  await tx.enrolledCourse.update({
    where: { id: enrolled.id },
    data: {
      progress: progress.overallProgress,
      isCompleted: progress.overallProgress === 100,
    },
  });

  return progress;
};


const markLessonIncomplete = async (userId: string, lessonId: string) => {
  return await prisma.$transaction(async tx => {
    const progress = await tx.studentProgress.findFirst({
      where: {
        // userId_lessonId: {
          userId: userId,
          lessonId: lessonId,
        // },
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

// studentProgress.service.ts
const getAllCourseProgress = async (userId: string) => {
  // Get all enrolled courses for this user
  const enrolledCourses = await prisma.enrolledCourse.findMany({
    where: {
      userId: userId,
      paymentStatus: PaymentStatus.COMPLETED,
    },
    select: {
      courseId: true,
    },
  });

  const courseIds = enrolledCourses.map(ec => ec.courseId);
  
  const progressList = await Promise.all(
    courseIds.map(async (courseId) => {
      const progress = await calculateCourseProgress(userId, courseId);
      return {
        courseId,
        ...progress
      };
    })
  );

  return progressList;
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
  const progress = await prisma.studentProgress.findFirst({
    where: {
        userId: userId,
        lessonId: lessonId,
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

const getCourseCompletionStatus = async (
  userId: string,
  courseId: string,
  role: UserRoleEnum,
) => {
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
