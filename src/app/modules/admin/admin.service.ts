import { Company } from './../../../../node_modules/.prisma/client/index.d';
import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { IUserAddInterface } from './admin.interface';
import { calculatePagination, formatPaginationResponse, getPaginationQuery } from '../../utils/pagination';
import { buildFilterQuery, buildSearchQuery, combineQueries } from '../../utils/searchFilter';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';

const getAllUsersFromDb = async (options: ISearchAndFilterOptions) => {
  // Convert string values to appropriate types
  if (options.status !== undefined) options.status = String(options.status);
  
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build search query
  const searchFields = [
    'fullName',
    'email',
  ];
  const searchQuery = buildSearchQuery({
    searchTerm: options.searchTerm,
    searchFields,
  });

  // Build filter query
  const filterFields: Record<string, any> = {
    role: UserRoleEnum.STUDENT, // Always filter by STUDENT role
    ...(options.status && { status: options.status }),
    ...(options.dateOfBirth && { dateOfBirth: options.dateOfBirth }),
  };
  const filterQuery = buildFilterQuery(filterFields);

  // Combine all queries
  const whereQuery = combineQueries(
    searchQuery,
    filterQuery
  );

  // Sorting
  const orderBy = getPaginationQuery(sortBy, sortOrder).orderBy;

  // Fetch total count for pagination
  const total = await prisma.user.count({ where: whereQuery });

  // Fetch paginated data
  const users = await prisma.user.findMany({
    where: whereQuery,
    skip,
    take: limit,
    orderBy,
    select: {
      id: true,
      fullName: true,
      email: true,
      dateOfBirth: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });

  return formatPaginationResponse(users, total, page, limit);
};

const getUserByIdFromDb = async (userId: string) => {
  const result = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      dateOfBirth: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }
  return result;
}

const updateUserStatusIntoDb = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }
  const newStatus =
    user.status === UserStatus.ACTIVE ? UserStatus.BLOCKED : UserStatus.ACTIVE;

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { status: newStatus },
  });
  if (!updatedUser) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Failed to update user status');
  }
  return updatedUser;
}

const getAllUsersWithCompanyFromDb = async (options: ISearchAndFilterOptions) => {
  // Convert string values to appropriate types
  if (options.status !== undefined) options.status = String(options.status);
  
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build search query for user fields
  const searchFields = [
    'fullName',
    'email',
  ];
  const searchQuery = buildSearchQuery({
    searchTerm: options.searchTerm,
    searchFields,
  });

  // Build filter query
  const filterFields: Record<string, any> = {
    role: UserRoleEnum.STUDENT, // Always filter by STUDENT role
    ...(options.status && { status: options.status }),
    ...(options.dateOfBirth && { dateOfBirth: options.dateOfBirth }),
    // Ensure user has at least one company
    Company: {
      some: {}, // This means "has at least one company"
    },
  };
  const filterQuery = buildFilterQuery(filterFields);

  // Combine all queries
  const whereQuery = combineQueries(
    searchQuery,
    filterQuery
  );

  // Sorting
  const orderBy = getPaginationQuery(sortBy, sortOrder).orderBy;

  // Fetch total count for pagination
  const total = await prisma.user.count({ where: whereQuery });

  // Fetch paginated data
  const users = await prisma.user.findMany({
    where: whereQuery,
    skip,
    take: limit,
    orderBy,
    select: {
      id: true,
      fullName: true,
      email: true,
      dateOfBirth: true,
      role: true,
      status: true,
      createdAt: true,
      Company: {
        select: {
          id: true,
          userId: true,
          companyName: true,
          companyEmail: true,
          companyAddress: true,
          companyVatId: true,
          createdAt: true,
        },
      },
    },
  });

  return formatPaginationResponse(users, total, page, limit);
};

const getAUsersWithCompanyFromDb = async (userId: string) => {
  const result = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      dateOfBirth: true,
      role: true,
      status: true,
      createdAt: true,
      Company: {
        select: {
          id: true,
          userId: true,
          companyName: true,
          companyEmail: true,
          companyAddress: true,
          companyVatId: true,
          createdAt: true,
        },
      },
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }
  if (!result.Company || Object.keys(result.Company).length === 0) {
    return { message: 'No user or company details found for this user' };
  }
  
  return result;
}

