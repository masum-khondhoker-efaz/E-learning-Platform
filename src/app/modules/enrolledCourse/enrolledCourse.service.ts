import prisma from '../../utils/prisma';
import { PaymentStatus, UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { studentProgressService } from '../studentProgress/studentProgress.service';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import {
  buildSearchQuery,
  buildFilterQuery,
  combineQueries,
} from '../../utils/searchFilter';
import {
  calculatePagination,
  formatPaginationResponse,
  getPaginationQuery,
} from '../../utils/pagination';

const createEnrolledCourseIntoDb = async (
  userId: string,
  data: {
    courseId: string;
  },
) => {
  const findCourse = await prisma.course.findUnique({
    where: {
      id: data.courseId,
    },
  });
  if (!findCourse) {
    throw new AppError(httpStatus.NOT_FOUND, 'Course not found');
  }

  // Check if the user is already enrolled in the course
  const existingEnrollment = await prisma.enrolledCourse.findFirst({
    where: {
      userId: userId,
      courseId: data.courseId,
    },
  });

  if (existingEnrollment) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'User is already enrolled in this course',
    );
  }

  const result = await prisma.enrolledCourse.create({
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'enrolledCourse not created');
  }
  return result;
};

const getEnrolledCourseListFromDb = async (
  userId: string,
  options: ISearchAndFilterOptions,
) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build the complete where clause manually
  const whereQuery: any = {
    // userId: userId, // Always filter by the current user
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
        course: {
          category: {
            name: {
              contains: options.searchTerm,
              mode: 'insensitive' as const,
            },
          },
        },
      },
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
        user: {
          phoneNumber: {
            contains: options.searchTerm,
            mode: 'insensitive' as const,
          },
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

  if (options.certificate !== undefined) {
    whereQuery.course = {
      ...whereQuery.course,
      certificate: options.certificate,
    };
  }

  if (options.lifetimeAccess !== undefined) {
    whereQuery.course = {
      ...whereQuery.course,
      lifetimeAccess: options.lifetimeAccess,
    };
  }

  if (options.instructorName) {
    whereQuery.course = {
      ...whereQuery.course,
      instructorName: options.instructorName,
    };
  }

  // Handle price range filters
  if (options.priceMin !== undefined || options.priceMax !== undefined) {
    whereQuery.course = {
      ...whereQuery.course,
      price: {
        ...(options.priceMin !== undefined && {
          gte: Number(options.priceMin),
        }),
        ...(options.priceMax !== undefined && {
          lte: Number(options.priceMax),
        }),
      },
    };
  }

  // Sorting
  const orderBy = {
    [sortBy]: sortOrder,
  };

  // Fetch total count for pagination
  const total = await prisma.enrolledCourse.count({ where: whereQuery });

  if (total === 0) {
    return formatPaginationResponse([], 0, page, limit);
  }

  // Fetch paginated data
  const enrolledCourses = await prisma.enrolledCourse.findMany({
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
          price: true,
          discountPrice: true,
          instructorName: true,
          instructorImage: true,
          courseThumbnail: true,
          certificate: true,
          lifetimeAccess: true,
          totalSections: true,
          totalLessons: true,
          totalDuration: true,
          createdAt: true,
          category: {
            select: {
              name: true,
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phoneNumber: true,
        },
      },
    },
  });

  return formatPaginationResponse(enrolledCourses, total, page, limit);
};

