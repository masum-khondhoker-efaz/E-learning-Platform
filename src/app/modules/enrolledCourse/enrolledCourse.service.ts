import prisma from '../../utils/prisma';
import { PaymentStatus, UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { studentProgressService } from '../studentProgress/studentProgress.service';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import { 
  buildSearchQuery, 
  buildFilterQuery, 
  combineQueries 
} from '../../utils/searchFilter';
import { 
  calculatePagination, 
  formatPaginationResponse, 
  getPaginationQuery 
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

const getEnrolledCourseListFromDb = async (userId: string, options: ISearchAndFilterOptions) => {
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
        ...(options.priceMin !== undefined && { gte: Number(options.priceMin) }),
        ...(options.priceMax !== undefined && { lte: Number(options.priceMax) }),
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

const getEmployeesCourseListFromDb = async (options: ISearchAndFilterOptions) => {
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
        ...(options.priceMin !== undefined && { gte: Number(options.priceMin) }),
        ...(options.priceMax !== undefined && { lte: Number(options.priceMax) }),
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

const getMyEnrolledCoursesFromDb = async (userId: string) => {
  const enrolledCourses = await prisma.enrolledCourse.findMany({
    where: { userId, paymentStatus: PaymentStatus.COMPLETED },
    select: {
      id: true,
      courseId: true,
      paymentStatus: true,
      enrolledAt: true,
      course: { select: { id: true, courseTitle: true, price: true } },
    },
  });

  if (!enrolledCourses.length) {
    return { message: 'No enrolledCourse found for this student' };
  }

  const courseProgressList =
    await studentProgressService.getAllCourseProgress(userId);
  const progressMap = new Map<string, (typeof courseProgressList)[number]>();
  courseProgressList.forEach(progress => {
    progressMap.set(progress.courseId, progress);
  });

  return enrolledCourses.map(enrolled => ({
    id: enrolled.id,
    courseId: enrolled.courseId,
    paymentStatus: enrolled.paymentStatus,
    enrolledAt: enrolled.enrolledAt,
    courseTitle: enrolled.course?.courseTitle,
    coursePrice: enrolled.course?.price,
    progress: progressMap.get(enrolled.courseId) || {
      completedLessons: 0,
      totalLessons: 0,
      progressPercentage: 0,
    },
  }));
};

const getMyEnrolledCoursesForEmployeeFromDb = async (userId: string) => {
  const result = await prisma.employeeCredential.findMany({
    where: { userId: userId, paymentStatus: PaymentStatus.COMPLETED },
    select: {
      id: true,
      paymentStatus: true,
      sentAt: true,
      course: {
        select: {
          id: true,
          courseTitle: true,
          price: true,
        },
      },
    },
  });

  if (result.length === 0) {
    return { message: 'No enrolledCourse found for this employee' };
  }
  return result.map(credential => ({
    id: credential.id,
    courseId: credential.course?.id,
    courseTitle: credential.course?.courseTitle,
    coursePrice: credential.course?.price,
    paymentStatus: credential.paymentStatus,
    enrolledAt: credential.sentAt,
  }));
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
  return result;
};

const getMyEnrolledCourseByIdFromDbForEmployee = async (
  userId: string,
  enrolledCourseId: string,
) => {
  const result = await prisma.employeeCredential.findFirst({
    where: {
      courseId: enrolledCourseId,
      userId: userId,
      paymentStatus: PaymentStatus.COMPLETED,
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

const getMyOrdersFromDb = async (userId: string, role: UserRoleEnum) => {
  const isEmployee = role === UserRoleEnum.EMPLOYEE;

  let orders;
  if (isEmployee) {
    orders = await prisma.employeeCredential.findMany({
      where: { userId },
      select: {
        id: true,
        courseId: true,
        paymentStatus: true,
        sentAt: true,
        course: { select: { id: true, courseTitle: true, price: true } },
      },
    });
  } else {
    orders = await prisma.enrolledCourse.findMany({
      where: { userId },
      select: {
        id: true,
        courseId: true,
        paymentStatus: true,
        enrolledAt: true,
        invoiceId: true,
        course: { select: { id: true, courseTitle: true, price: true } },
      },
    });
  }

  if (orders.length === 0) {
    return { message: `No orders found for this ${isEmployee ? 'employee' : 'student'}` };
  }

  return orders.map(order => ({
    id: order.id,
    courseId: order.courseId,
    paymentStatus: order.paymentStatus,
    enrolledAt: isEmployee
      ? ('sentAt' in order ? order.sentAt ?? null : null)
      : ('enrolledAt' in order ? order.enrolledAt ?? null : null),
    invoiceId: isEmployee ? undefined : ('invoiceId' in order ? order.invoiceId : undefined),
    courseTitle: order.course?.courseTitle,
    coursePrice: order.course?.price,
  }));
};

const getMyLearningHistoryFromDb = async (userId: string, role: UserRoleEnum) => {
  const isEmployee = role === UserRoleEnum.EMPLOYEE;
  let learningHistory;
  if (isEmployee) {
    learningHistory = await prisma.employeeCredential.findMany({  
      where: { userId, isCompleted: true },
      select: {
        id: true,
        courseId: true,
        paymentStatus: true,
        sentAt: true,
        course: { select: { id: true, courseTitle: true, price: true } },
      },
    });
  }
  else {
    learningHistory = await prisma.enrolledCourse.findMany({
      where: { userId, isCompleted: true },
      select: {
        id: true,
        courseId: true,
        paymentStatus: true,
        enrolledAt: true,
        invoiceId: true,
        course: { select: { id: true, courseTitle: true, price: true } },
      },
    });
  }
  if (learningHistory.length === 0) {
    return { message: `No learning history found for this ${isEmployee ? 'employee' : 'student'}` };
  }
  return learningHistory.map(entry => ({
    id: entry.id,
    courseId: entry.courseId,
    paymentStatus: entry.paymentStatus,
    enrolledAt: isEmployee
      ? ('sentAt' in entry ? entry.sentAt ?? null : null)
      : ('enrolledAt' in entry ? entry.enrolledAt ?? null : null),
    invoiceId: isEmployee ? undefined : ('invoiceId' in entry ? entry.invoiceId : undefined),
    courseTitle: entry.course?.courseTitle,
    coursePrice: entry.course?.price,
  }));
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