const addUserWithCompanyIntoDb = async (companyData: IUserAddInterface) => {
  const user = await prisma.user.findUnique({
    where: { email: companyData.email },
  });
  if (user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User already exists');
  }
  const checkCompanyExists = await prisma.company.findFirst({
    where: { 
      OR: [
        { companyName: companyData.companyName },
        { companyEmail: companyData.companyEmail },
        { companyVatId: companyData.companyVatId }
      ]
     },
  });
  if (checkCompanyExists) {
    throw new AppError(httpStatus.NOT_FOUND, 'Company already exists');
  }
  const newUser = await prisma.user.create({
    data: {
      fullName: companyData.fullName,
      email: companyData.email,
      password: companyData.password,
      dateOfBirth: companyData.dateOfBirth,
      role: UserRoleEnum.STUDENT,
      status: UserStatus.ACTIVE,
    },
  });
  if (!newUser) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Failed to create user');
  }

  if (!companyData.companyName || !companyData.companyEmail || !companyData.companyAddress || !companyData.companyVatId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Incomplete company data');
  }
  const newCompany = await prisma.company.create({
    data: {
      userId: newUser.id,
      companyName: companyData.companyName!,
      companyEmail: companyData.companyEmail!,
      companyAddress: companyData.companyAddress!,
      companyVatId: companyData.companyVatId!,
    },
  });
  if (!newCompany) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Failed to create company');
  }
  return { newUser, newCompany };
}


const getAllEnrolledStudentsFromDb = async () => {
  const result = await prisma.enrolledCourse.findMany({
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
      course: {
        select: {
          id: true,
          courseTitle: true,
        },
      },
    },
  });
  if (result.length === 0) {
    return { message: 'No enrolled students found' };
  }
  return result;
}

const getAllCompaniesWithCoursesFromDb = async (options: ISearchAndFilterOptions) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build search query for company fields
  const searchFields = [
    'companyName',
    'companyEmail',
  ];
  const searchQuery = buildSearchQuery({
    searchTerm: options.searchTerm,
    searchFields,
  });

  // Build filter query
  const filterFields: Record<string, any> = {
    // Add any company-specific filters here
  };
  const filterQuery = buildFilterQuery(filterFields);

  // Combine all queries
  const whereQuery = combineQueries(
    searchQuery,
    filterQuery
  );

  // Sorting
  const orderBy = getPaginationQuery(sortBy, sortOrder).orderBy;

  // Fetch total count for pagination
  const total = await prisma.company.count({ where: whereQuery });

  // Fetch paginated data
  const companies = await prisma.company.findMany({
    where: whereQuery,
    skip,
    take: limit,
    orderBy,
    include: {
      User: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
      CompanyPurchase: {
        select: {
          items: {
            select: {
              course: {
                select: {
                  id: true,
                  courseTitle: true,
                },
              },
            },
          },
        },
      },
    },
  });

  return formatPaginationResponse(companies, total, page, limit);
};

const getAllNewsletterSubscribersFromDb = async (options: ISearchAndFilterOptions) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build search query for newsletter subscriber fields
  const searchFields = [
    'email',
  ];
  const searchQuery = buildSearchQuery({
    searchTerm: options.searchTerm,
    searchFields,
  });

  // Build filter query
  const filterFields: Record<string, any> = {
    // Add any newsletter subscriber-specific filters here
  };
  const filterQuery = buildFilterQuery(filterFields);

  // Combine all queries
  const whereQuery = combineQueries(
    searchQuery,
    filterQuery
  );

  // Sorting
  const orderBy = getPaginationQuery(sortBy, sortOrder).orderBy;

  // Fetch total count for pagination
  const total = await prisma.newsletterSubscriber.count({ where: whereQuery });

  // Fetch paginated data
  const subscribers = await prisma.newsletterSubscriber.findMany({
    where: whereQuery,
    skip,
    take: limit,
    orderBy,
    select: {
      id: true,
      email: true,
      createdAt: true,
    },
  });

  return formatPaginationResponse(subscribers, total, page, limit);
};

export const adminService = {
  getAllUsersFromDb,
  getUserByIdFromDb,
  updateUserStatusIntoDb,
  getAllUsersWithCompanyFromDb,
  getAUsersWithCompanyFromDb,
  addUserWithCompanyIntoDb,
  getAllEnrolledStudentsFromDb,
  getAllCompaniesWithCoursesFromDb,
  getAllNewsletterSubscribersFromDb,

};