const getEmployeesCourseListFromDb = async (
  options: ISearchAndFilterOptions,
) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build the complete where clause manually
  const whereQuery: any = {
    paymentStatus: PaymentStatus.COMPLETED, // Always filter by completed payments
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
        user: {
          phoneNumber: {
            contains: options.searchTerm,
            mode: 'insensitive' as const,
          },
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

  if (options.certificate !== undefined) {
    whereQuery.course = {
      ...whereQuery.course,
      certificate: options.certificate,
    };
  }

  if (options.lifetimeAccess !== undefined) {
    whereQuery.course = {
      ...whereQuery.course,
      lifetimeAccess: options.lifetimeAccess,
    };
  }

  if (options.instructorName) {
    whereQuery.course = {
      ...whereQuery.course,
      instructorName: options.instructorName,
    };
  }

  // Handle price range filters
  if (options.priceMin !== undefined || options.priceMax !== undefined) {
    whereQuery.course = {
      ...whereQuery.course,
      price: {
        ...(options.priceMin !== undefined && {
          gte: Number(options.priceMin),
        }),
        ...(options.priceMax !== undefined && {
          lte: Number(options.priceMax),
        }),
      },
    };
  }

  // Sorting
  const orderBy = {
    [sortBy]: sortOrder,
  };

  // Fetch total count for pagination
  const total = await prisma.employeeCredential.count({ where: whereQuery });

  if (total === 0) {
    return formatPaginationResponse([], 0, page, limit);
  }

  // Fetch paginated data
  const result = await prisma.employeeCredential.findMany({
    where: whereQuery,
    skip,
    take: limit,
    orderBy,
    select: {
      id: true,
      paymentStatus: true,
      sentAt: true,
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          image: true,
          phoneNumber: true,
        },
      },
      course: {
        select: {
          id: true,
          courseTitle: true,
          courseLevel: true,
          price: true,
          certificate: true,
          lifetimeAccess: true,
          instructorName: true,
          category: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  // Transform the data to match your existing format
  const transformedData = result.map(credential => ({
    id: credential.id,
    courseId: credential.course?.id,
    courseTitle: credential.course?.courseTitle,
    coursePrice: credential.course?.price,
    courseLevel: credential.course?.courseLevel,
    certificate: credential.course?.certificate,
    lifetimeAccess: credential.course?.lifetimeAccess,
    instructorName: credential.course?.instructorName,
    categoryName: credential.course?.category?.name,
    paymentStatus: credential.paymentStatus,
    enrolledAt: credential.sentAt,
    userId: credential.user?.id,
    userFullName: credential.user?.fullName,
    userEmail: credential.user?.email,
    userImage: credential.user?.image,
    userPhoneNumber: credential.user?.phoneNumber,
  }));

  return formatPaginationResponse(transformedData, total, page, limit);
};

const getEmployeesCourseByIdFromDb = async (
  userId: string,
  enrolledId: string,
) => {
  const result = await prisma.employeeCredential.findUnique({
    where: { id: enrolledId, paymentStatus: PaymentStatus.COMPLETED },
    select: {
      id: true,
      courseId: true,
      paymentStatus: true,
      sentAt: true,
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          image: true,
          phoneNumber: true,
        },
      },
      course: { select: { id: true, courseTitle: true, price: true } },
    },
  });
  if (!result) {
    return { message: 'No enrolledCourse found for this employee' };
  }
  return {
    id: result.id,
    courseId: result.courseId,
    paymentStatus: result.paymentStatus,
    enrolledAt: result.sentAt,
    userId: result.user?.id,
    userFullName: result.user?.fullName,
    userEmail: result.user?.email,
    userImage: result.user?.image,
    userPhoneNumber: result.user?.phoneNumber,
    courseTitle: result.course?.courseTitle,
    coursePrice: result.course?.price,
  };
};

const getEnrolledCourseByStudentIdFromDb = async (
  userId: string,
  enrolledId: string,
) => {
  const result = await prisma.enrolledCourse.findUnique({
    where: { id: enrolledId, paymentStatus: PaymentStatus.COMPLETED },
    select: {
      id: true,
      courseId: true,
      paymentStatus: true,
      enrolledAt: true,
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          image: true,
          phoneNumber: true,
        },
      },
      course: { select: { id: true, courseTitle: true, price: true } },
    },
  });
  if (!result) {
    return { message: 'No enrolledCourse found for this student' };
  }

  return {
    id: result.id,
    courseId: result.courseId,
    paymentStatus: result.paymentStatus,
    enrolledAt: result.enrolledAt,
    userId: result.user?.id,
    userFullName: result.user?.fullName,
    userEmail: result.user?.email,
    userImage: result.user?.image,
    userPhoneNumber: result.user?.phoneNumber,
    courseTitle: result.course?.courseTitle,
    coursePrice: result.course?.price,
  };
};

