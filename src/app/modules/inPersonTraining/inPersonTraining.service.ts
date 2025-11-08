import prisma from '../../utils/prisma';
import {
  InPersonTrainingStatus,
  UserRoleEnum,
  UserStatus,
} from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import { 
  calculatePagination, 
  formatPaginationResponse 
} from '../../utils/pagination';

const createInPersonTrainingIntoDb = async (userId: string, data: any) => {
  const existingInPersonTraining = await prisma.inPersonTraining.findFirst({
    where: {
      courseId: data.courseId,
      userId: userId,
    },
  });
  if (existingInPersonTraining) {
    return { message: 'InPersonTraining for this course already exists' };
  }

  const result = await prisma.inPersonTraining.create({
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'inPersonTraining not created');
  }
  return result;
};


const getInPersonTrainingListFromDb = async (userId: string, options: ISearchAndFilterOptions) => {
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
      // {
      //   companyName: {
      //     contains: options.searchTerm,
      //     mode: 'insensitive' as const,
      //   },
      // },
      // {
      //   contactPersonName: {
      //     contains: options.searchTerm,
      //     mode: 'insensitive' as const,
      //   },
      // },
    ];
  }

  // Add filter conditions
  if (options.status) {
    whereQuery.status = options.status;
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

  if (options.instructorName) {
    whereQuery.course = {
      ...whereQuery.course,
      instructorName: options.instructorName,
    };
  }

  // Date range filter for training date
  if (options.startDate || options.endDate) {
    whereQuery.preferredDate = {};
    if (options.startDate) {
      whereQuery.preferredDate.gte = new Date(options.startDate);
    }
    if (options.endDate) {
      whereQuery.preferredDate.lte = new Date(options.endDate);
    }
  }

  // Sorting
  const orderBy = {
    [sortBy]: sortOrder,
  };

  // Fetch total count for pagination
  const total = await prisma.inPersonTraining.count({ where: whereQuery });

  if (total === 0) {
    return formatPaginationResponse([], 0, page, limit);
  }

  // Fetch paginated data
  const inPersonTrainings = await prisma.inPersonTraining.findMany({
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
          phoneNumber: true,
        },
      },
      course: {
        select: {
          id: true,
          courseTitle: true,
          courseLevel: true,
          instructorName: true,
          price: true,
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

  // flatten the user and course details into the main object
  const transformedInPersonTrainings = inPersonTrainings.map((training) => ({
    id: training.id,
    userId: training.userId,
    courseId: training.courseId,
    status: training.status,
    createdAt: training.createdAt,
    updatedAt: training.updatedAt,
    user: training.user,
    course: training.course,
  }));


  return formatPaginationResponse(transformedInPersonTrainings, total, page, limit);
};

const getInPersonTrainingByIdFromDb = async (
  userId: string,
  inPersonTrainingId: string,
) => {
  const result = await prisma.inPersonTraining.findUnique({
    where: {
      id: inPersonTrainingId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'inPersonTraining not found');
  }
  return result;
};

const getMyInPersonTrainingRequestFromDb = async (userId: string, options: ISearchAndFilterOptions) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);
  // Build the complete where clause manually
  const whereQuery: any = {
    userId: userId, // Always filter by the current user
    status: InPersonTrainingStatus.PENDING, // Only pending requests
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
          instructorName: {
            contains: options.searchTerm,
            mode: 'insensitive' as const,
          },
        },
      },
      {
        companyName: {
          contains: options.searchTerm,
          mode: 'insensitive' as const,
        },
      },
      {
        contactPersonName: {
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

  // Date range filter for training date
  if (options.startDate || options.endDate) {
    whereQuery.preferredDate = {};
    if (options.startDate) {
      whereQuery.preferredDate.gte = new Date(options.startDate);
    }
    if (options.endDate) {
      whereQuery.preferredDate.lte = new Date(options.endDate);
    }
  }

  // Sorting
  const orderBy = {
    [sortBy]: sortOrder,
  };

  // Fetch total count for pagination
  const total = await prisma.inPersonTraining.count({ where: whereQuery });

  if (total === 0) {
    return formatPaginationResponse([], 0, page, limit);
  }

  // Fetch paginated data
  const inPersonTrainingRequests = await prisma.inPersonTraining.findMany({
    where: whereQuery,
    skip,
    take: limit,
    orderBy,
    include: {
      course: {
        select: {
          id: true,
          courseTitle: true,
          courseLevel: true,
          instructorName: true,
          price: true,
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

  return formatPaginationResponse(inPersonTrainingRequests, total, page, limit);
};

const getMyInPersonTrainingRequestByIdFromDb = async (
  userId: string,
  inPersonTrainingId: string,
) => {
  const result = await prisma.inPersonTraining.findFirst({
    where: {
      id: inPersonTrainingId,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'InPersonTraining not found for this user',
    );
  }
  return result;
};

const getMyInPersonTrainingsFromDb = async (userId: string, options: ISearchAndFilterOptions) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build the complete where clause manually
  const whereQuery: any = {
    userId: userId, // Always filter by the current user
    status: {
      in: [InPersonTrainingStatus.CONFIRMED, InPersonTrainingStatus.COMPLETED]
    }, // Only confirmed or completed trainings
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
          instructorName: {
            contains: options.searchTerm,
            mode: 'insensitive' as const,
          },
        },
      },
      {
        companyName: {
          contains: options.searchTerm,
          mode: 'insensitive' as const,
        },
      },
      {
        contactPersonName: {
          contains: options.searchTerm,
          mode: 'insensitive' as const,
        },
      },
    ];
  }

  // Add filter conditions
  if (options.status) {
    // Override the default status filter if specific status is provided
    whereQuery.status = options.status;
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

  if (options.instructorName) {
    whereQuery.course = {
      ...whereQuery.course,
      instructorName: options.instructorName,
    };
  }

  // Date range filter for training date
  if (options.startDate || options.endDate) {
    whereQuery.preferredDate = {};
    if (options.startDate) {
      whereQuery.preferredDate.gte = new Date(options.startDate);
    }
    if (options.endDate) {
      whereQuery.preferredDate.lte = new Date(options.endDate);
    }
  }

  // Sorting
  const orderBy = {
    [sortBy]: sortOrder,
  };

  // Fetch total count for pagination
  const total = await prisma.inPersonTraining.count({ where: whereQuery });

  if (total === 0) {
    return formatPaginationResponse([], 0, page, limit);
  }

  // Fetch paginated data
  const myInPersonTrainings = await prisma.inPersonTraining.findMany({
    where: whereQuery,
    skip,
    take: limit,
    orderBy,
    include: {
      course: {
        select: {
          id: true,
          courseTitle: true,
          courseLevel: true,
          instructorName: true,
          price: true,
          courseThumbnail: true,
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

  // flatten the course details into the main object
  const transformedInPersonTrainings = myInPersonTrainings.map((training) => ({
    id: training.id,
    userId: training.userId,
    courseId: training.courseId,
    status: training.status,
    location: training.location,
    price: training.price,
    courseTitle: training.course.courseTitle,
    courseLevel: training.course.courseLevel,
    instructorName: training.course.instructorName,
    courseThumbnail: training.course.courseThumbnail,
    categoryName: training.course.category.name,
    createdAt: training.createdAt,
    updatedAt: training.updatedAt,
  }));

  return formatPaginationResponse(transformedInPersonTrainings, total, page, limit);
  //

};

const getMyInPersonTrainingByIdFromDb = async (
  userId: string,
  inPersonTrainingId: string,
) => {
  const result = await prisma.inPersonTraining.findFirst({
    where: {
      id: inPersonTrainingId,
      userId: userId,
      status:
        InPersonTrainingStatus.CONFIRMED || InPersonTrainingStatus.COMPLETED,
    },
  });
  if (!result) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'InPersonTraining not found for this user',
    );
  }
  return result;
};

const updateInPersonTrainingIntoDb = async (
  userId: string,
  inPersonTrainingId: string,
  data: any,
) => {
  const findExistingInPersonTraining = await prisma.inPersonTraining.findUnique(
    {
      where: {
        id: inPersonTrainingId,
      },
    },
  );
  if (!findExistingInPersonTraining) {
    throw new AppError(httpStatus.NOT_FOUND, 'inPersonTraining not found');
  }

  // Only allow update if status is PENDING
  if (findExistingInPersonTraining.status !== InPersonTrainingStatus.PENDING) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Only PENDING inPersonTrainings can be updated',
    );
  }

  // Proceed with the update

  const result = await prisma.inPersonTraining.update({
    where: {
      id: inPersonTrainingId,
      status: InPersonTrainingStatus.PENDING,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'inPersonTrainingId, not updated',
    );
  }
  return result;
};

const deleteInPersonTrainingItemFromDb = async (
  userId: string,
  inPersonTrainingId: string,
) => {
  const existingItem = await prisma.inPersonTraining.findUnique({
    where: {
      id: inPersonTrainingId,
    },
  });
  if (!existingItem) {
    throw new AppError(httpStatus.NOT_FOUND, 'inPersonTraining not found');
  }
  const deletedItem = await prisma.inPersonTraining.delete({
    where: {
      id: inPersonTrainingId,
    },
  });
  if (!deletedItem) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'inPersonTrainingId, not deleted',
    );
  }

  return deletedItem;
};

export const inPersonTrainingService = {
  createInPersonTrainingIntoDb,
  getInPersonTrainingListFromDb,
  getInPersonTrainingByIdFromDb,
  getMyInPersonTrainingRequestFromDb,
  getMyInPersonTrainingRequestByIdFromDb,
  getMyInPersonTrainingsFromDb,
  getMyInPersonTrainingByIdFromDb,
  updateInPersonTrainingIntoDb,
  deleteInPersonTrainingItemFromDb,
};
