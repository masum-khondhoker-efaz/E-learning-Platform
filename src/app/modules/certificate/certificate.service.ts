import prisma from '../../utils/prisma';
import { PaymentStatus, UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { studentProgressService } from '../studentProgress/studentProgress.service';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import {
  calculatePagination,
  formatPaginationResponse,
} from '../../utils/pagination';

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
        throw new AppError(
          httpStatus.FORBIDDEN,
          'You are not assigned to this course',
        );
      enrollmentDate = employee.createdAt;
      user = employee.user;
    } else {
      const enrollment = await tx.enrolledCourse.findFirst({
        where: { userId, courseId },
        include: { user: true },
      });
      if (!enrollment)
        throw new AppError(
          httpStatus.FORBIDDEN,
          'You are not enrolled in this course',
        );
      enrollmentDate = enrollment.createdAt;
      user = enrollment.user;
    }

    if (!enrollmentDate)
      throw new AppError(httpStatus.NOT_FOUND, 'Enrollment record not found');

    // 2️⃣ Check if course is fully completed
    const completion = await studentProgressService.getCourseCompletionStatus(
      userId,
      courseId,
      role,
    );
    if (!completion.isCompleted)
      throw new AppError(httpStatus.BAD_REQUEST, 'Course not completed yet');

    // 3️⃣ Check 5-day waiting period
    const eligibleDate = new Date(enrollmentDate);
    eligibleDate.setDate(eligibleDate.getDate() + 0);
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
      throw new AppError(
        httpStatus.CONFLICT,
        'Certificate already issued for this course',
      );

    // 5️⃣ Find certificate template (CertificateContent)
    const template = await tx.certificateContent.findUnique({
      where: { courseId },
    });
    if (!template)
      throw new AppError(
        httpStatus.NOT_FOUND,
        'Certificate template not found for this course',
      );

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

    const contentUpdate = await tx.certificate.update({
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

const getAllCertificatesFromDb = async (
  userId: string,
  options: ISearchAndFilterOptions,
) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  // Build the complete where clause manually
  const whereQuery: any = {};

  // For non-admin users, only show their own certificates
  if (
    user.role !== UserRoleEnum.ADMIN &&
    user.role !== UserRoleEnum.SUPER_ADMIN
  ) {
    whereQuery.userId = userId;
  }

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
        course: {
          courseTitle: {
            contains: options.searchTerm,
            mode: 'insensitive' as const,
          },
        },
      },
      {
        course: {
          instructorName: {
            contains: options.searchTerm,
            mode: 'insensitive' as const,
          },
        },
      },
      {
        certificateId: {
          contains: options.searchTerm,
          mode: 'insensitive' as const,
        },
      },
    ];
  }

  // Add filter conditions
  if (options.courseLevel) {
    whereQuery.course = {
      ...whereQuery.course,
      courseLevel: options.courseLevel,
    };
  }

  if (options.categoryName) {
    whereQuery.course = {
      ...whereQuery.course,
      category: {
        name: options.categoryName,
      },
    };
  }

  if (options.instructorName) {
    whereQuery.course = {
      ...whereQuery.course,
      instructorName: options.instructorName,
    };
  }

  // Date range filter for issue date
  if (options.startDate || options.endDate) {
    whereQuery.issueDate = {};
    if (options.startDate) {
      whereQuery.issueDate.gte = new Date(options.startDate);
    }
    if (options.endDate) {
      whereQuery.issueDate.lte = new Date(options.endDate);
    }
  }

  // Filter by specific user (for admin viewing specific user's certificates)
  if (
    options.userId &&
    (user.role === UserRoleEnum.ADMIN || user.role === UserRoleEnum.SUPER_ADMIN)
  ) {
    whereQuery.userId = options.userId;
  }

  // Sorting
  const orderBy = {
    [sortBy]: sortOrder,
  };

  // Fetch total count for pagination
  const total = await prisma.certificate.count({ where: whereQuery });

  if (total === 0) {
    return formatPaginationResponse([], 0, page, limit);
  }

  // Fetch paginated data
  const certificates = await prisma.certificate.findMany({
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
      course: {
        select: {
          id: true,
          courseTitle: true,
          courseShortDescription: true,
          courseLevel: true,
          instructorName: true,
          courseThumbnail: true,
          category: {
            select: {
              name: true,
            },
          },
        },
      },
      certificateContent: {
        select: {
          title: true,
          placeholders: true,
        },
      },
    },
  });

  // Transform data to include additional fields
  const transformedCertificates = certificates.map(cert => ({
    id: cert.id,
    certificateId: cert.certificateId,
    issueDate: cert.issueDate,
    createdAt: cert.createdAt,

    // User details
    userId: cert.user?.id,
    userFullName: cert.user?.fullName,
    userEmail: cert.user?.email,
    userImage: cert.user?.image,

    // Course details
    courseId: cert.courseId,
    courseTitle: cert.course?.courseTitle,
    courseShortDescription: cert.course?.courseShortDescription,
    courseLevel: cert.course?.courseLevel,
    instructorName: cert.course?.instructorName,
    courseThumbnail: cert.course?.courseThumbnail,
    categoryName: cert.course?.category?.name,

    // Certificate content
    certificateTitle: cert.certificateContent?.title,
    placeholders: cert.certificateContent?.placeholders,
    mainContents: cert.mainContents,
  }));

  return formatPaginationResponse(transformedCertificates, total, page, limit);
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
      certificateContent: { select: { title: true, htmlContent: true } },
    },
  });

  if (!certificate) {
    throw new AppError(httpStatus.NOT_FOUND, 'Certificate not found');
  }

  // flatten the response to include user and course details at the top level

  return {
    id: certificate.id,
    certificateId: certificate.certificateId,
    issueDate: certificate.issueDate,
    createdAt: certificate.createdAt,

    // User details
    userFullName: certificate.user?.fullName,
    userEmail: certificate.user?.email,
    userImage: certificate.user?.image,
    // Course details
    courseTitle: certificate.course?.courseTitle,
    courseShortDescription: certificate.course?.courseShortDescription,
    courseThumbnail: certificate.course?.courseThumbnail,
    instructorName: certificate.course?.instructorName,
    // Certificate content
    certificateTitle: certificate.certificateContent?.title,
    certificateHtmlContent: certificate.certificateContent?.htmlContent,
    mainContents: certificate.mainContents,
  };
};