const getMyEnrolledCoursesFromDb = async (
  userId: string,
  options: ISearchAndFilterOptions,
) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build the complete where clause manually
  const whereQuery: any = {
    userId: userId,
    paymentStatus: PaymentStatus.COMPLETED,
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
        course: {
          category: {
            name: {
              contains: options.searchTerm,
              mode: 'insensitive' as const,
            },
          },
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

  if (options.certificate !== undefined) {
    whereQuery.course = {
      ...whereQuery.course,
      certificate: options.certificate,
    };
  }

  if (options.lifetimeAccess !== undefined) {
    whereQuery.course = {
      ...whereQuery.course,
      lifetimeAccess: options.lifetimeAccess,
    };
  }

  if (options.instructorName) {
    whereQuery.course = {
      ...whereQuery.course,
      instructorName: options.instructorName,
    };
  }

  // Handle price range filters
  if (options.priceMin !== undefined || options.priceMax !== undefined) {
    whereQuery.course = {
      ...whereQuery.course,
      price: {
        ...(options.priceMin !== undefined && {
          gte: Number(options.priceMin),
        }),
        ...(options.priceMax !== undefined && {
          lte: Number(options.priceMax),
        }),
      },
    };
  }

  // Sorting
  const orderBy = {
    [sortBy]: sortOrder,
  };

  // Fetch total count for pagination
  const total = await prisma.enrolledCourse.count({ where: whereQuery });

  if (total === 0) {
    return formatPaginationResponse([], 0, page, limit);
  }

  // Fetch paginated data
  const enrolledCourses = await prisma.enrolledCourse.findMany({
    where: whereQuery,
    skip,
    take: limit,
    orderBy,
    select: {
      id: true,
      courseId: true,
      paymentStatus: true,
      enrolledAt: true,
      course: {
        select: {
          id: true,
          courseTitle: true,
          courseShortDescription: true,
          courseLevel: true,
          price: true,
          discountPrice: true,
          instructorName: true,
          courseThumbnail: true,
          certificate: true,
          lifetimeAccess: true,
          totalSections: true,
          totalLessons: true,
          totalDuration: true,
          category: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  // Get progress data for all courses
  const courseProgressList =
    await studentProgressService.getAllCourseProgress(userId);
  const progressMap = new Map<string, (typeof courseProgressList)[number]>();
  courseProgressList.forEach(progress => {
    progressMap.set(progress.courseId, progress);
  });

  // Transform data to include progress
  const transformedData = enrolledCourses.map(enrolled => ({
    id: enrolled.id,
    courseId: enrolled.courseId,
    paymentStatus: enrolled.paymentStatus,
    enrolledAt: enrolled.enrolledAt,
    courseTitle: enrolled.course?.courseTitle,
    courseShortDescription: enrolled.course?.courseShortDescription,
    courseLevel: enrolled.course?.courseLevel,
    coursePrice: enrolled.course?.price,
    discountPrice: enrolled.course?.discountPrice,
    instructorName: enrolled.course?.instructorName,
    courseThumbnail: enrolled.course?.courseThumbnail,
    certificate: enrolled.course?.certificate,
    lifetimeAccess: enrolled.course?.lifetimeAccess,
    totalSections: enrolled.course?.totalSections,
    totalLessons: enrolled.course?.totalLessons,
    totalDuration: enrolled.course?.totalDuration,
    categoryName: enrolled.course?.category?.name,
    progress: progressMap.get(enrolled.courseId) || {
      completedLessons: 0,
      totalLessons: 0,
      progressPercentage: 0,
    },
  }));

  return formatPaginationResponse(transformedData, total, page, limit);
};

const getMyEnrolledCoursesForEmployeeFromDb = async (
  userId: string,
  options: ISearchAndFilterOptions,
) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build the complete where clause manually
  const whereQuery: any = {
    OR: [{ userId: userId }, { companyId: userId }],
    paymentStatus: PaymentStatus.COMPLETED, // Only completed payments
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
        course: {
          category: {
            name: {
              contains: options.searchTerm,
              mode: 'insensitive' as const,
            },
          },
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

  if (options.certificate !== undefined) {
    whereQuery.course = {
      ...whereQuery.course,
      certificate: options.certificate,
    };
  }

  if (options.lifetimeAccess !== undefined) {
    whereQuery.course = {
      ...whereQuery.course,
      lifetimeAccess: options.lifetimeAccess,
    };
  }

  if (options.instructorName) {
    whereQuery.course = {
      ...whereQuery.course,
      instructorName: options.instructorName,
    };
  }

  // Handle price range filters
  if (options.priceMin !== undefined || options.priceMax !== undefined) {
    whereQuery.course = {
      ...whereQuery.course,
      price: {
        ...(options.priceMin !== undefined && {
          gte: Number(options.priceMin),
        }),
        ...(options.priceMax !== undefined && {
          lte: Number(options.priceMax),
        }),
      },
    };
  }

  // Sorting
  const orderBy = {
    [sortBy]: sortOrder,
  };

  // Fetch total count for pagination
  const total = await prisma.employeeCredential.count({ where: whereQuery });

  if (total === 0) {
    return formatPaginationResponse([], 0, page, limit);
  }

  // Fetch paginated data
  const result = await prisma.employeeCredential.findMany({
    where: whereQuery,
    skip,
    take: limit,
    orderBy,
    select: {
      id: true,
      paymentStatus: true,
      sentAt: true,
      progress: true,
      isCompleted: true,
      course: {
        select: {
          id: true,
          courseTitle: true,
          courseShortDescription: true,
          courseLevel: true,
          price: true,
          discountPrice: true,
          instructorName: true,
          courseThumbnail: true,
          certificate: true,
          lifetimeAccess: true,
          totalSections: true,
          totalLessons: true,
          totalDuration: true,
          category: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  // Transform data to match expected format
  const transformedData = result.map(credential => ({
    id: credential.id,
    courseId: credential.course?.id,
    courseTitle: credential.course?.courseTitle,
    courseShortDescription: credential.course?.courseShortDescription,
    courseLevel: credential.course?.courseLevel,
    coursePrice: credential.course?.price,
    discountPrice: credential.course?.discountPrice,
    instructorName: credential.course?.instructorName,
    courseThumbnail: credential.course?.courseThumbnail,
    certificate: credential.course?.certificate,
    lifetimeAccess: credential.course?.lifetimeAccess,
    totalSections: credential.course?.totalSections,
    totalLessons: credential.course?.totalLessons,
    totalDuration: credential.course?.totalDuration,
    categoryName: credential.course?.category?.name,
    paymentStatus: credential.paymentStatus,
    enrolledAt: credential.sentAt,
    progress: credential.progress || 0,
    isCompleted: credential.isCompleted || false,
  }));

  return formatPaginationResponse(transformedData, total, page, limit);
};

const getMyEnrolledCourseByIdFromDb = async (
  userId: string,
  enrolledCourseId: string,
) => {
  const result = await prisma.enrolledCourse.findFirst({
    where: {
      courseId: enrolledCourseId,
      userId: userId,
      paymentStatus: PaymentStatus.COMPLETED,
    },
    include: {
      course: {
        include: {
          Section: {
            include: {
              Lesson: true,
              Test: { select: { id: true, title: true } },
            },
          },
        },
      },
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'enrolledCourse not found');
  }

  // Show which lessons are completed from the studentProgress table
  const progressData = await prisma.studentProgress.findMany({
    where: {
      userId: userId,
      courseId: enrolledCourseId,
      isCompleted: true,
    },
    select: {
      lessonId: true,
    },
  });
  const completedLessonIds = progressData.map(progress => progress.lessonId);

  // Mark lessons as completed
  result.course.Section.forEach(section => {
    section.Lesson.forEach(lesson => {
      (lesson as any).isCompleted = completedLessonIds.includes(lesson.id);
    });
  });

  return result;
};

const getMyEnrolledCourseByIdFromDbForEmployee = async (
  userId: string,
  enrolledCourseId: string,
) => {
  const result = await prisma.employeeCredential.findFirst({
    where: {
      courseId: enrolledCourseId,
      paymentStatus: PaymentStatus.COMPLETED,
      OR: [{ userId: userId }, { companyId: userId }],
    },
    select: {
      userId: true,
      paymentStatus: true,
      courseId: true,
      progress: true,
      isCompleted: true,
      sentAt: true,
      course: {
        include: {
          Section: {
            include: {
              Lesson: true,
              Test: { select: { id: true, title: true } },
            },
          },
        },
      },
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'enrolledCourse not found');
  }
  return result;
};

const getMyOrdersFromDb = async (
  userId: string,
  role: UserRoleEnum,
  options: ISearchAndFilterOptions,
) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);
  const isEmployee = role === UserRoleEnum.COMPANY;

  // Build the complete where clause manually
  const whereQuery: any = {
    companyId: userId, // Always filter by the current user
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
    ];
  }

  // Add filter conditions
  if (options.paymentStatus) {
    whereQuery.paymentStatus = options.paymentStatus;
  }

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

  // Handle price range filters
  if (options.priceMin !== undefined || options.priceMax !== undefined) {
    whereQuery.course = {
      ...whereQuery.course,
      price: {
        ...(options.priceMin !== undefined && {
          gte: Number(options.priceMin),
        }),
        ...(options.priceMax !== undefined && {
          lte: Number(options.priceMax),
        }),
      },
    };
  }

  // Date range filter for orders
  if (options.startDate || options.endDate) {
    const dateField = isEmployee ? 'sentAt' : 'enrolledAt';
    whereQuery[dateField] = {};
    if (options.startDate) {
      whereQuery[dateField].gte = new Date(options.startDate);
    }
    if (options.endDate) {
      whereQuery[dateField].lte = new Date(options.endDate);
    }
  }

  // Sorting
  const orderBy = {
    [sortBy]: sortOrder,
  };

  let total: number;
  let orders: any[];

  if (isEmployee) {
    // Get total count for employees
    total = await prisma.employeeCredential.count({ where: whereQuery });

    if (total === 0) {
      return formatPaginationResponse([], 0, page, limit);
    }

    // Fetch employee orders
    orders = await prisma.employeeCredential.findMany({
      where: whereQuery,
      skip,
      take: limit,
      orderBy,
      select: {
        id: true,
        courseId: true,
        paymentStatus: true,
        sentAt: true,
        purchaseItem: {
          select: {
            purchase: {
              select: {
                invoice: true,
              },
            },
          },
        },
        course: {
          select: {
            id: true,
            courseTitle: true,
            price: true,
            courseLevel: true,
            courseThumbnail: true,
            category: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });
  } else {
    // Get total count for students
    total = await prisma.enrolledCourse.count({ where: whereQuery });

    if (total === 0) {
      return formatPaginationResponse([], 0, page, limit);
    }

    // Fetch student orders
    orders = await prisma.enrolledCourse.findMany({
      where: whereQuery,
      skip,
      take: limit,
      orderBy,
      select: {
        id: true,
        courseId: true,
        paymentStatus: true,
        totalAmount: true,
        enrolledAt: true,
        invoice: true,
        course: {
          select: {
            id: true,
            courseTitle: true,
            price: true,
            courseLevel: true,
            courseThumbnail: true,
            category: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });
  }

  // Transform data to consistent format
  const transformedOrders = orders.map(order => {
    // Safely extract invoice — purchaseItem can be an array or an object
    let invoice: string | null = null;
    if (isEmployee) {
      const purchaseItem = (order as any).purchaseItem;
      if (Array.isArray(purchaseItem)) {
        invoice = purchaseItem[0]?.purchase?.invoice ?? null;
      } else {
        invoice = purchaseItem?.purchase?.invoice ?? null;
      }
    } else {
      invoice = (order as any).invoice ?? null;
    }

    return {
      id: order.id,
      courseId: order.courseId,
      paymentStatus: order.paymentStatus,
      enrolledAt: isEmployee
        ? (order.sentAt ?? null)
        : (order.enrolledAt ?? null),
      invoice,
      courseTitle: order.course?.courseTitle ?? null,
      coursePrice: order.course?.price ?? null,
      courseLevel: order.course?.courseLevel ?? null,
      courseThumbnail: order.course?.courseThumbnail ?? null,
      categoryName: order.course?.category?.name ?? null,
    };
  });

  return formatPaginationResponse(transformedOrders, total, page, limit);
};

const getMyLearningHistoryForStudentFromDb = async (
  userId: string,
  options: ISearchAndFilterOptions,
) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  const whereQuery: any = {
    userId,
    paymentStatus: PaymentStatus.COMPLETED,
    progress: { gt: 0 },
  };

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
        course: {
          category: {
            name: {
              contains: options.searchTerm,
              mode: 'insensitive' as const,
            },
          },
        },
      },
    ];
  }

  if (options.courseLevel) {
    whereQuery.course = {
      ...whereQuery.course,
      courseLevel: options.courseLevel,
    };
  }

  if (options.categoryName) {
    whereQuery.course = {
      ...whereQuery.course,
      category: { name: options.categoryName },
    };
  }

  if (options.instructorName) {
    whereQuery.course = {
      ...whereQuery.course,
      instructorName: options.instructorName,
    };
  }

  if (options.priceMin !== undefined || options.priceMax !== undefined) {
    whereQuery.course = {
      ...whereQuery.course,
      price: {
        ...(options.priceMin !== undefined && { gte: Number(options.priceMin) }),
        ...(options.priceMax !== undefined && { lte: Number(options.priceMax) }),
      },
    };
  }

  if (options.startDate || options.endDate) {
    whereQuery.enrolledAt = {};
    if (options.startDate) whereQuery.enrolledAt.gte = new Date(options.startDate);
    if (options.endDate) whereQuery.enrolledAt.lte = new Date(options.endDate);
  }

  const orderBy = { [sortBy]: sortOrder };

  const total = await prisma.enrolledCourse.count({ where: whereQuery });
  if (total === 0) return formatPaginationResponse([], 0, page, limit);

  const learningHistory = await prisma.enrolledCourse.findMany({
    where: whereQuery,
    skip,
    take: limit,
    orderBy,
    select: {
      id: true,
      courseId: true,
      paymentStatus: true,
      enrolledAt: true,
      course: {
        select: {
          id: true,
          courseTitle: true,
          courseShortDescription: true,
          courseLevel: true,
          instructorName: true,
          courseThumbnail: true,
          totalSections: true,
          totalLessons: true,
          totalDuration: true,
          category: { select: { name: true } },
        },
      },
    },
  });

  const courseProgressList = await studentProgressService.getAllCourseProgress(userId);
  const progressMap = new Map<string, any>();
  courseProgressList.forEach(progress => progressMap.set(progress.courseId, progress));

  const transformedHistory = learningHistory.map(item => {
    const progress = progressMap.get(item.courseId) || {
      completedLessons: 0,
      totalLessons: 0,
      progressPercentage: 0,
    };
    return {
      id: item.id,
      courseId: item.courseId,
      courseTitle: item.course?.courseTitle,
      courseShortDescription: item.course?.courseShortDescription,
      courseLevel: item.course?.courseLevel,
      instructorName: item.course?.instructorName,
      courseThumbnail: item.course?.courseThumbnail,
      totalSections: item.course?.totalSections,
      totalLessons: item.course?.totalLessons,
      totalDuration: item.course?.totalDuration,
      categoryName: item.course?.category?.name,
      paymentStatus: item.paymentStatus,
      enrolledAt: item.enrolledAt ?? null,
      progress: progress.progressPercentage,
      completedLessons: progress.completedLessons,
      isCompleted: progress.progressPercentage === 100,
    };
  });

  return formatPaginationResponse(transformedHistory, total, page, limit);
};

const getMyLearningHistoryForCompanyEmployeeFromDb = async (
  userId: string,
  options: ISearchAndFilterOptions,
) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  const whereQuery: any = {
    OR: [{ userId }, { companyId: userId }],
    paymentStatus: PaymentStatus.COMPLETED,
    progress: { gt: 0 },
  };

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
        course: {
          category: {
            name: {
              contains: options.searchTerm,
              mode: 'insensitive' as const,
            },
          },
        },
      },
    ];
  }

  if (options.courseLevel) {
    whereQuery.course = {
      ...whereQuery.course,
      courseLevel: options.courseLevel,
    };
  }

  if (options.categoryName) {
    whereQuery.course = {
      ...whereQuery.course,
      category: { name: options.categoryName },
    };
  }

  if (options.instructorName) {
    whereQuery.course = {
      ...whereQuery.course,
      instructorName: options.instructorName,
    };
  }

  if (options.isCompleted !== undefined) {
    whereQuery.isCompleted = options.isCompleted;
  }

  if (options.progressMin !== undefined || options.progressMax !== undefined) {
    whereQuery.progress = {};
    if (options.progressMin !== undefined) whereQuery.progress.gte = Number(options.progressMin);
    if (options.progressMax !== undefined) whereQuery.progress.lte = Number(options.progressMax);
  }

  if (options.startDate || options.endDate) {
    whereQuery.sentAt = {};
    if (options.startDate) whereQuery.sentAt.gte = new Date(options.startDate);
    if (options.endDate) whereQuery.sentAt.lte = new Date(options.endDate);
  }

  const orderBy = { [sortBy]: sortOrder };

  const total = await prisma.employeeCredential.count({ where: whereQuery });
  if (total === 0) return formatPaginationResponse([], 0, page, limit);

  const learningHistory = await prisma.employeeCredential.findMany({
    where: whereQuery,
    skip,
    take: limit,
    orderBy,
    select: {
      id: true,
      courseId: true,
      paymentStatus: true,
      sentAt: true,
      progress: true,
      isCompleted: true,
      course: {
        select: {
          id: true,
          courseTitle: true,
          courseShortDescription: true,
          courseLevel: true,
          instructorName: true,
          courseThumbnail: true,
          totalSections: true,
          totalLessons: true,
          totalDuration: true,
          category: { select: { name: true } },
        },
      },
    },
  });

  const transformedHistory = learningHistory.map(item => ({
    id: item.id,
    courseId: item.courseId,
    courseTitle: item.course?.courseTitle,
    courseShortDescription: item.course?.courseShortDescription,
    courseLevel: item.course?.courseLevel,
    instructorName: item.course?.instructorName,
    courseThumbnail: item.course?.courseThumbnail,
    totalSections: item.course?.totalSections,
    totalLessons: item.course?.totalLessons,
    totalDuration: item.course?.totalDuration,
    categoryName: item.course?.category?.name,
    paymentStatus: item.paymentStatus,
    enrolledAt: item.sentAt ?? null,
    progress: item.progress || 0,
    isCompleted: item.isCompleted || false,
  }));

  return formatPaginationResponse(transformedHistory, total, page, limit);
};

/**
 * Backwards-compatible wrapper. Prefer calling the role-specific functions:
 * - getMyLearningHistoryForStudentFromDb
 * - getMyLearningHistoryForCompanyEmployeeFromDb
 */
const getMyLearningHistoryFromDb = async (
  userId: string,
  role: UserRoleEnum,
  options: ISearchAndFilterOptions,
) => {
  const isCompanyOrEmployee =
    role === UserRoleEnum.COMPANY || role === UserRoleEnum.EMPLOYEE;
  if (isCompanyOrEmployee) {
    return getMyLearningHistoryForCompanyEmployeeFromDb(userId, options);
  }
  return getMyLearningHistoryForStudentFromDb(userId, options);
};

const updateEnrolledCourseIntoDb = async (
  userId: string,
  enrolledCourseId: string,
  data: any,
) => {
  const result = await prisma.enrolledCourse.update({
    where: {
      id: enrolledCourseId,
      userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'enrolledCourseId, not updated');
  }
  return result;
};

const deleteEnrolledCourseItemFromDb = async (
  userId: string,
  enrolledCourseId: string,
) => {
  const deletedItem = await prisma.enrolledCourse.delete({
    where: {
      id: enrolledCourseId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'enrolledCourseId, not deleted');
  }

  return deletedItem;
};

export const enrolledCourseService = {
  createEnrolledCourseIntoDb,
  getEnrolledCourseListFromDb,
  getEmployeesCourseListFromDb,
  getEnrolledCourseByStudentIdFromDb,
  getEmployeesCourseByIdFromDb,
  getMyEnrolledCoursesForEmployeeFromDb,
  getMyEnrolledCoursesFromDb,
  getMyEnrolledCourseByIdFromDb,
  getMyEnrolledCourseByIdFromDbForEmployee,
  getMyOrdersFromDb,
  getMyLearningHistoryFromDb,
  updateEnrolledCourseIntoDb,
  deleteEnrolledCourseItemFromDb,
};
