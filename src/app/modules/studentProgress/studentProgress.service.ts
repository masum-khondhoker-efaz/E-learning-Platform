import prisma from '../../utils/prisma';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

const markLessonCompleted = async (userId: string, lessonId: string) => {
  return await prisma.$transaction(async tx => {
    // Get lesson details with section and course
    const lesson = await tx.lesson.findUnique({
      where: { id: lessonId },
      include: {
        section: {
          include: {
            course: true,
          },
        },
      },
    });

    if (!lesson) {
      throw new AppError(httpStatus.NOT_FOUND, 'Lesson not found');
    }

    // Check if user is enrolled in the course
    const enrollment = await tx.enrolledCourse.findFirst({
      where: {
        userId: userId,
        courseId: lesson.section.courseId,
      },
    });

    if (!enrollment) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'You are not enrolled in this course',
      );
    }

    // Find existing progress or create new one
    let progress = await tx.studentProgress.findUnique({
      where: {
        userId_lessonId: {
          userId: userId,
          lessonId: lessonId,
        },
      },
    });

    if (progress) {
      // Update existing progress to completed
      progress = await tx.studentProgress.update({
        where: { id: progress.id },
        data: {
          isCompleted: true,
        },
        include: {
          lesson: {
            select: {
              title: true,
              order: true,
            },
          },
          section: {
            select: {
              title: true,
              order: true,
            },
          },
          course: {
            select: {
              courseTitle: true,
            },
          },
        },
      });
    } else {
      // Create new progress record as completed
      progress = await tx.studentProgress.create({
        data: {
          userId: userId,
          courseId: lesson.section.courseId,
          sectionId: lesson.sectionId,
          lessonId: lessonId,
          isCompleted: true,
        },
        include: {
          lesson: {
            select: {
              title: true,
              order: true,
            },
          },
          section: {
            select: {
              title: true,
              order: true,
            },
          },
          course: {
            select: {
              courseTitle: true,
            },
          },
        },
      });
    }

    return progress;
  });
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

const getStudentProgress = async (userId: string, courseId: string) => {
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

const getCourseCompletionStatus = async (userId: string, courseId: string) => {
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

  const completedProgress = await prisma.studentProgress.count({
    where: {
      userId: userId,
      courseId: courseId,
      isCompleted: true,
    },
  });

  const isCourseCompleted = completedProgress === totalLessons;

  return {
    isCompleted: isCourseCompleted,
    completedLessons: completedProgress,
    totalLessons,
    progressPercentage:
      totalLessons > 0
        ? Math.round((completedProgress / totalLessons) * 100)
        : 0,
  };
};

export const studentProgressService = {
  markLessonCompleted,
  markLessonIncomplete,
  getStudentProgress,
  getLessonCompletionStatus,
  getCourseCompletionStatus,
};