const getUserCertificates = async (
  userId: string,
  options: ISearchAndFilterOptions,
) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build the complete where clause manually
  const whereQuery: any = {
    userId: userId, // Always filter by the current user
  };

  // Add search conditions
  if (options.searchTerm) {
    whereQuery.OR = [
      {
        course: {
          courseTitle: {
            contains: options.searchTerm,
            mode: 'insensitive' as const,
          },
        },
      },
      {
        course: {
          courseShortDescription: {
            contains: options.searchTerm,
            mode: 'insensitive' as const,
          },
        },
      },
      {
        course: {
          instructorName: {
            contains: options.searchTerm,
            mode: 'insensitive' as const,
          },
        },
      },
      {
        certificateId: {
          contains: options.searchTerm,
          mode: 'insensitive' as const,
        },
      },
    ];
  }

  // Add filter conditions
  if (options.courseLevel) {
    whereQuery.course = {
      ...whereQuery.course,
      courseLevel: options.courseLevel,
    };
  }

  if (options.categoryName) {
    whereQuery.course = {
      ...whereQuery.course,
      category: {
        name: options.categoryName,
      },
    };
  }

  if (options.instructorName) {
    whereQuery.course = {
      ...whereQuery.course,
      instructorName: options.instructorName,
    };
  }

  // Date range filter for issue date
  if (options.startDate || options.endDate) {
    whereQuery.issueDate = {};
    if (options.startDate) {
      whereQuery.issueDate.gte = new Date(options.startDate);
    }
    if (options.endDate) {
      whereQuery.issueDate.lte = new Date(options.endDate);
    }
  }

  // Sorting
  const orderBy = {
    [sortBy]: sortOrder,
  };

  // Fetch total count for pagination
  const total = await prisma.certificate.count({ where: whereQuery });

  if (total === 0) {
    return formatPaginationResponse([], 0, page, limit);
  }

  // Fetch paginated data
  const certificates = await prisma.certificate.findMany({
    where: whereQuery,
    skip,
    take: limit,
    orderBy,
    include: {
      course: {
        select: {
          id: true,
          courseTitle: true,
          courseShortDescription: true,
          courseLevel: true,
          instructorName: true,
          courseThumbnail: true,
          category: {
            select: {
              name: true,
            },
          },
        },
      },
      certificateContent: {
        select: {
          title: true,
          placeholders: true,
          // mainContents: true,
        },
      },
    },
  });

  // Transform data to include additional fields
  const transformedCertificates = certificates.map(cert => ({
    id: cert.id,
    certificateId: cert.certificateId,
    issueDate: cert.issueDate,
    createdAt: cert.createdAt,

    // Course details
    courseId: cert.courseId,
    courseTitle: cert.course?.courseTitle,
    courseShortDescription: cert.course?.courseShortDescription,
    courseLevel: cert.course?.courseLevel,
    instructorName: cert.course?.instructorName,
    courseThumbnail: cert.course?.courseThumbnail,
    categoryName: cert.course?.category?.name,

    // Certificate content
    certificateTitle: cert.certificateContent?.title,
    placeholders: cert.certificateContent?.placeholders,
    // mainContents: cert.certificateContent?.mainContents,
  }));

  return formatPaginationResponse(transformedCertificates, total, page, limit);
};
const getCertificateByCourseIdFromDb = async (
  courseId: string,
  userId: string,
) => {
  const certificate = await prisma.certificate.findFirst({
    where: {
      // id: certificateId,
      userId: userId,
      courseId: courseId,
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
      certificateContent: {
        select: { title: true, htmlContent: true, placeholders: true },
      },
    },
  });

  if (!certificate) {
    throw new AppError(httpStatus.NOT_FOUND, 'Certificate not found');
  }

  // flatten the response to include user and course details at the top level

  const mainContents =
    certificate.mainContents && typeof certificate.mainContents === 'string'
      ? JSON.parse(certificate.mainContents as string)
      : (certificate.mainContents as any);

  return {
    id: certificate.id,
    certificateId: certificate.certificateId,
    courseId: certificate.courseId,
    // issueDate: certificate.issueDate,
    // createdAt: certificate.createdAt,

    // User details
    // userFullName: certificate.user?.fullName,
    // userEmail: certificate.user?.email,
    // userImage: certificate.user?.image,
    // Course details
    courseTitle: certificate.course?.courseTitle,
    // courseShortDescription: certificate.course?.courseShortDescription,
    // courseThumbnail: certificate.course?.courseThumbnail,
    // instructorName: certificate.course?.instructorName,
    // Certificate content
    certificateTitle: certificate.certificateContent?.title,
    certificateHtmlContent: certificate.certificateContent?.htmlContent,
    // placeholders: certificate.certificateContent?.placeholders,
    // mainContents: certificate.mainContents,
    fullName: mainContents?.fullName,
    dob: mainContents?.dob,
    startDate: mainContents?.startDate,
    endDate: mainContents?.endDate,
    certificateNumber: mainContents?.certificateNumber,
  };
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
  getCertificateByCourseIdFromDb,
  verifyCertificate,
};
