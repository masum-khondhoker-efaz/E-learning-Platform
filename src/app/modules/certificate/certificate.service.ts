import prisma from '../../utils/prisma';
import { PaymentStatus, UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { studentProgressService } from '../studentProgress/studentProgress.service';
import e from 'cors';

const issueCertificate = async (
  userId: string,
  courseId: string,
  role: UserRoleEnum,
) => {
  return await prisma.$transaction(async tx => {
    // 1️⃣ Verify enrollment or employee assignment
    let enrollmentDate: Date | null = null;
    let user: any = null;

    if (role === UserRoleEnum.EMPLOYEE) {
      const employee = await tx.employeeCredential.findFirst({
        where: { userId, courseId },
        include: { user: true },
      });
      if (!employee)
        throw new AppError(httpStatus.FORBIDDEN, 'You are not assigned to this course');
      enrollmentDate = employee.createdAt;
      user = employee.user;
    } else {
      const enrollment = await tx.enrolledCourse.findFirst({
        where: { userId, courseId },
        include: { user: true },
      });
      if (!enrollment)
        throw new AppError(httpStatus.FORBIDDEN, 'You are not enrolled in this course');
      enrollmentDate = enrollment.createdAt;
      user = enrollment.user;
    }

    if (!enrollmentDate)
      throw new AppError(httpStatus.NOT_FOUND, 'Enrollment record not found');

    // 2️⃣ Check if course is fully completed
    const completion = await studentProgressService.getCourseCompletionStatus(userId, courseId, role);
    if (!completion.isCompleted)
      throw new AppError(httpStatus.BAD_REQUEST, 'Course not completed yet');

    // 3️⃣ Check 5-day waiting period
    const eligibleDate = new Date(enrollmentDate);
    eligibleDate.setDate(eligibleDate.getDate() + 5);
    const now = new Date();
    if (now < eligibleDate) {
      const remainingDays = Math.ceil(
        (eligibleDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `You can only receive the certificate after ${remainingDays} more day(s).`,
      );
    }

    // 4️⃣ Ensure no existing certificate
    const existing = await tx.certificate.findFirst({
      where: { courseId, userId },
    });
    if (existing)
      throw new AppError(httpStatus.CONFLICT, 'Certificate already issued for this course');

    // 5️⃣ Find certificate template (CertificateContent)
    const template = await tx.certificateContent.findUnique({
      where: { courseId },
    });
    if (!template)
      throw new AppError(httpStatus.NOT_FOUND, 'Certificate template not found for this course');

    // 6️⃣ Generate a unique certificate ID
    const certificateId = generateCertificateId();

    // 7️⃣ Calculate course dates for certificate info
    const firstLesson = await tx.lesson.findFirst({
      where: { section: { courseId } },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
    const lastLesson = await tx.lesson.findFirst({
      where: { section: { courseId } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    const startDate = firstLesson?.createdAt ?? enrollmentDate;
    const endDate = lastLesson?.createdAt ?? now;

    // 8️⃣ Prepare dynamic mainContents object
    const mainContents = {
      fullName: user?.fullName || 'N/A',
      dob: user?.dateOfBirth || 'N/A',
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      certificateNumber: certificateId,
    };


    // 9️⃣ Create the certificate record
    const certificate = await tx.certificate.create({
      data: {
        userId,
        courseId,
        certificateContentId: template.id,
        certificateId,
        issueDate: now,
        // companyId: role === UserRoleEnum.EMPLOYEE ? user?.companyId ?? null : null,
        //  mainContents, // Removed because it's not a valid property in the Prisma schema
      },
      include: {
        user: { select: { fullName: true, email: true } },
        course: { select: { courseTitle: true } },
        certificateContent: { select: { title: true, placeholders: true } },
      },
    });

    const contentUpdate = await tx.certificateContent.update({
      where: { id: template.id },
      data: { mainContents: mainContents },
    });
    if (!contentUpdate) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'Failed to update certificate content with main contents',
      );
    }

    return {
      certificate,
      mainContents,
    };
  });
};

const checkCourseCompletionAndIssueCertificate = async (
  userId: string,
  courseId: string,
) => {
  return await prisma.$transaction(async tx => {
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
    const totalLessons = course.Section.reduce(
      (sum, section) => sum + section.Lesson.length,
      0,
    );
    const completedLessons = progress.filter(p => p.isCompleted).length;
    const completionPercentage =
      totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;
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
    if (
      isCourseCompleted &&
      enrollment.paymentStatus === PaymentStatus.COMPLETED
    ) {
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
            certificateContentId: certificateId,
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

const getCertificateStatus = async (
  userId: string,
  courseId: string,
  role: UserRoleEnum,
) => {
  // 1. Find enrollment/assignment date
  let enrollmentDate: Date | null = null;

  if (role === UserRoleEnum.EMPLOYEE) {
    const employeeCourse = await prisma.employeeCredential.findFirst({
      where: {
        userId,
        courseId,
      },
      select: { createdAt: true },
    });
    if (!employeeCourse) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'You are not assigned to this course',
      );
    }
    enrollmentDate = employeeCourse.createdAt;
  } else {
    const enrollment = await prisma.enrolledCourse.findFirst({
      where: {
        userId,
        courseId,
      },
      select: { createdAt: true },
    });
    if (!enrollment) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'You are not enrolled in this course',
      );
    }
    enrollmentDate = enrollment.createdAt;
  }

  if (!enrollmentDate) {
    throw new AppError(httpStatus.NOT_FOUND, 'Enrollment record not found');
  }

  // 2. Check course completion
  const completion =
    await await studentProgressService.getCourseCompletionStatus(
      userId,
      courseId,
      role,
    );

  // 3. Calculate 5-day waiting period
  const now = new Date();
  const eligibleDate = new Date(enrollmentDate);
  eligibleDate.setDate(eligibleDate.getDate() + 5);
  const hasWaitedFiveDays = now >= eligibleDate;

  // 4. Check if a certificate is already issued
  const existingCertificate = await prisma.certificate.findFirst({
    where: {
      courseId,
      userId,
    },
  });

  // 5. Determine status
  let status = '';
  let message = '';

  if (existingCertificate) {
    status = 'ISSUED';
    message = 'Certificate has already been issued.';
  } else if (!completion.isCompleted) {
    status = 'PENDING_COMPLETION';
    message = 'Complete all lessons and tests to become eligible.';
  } else if (!hasWaitedFiveDays) {
    const remainingDays = Math.ceil(
      (eligibleDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    status = 'WAITING_PERIOD';
    message = `You need to wait ${remainingDays} more day(s) to get your certificate.`;
  } else {
    status = 'READY';
    message = 'You are eligible to receive the certificate.';
  }

  return {
    courseId,
    status,
    message,
    isCompleted: completion.isCompleted,
    progress: completion.progressPercentage,
    enrolledAt: enrollmentDate,
    eligibleAt: eligibleDate,
    certificateIssued: !!existingCertificate,
  };
};

const getAllCertificatesFromDb = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (user.role === UserRoleEnum.ADMIN || UserRoleEnum.ADMIN) {
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
  } else {
    // Students can see only their certificates
    return await getUserCertificates(userId);
  }
};

const getCertificateByIdForAdmin = async (
  certificateId: string,
  userId: string,
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (
    user.role !== UserRoleEnum.ADMIN &&
    user.role !== UserRoleEnum.SUPER_ADMIN
  ) {
    throw new AppError(httpStatus.FORBIDDEN, 'Access denied');
  }

  const certificate = await prisma.certificate.findUnique({
    where: {
      id: certificateId,
    },
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
  

  const certificate = await prisma.certificate.findFirst({
    where: {
      id: certificateId,
      userId: userId
    },
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
      certificateContent: { select: { title: true, placeholders: true, mainContents: true }
    }
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
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Certificate not found or invalid',
    );
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
  getCertificateStatus,
  getAllCertificatesFromDb,
  getUserCertificates,
  getCertificateByIdForAdmin,
  getCertificateById,
  verifyCertificate,
};
