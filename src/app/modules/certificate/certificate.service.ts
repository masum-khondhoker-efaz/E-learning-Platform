import prisma from '../../utils/prisma';
import { PaymentStatus, UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { studentProgressService } from '../studentProgress/studentProgress.service';


const issueCertificate = async (userId: string, courseId: string) => {
  return await prisma.$transaction(async (tx) => {
    // Check if user is enrolled and has completed the course
    const checkForCompletion = await studentProgressService.getCourseCompletionStatus(userId, courseId);
    if (!checkForCompletion.isCompleted) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Course not completed yet');
    }
    
    const enrollment = await tx.enrolledCourse.findUnique({
      where: {
        userId_courseId: {
          userId: userId,
          courseId: courseId,
        },
      },
      include: {
        user: true,
        course: true,
      },
    });

    if (!enrollment) {
      throw new AppError(httpStatus.NOT_FOUND, 'Enrollment not found for this course');
    }

    // Check if certificate already exists
    const existingCertificate = await tx.certificate.findFirst({
      where: {
        userId: userId,
        courseId: courseId,
      },
    });

    if (existingCertificate) {
      throw new AppError(httpStatus.CONFLICT, 'Certificate already issued for this course');
    }

    // Generate certificate ID and URL
    const certificateId = generateCertificateId();

    const findCertificateId = await tx.certificate.findUnique({
      where: {
        certificateId: certificateId,
      },
    });

    if (findCertificateId) {
      throw new AppError(httpStatus.CONFLICT, 'Certificate ID conflict, please try again');
    }

    // Create certificate
    const certificate = await tx.certificate.create({
      data: {
        userId: userId,
        courseId: courseId,
        certificateId: certificateId,
      },
      include: {
        user: {
          select: {
            fullName: true,
            email: true,
          },
        },
        course: {
          select: {
            courseTitle: true,
            courseShortDescription: true,
          },
        },
      },
    });

    return certificate;
  });
};

const checkCourseCompletionAndIssueCertificate = async (userId: string, courseId: string) => {
  return await prisma.$transaction(async (tx) => {
    // Get course with all sections and lessons
    const course = await tx.course.findUnique({
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

    // Get all student progress for this course
    const progress = await tx.studentProgress.findMany({
      where: {
        userId: userId,
        courseId: courseId,
      },
    });

    // Calculate total lessons and completed lessons
    const totalLessons = course.Section.reduce((sum, section) => sum + section.Lesson.length, 0);
    const completedLessons = progress.filter(p => p.isCompleted).length;
    const completionPercentage = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;
    const isCourseCompleted = completionPercentage >= 100;

    // Update enrollment progress
    const enrollment = await tx.enrolledCourse.update({
      where: {
        userId_courseId: {
          userId: userId,
          courseId: courseId,
        },
      },
      data: {
        progress: completionPercentage,
        isCompleted: isCourseCompleted,
      },
    });

    let certificate = null;

    // Issue certificate if course is completed and payment is done
    if (isCourseCompleted && enrollment.paymentStatus === PaymentStatus.COMPLETED) {
      // Check if certificate already exists
      const existingCertificate = await tx.certificate.findFirst({
        where: {
          userId: userId,
          courseId: courseId,
        },
      });

      if (!existingCertificate) {
        // Generate certificate ID and URL
        const certificateId = generateCertificateId();
       

        // Create certificate
        certificate = await tx.certificate.create({
          data: {
            userId: userId,
            courseId: courseId,
            certificateId: certificateId,
          },
          include: {
            user: {
              select: {
                fullName: true,
                email: true,
              },
            },
            course: {
              select: {
                courseTitle: true,
                courseShortDescription: true,
              },
            },
          },
        });
      }
    }

    return {
      enrollment,
      certificate,
      progress: {
        completedLessons,
        totalLessons,
        percentage: completionPercentage,
        isCompleted: isCourseCompleted,
      },
    };
  });
};

const getAllCertificatesFromDb = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (user.role === UserRoleEnum.ADMIN) {
    // Admin can see all certificates
    return await prisma.certificate.findMany({
      include: {
        user: {
          select: {
            fullName: true,
            email: true,
          },
        },
        course: {
          select: {
            courseTitle: true,
            courseShortDescription: true,
          },
        },
      },
      orderBy: {
        issueDate: 'desc',
      },
    });
  } 
  else {
    // Students can see only their certificates
    return await getUserCertificates(userId);
  }
};

const getUserCertificates = async (userId: string) => {
  const certificates = await prisma.certificate.findMany({
    where: {
      userId: userId,
    },
    include: {
      course: {
        select: {
          courseTitle: true,
          courseShortDescription: true,
          courseThumbnail: true,
        },
      },
    },
    orderBy: {
      issueDate: 'desc',
    },
  });

  return certificates;
};

const getCertificateById = async (certificateId: string, userId?: string) => {
  const whereClause: any = {
    certificateId: certificateId,
  };

  if (userId) {
    whereClause.userId = userId;
  }

  const certificate = await prisma.certificate.findFirst({
    where: whereClause,
    include: {
      user: {
        select: {
          fullName: true,
          email: true,
          image: true,
        },
      },
      course: {
        select: {
          courseTitle: true,
          courseShortDescription: true,
          courseThumbnail: true,
          instructorName: true,
        },
      },
    },
  });

  if (!certificate) {
    throw new AppError(httpStatus.NOT_FOUND, 'Certificate not found');
  }

  return certificate;
};

const verifyCertificate = async (certificateId: string) => {
  const certificate = await prisma.certificate.findUnique({
    where: {
      certificateId: certificateId,
    },
    include: {
      user: {
        select: {
          fullName: true,
          email: true,
        },
      },
      course: {
        select: {
          courseTitle: true,
          courseShortDescription: true,
        },
      },
    },
  });

  if (!certificate) {
    throw new AppError(httpStatus.NOT_FOUND, 'Certificate not found or invalid');
  }

  return {
    isValid: true,
    certificate: certificate,
  };
};

// Utility function to generate certificate ID
const generateCertificateId = (): string => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${randomStr}`.toUpperCase();
};



export const certificateService = {
  issueCertificate,
  checkCourseCompletionAndIssueCertificate,
  getAllCertificatesFromDb,
  getUserCertificates,
  getCertificateById,
  verifyCertificate,
};