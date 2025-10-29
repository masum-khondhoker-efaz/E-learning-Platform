import { Company } from './../../../../node_modules/.prisma/client/index.d';
import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus, PaymentStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { IUserAddInterface } from './admin.interface';
import * as bcrypt from 'bcrypt';
import {
  calculatePagination,
  formatPaginationResponse,
  getPaginationQuery,
} from '../../utils/pagination';
import {
  buildFilterQuery,
  buildSearchQuery,
  combineQueries,
} from '../../utils/searchFilter';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import { create } from 'domain';

const getDashboardStatsFromDb = async () => {
  // total users count without admin and super admin
  const totalUsers = await prisma.user.count({
    where: {
      role: { in: [UserRoleEnum.STUDENT, UserRoleEnum.EMPLOYEE] },
    },
  });

  // total companies count
  const totalCompanies = await prisma.company.count();

  // total courses count
  const totalCourses = await prisma.course.count();

  //total tests count
  const totalTests = await prisma.test.count();

  // total enrollments count
  const totalEnrollments = await prisma.enrolledCourse.count();

  // total Income from enrollments and purchases
  const totalIncome = await prisma.payment.aggregate({
    _sum: {
      paymentAmount: true,
    },
    where: {
      status: PaymentStatus.COMPLETED,
    },
  });

  const earningGrowth = await prisma.payment.groupBy({
    by: ['createdAt'],
    _sum: {
      paymentAmount: true,
    },
    where: {
      status: PaymentStatus.COMPLETED,
      createdAt: {
        gte: new Date(new Date().setMonth(new Date().getMonth() - 1)), // Last month
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const userGrowth = await prisma.user.groupBy({
    by: ['createdAt', 'role'],
    _count: {
      id: true,
    },
    where: {
      role: {
        in: [UserRoleEnum.STUDENT, UserRoleEnum.EMPLOYEE, UserRoleEnum.COMPANY],
      },
      status: UserStatus.ACTIVE,
      createdAt: {
        gte: new Date(new Date().setMonth(new Date().getMonth() - 1)), // Last month
      },
    },
    orderBy: [{ createdAt: 'asc' }, { role: 'asc' }],
  });

  // Prepare last 12 months labels
  interface MonthEarning {
    label: string;
    year: number;
    month: number;
    total: number;
  }
  const months: MonthEarning[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      label: d.toLocaleString('default', { month: 'short', year: 'numeric' }), // e.g. "Jan 2024"
      year: d.getFullYear(),
      month: d.getMonth(),
      total: 0,
    });
  }

  // Map earningGrowth to month index
  earningGrowth.forEach(item => {
    const date = new Date(item.createdAt);
    const idx = months.findIndex(
      m => m.year === date.getFullYear() && m.month === date.getMonth(),
    );
    if (idx !== -1) {
      months[idx].total += item._sum.paymentAmount || 0;
    }
  });

  // Prepare user growth per month with month name
  const userGrowthByMonth: { month: string; role: string; count: number }[] =
    [];
  months.forEach(month => {
    ['STUDENT', 'COMPANY', 'EMPLOYEE'].forEach(role => {
      const count = userGrowth
        .filter(
          item =>
            item.role === role &&
            item.createdAt.getFullYear() === month.year &&
            item.createdAt.getMonth() === month.month,
        )
        .reduce((sum, item) => sum + item._count.id, 0);
      userGrowthByMonth.push({
        month: month.label,
        role,
        count,
      });
    });
  });

  return {
    totalUsers,
    totalCompanies,
    totalCourses,
    totalTests,
    totalEnrollments,
    totalIncome: totalIncome._sum.paymentAmount || 0,
    earningGrowth: months.map(m => ({ label: m.label, total: m.total })),
    userGrowth: userGrowthByMonth,
  };
};

const getAllUsersFromDb = async (options: ISearchAndFilterOptions) => {
  // Convert string values to appropriate types
  if (options.status !== undefined) options.status = String(options.status);

  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build search query
  const searchFields = ['fullName', 'email'];
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
  const whereQuery = combineQueries(searchQuery, filterQuery);

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
};

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
};

const getAllUsersWithCompanyFromDb = async (
  options: ISearchAndFilterOptions,
) => {
  //fetch all companies with details
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build search query for user and company fields
  const searchFields = [
    'fullName',
    'email',
    'Company.companyName',
    'Company.companyEmail',
    'Company.companyAddress',
  ];
  const searchQuery = buildSearchQuery({
    searchTerm: options.searchTerm,
    searchFields,
  });

  // Build filter query
  const filterFields: Record<string, any> = {
    role: UserRoleEnum.COMPANY, // Always filter by COMPANY role
    ...(options.status && { status: options.status }),
    ...(options.dateOfBirth && { dateOfBirth: options.dateOfBirth }),
    ...(options.role && { role: options.role }),
    ...(options.fullName && { fullName: options.fullName }),
    ...(options.email && { email: options.email }),
  };
  const filterQuery = buildFilterQuery(filterFields);

  // Combine all queries
  const whereQuery = combineQueries(searchQuery, filterQuery);

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
      image: true,
      createdAt: true,
      Company: {
        select: {
          id: true,
          companyName: true,
          companyEmail: true,
          companyAddress: true,
          companyVatId: true,
          createdAt: true,
        },
      },
    },
  });

  // flatten the result
  const flattenedUsers = users.map(user => ({
    id: user.id,
    companyName: user.fullName,
    companyEmail: user.email,
    // dateOfBirth: user.dateOfBirth,
    role: user.role,
    // status: user.status,
    createdAt: user.createdAt,
    companyVatId: Array.isArray(user.Company)
      ? (user.Company[0]?.companyVatId ?? null)
      : ((user.Company as any)?.companyVatId ?? null),

    registrationDate: Array.isArray(user.Company)
      ? (user.Company[0]?.createdAt ?? null)
      : ((user.Company as any)?.createdAt ?? null),
    companyAddress: Array.isArray(user.Company)
      ? (user.Company[0]?.companyAddress ?? null)
      : ((user.Company as any)?.companyAddress ?? null),
    companyImage: user.image || null,
  }));

  return formatPaginationResponse(flattenedUsers, total, page, limit);
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
};

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
        { companyVatId: companyData.companyVatId },
      ],
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

  if (
    !companyData.companyName ||
    !companyData.companyEmail ||
    !companyData.companyAddress ||
    !companyData.companyVatId
  ) {
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
};

const getAllCoursesFromDb = async (options: ISearchAndFilterOptions) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build search query for course fields
  const searchFields = ['courseTitle'];
  const searchQuery = buildSearchQuery({
    searchTerm: options.searchTerm,
    searchFields,
  });

  // Build filter query
  const filterFields: Record<string, any> = {
    // ...(options.category && { category: options.category }),
    ...(options.courseLevel && { level: options.courseLevel }),
    ...(options.status && { status: options.status }),
  };
  const filterQuery = buildFilterQuery(filterFields);

  // Combine all queries
  const whereQuery = combineQueries(searchQuery, filterQuery);

  // Sorting
  const orderBy = getPaginationQuery(sortBy, sortOrder).orderBy;

  // Fetch total count for pagination
  const total = await prisma.course.count({ where: whereQuery });

  // Fetch paginated data
  const courses = await prisma.course.findMany({
    where: whereQuery,
    skip,
    take: limit,
    orderBy,
    select: {
      id: true,
      courseTitle: true,
    },
  });

  return formatPaginationResponse(courses, total, page, limit);
};

const addUserWithCourseAccessIntoDb = async (
  employeeData: IUserAddInterface,
) => {
  return await prisma.$transaction(async tx => {
    // Validate course exists
    const course = await tx.course.findUnique({
      where: { id: employeeData.courseId },
    });
    if (!course) {
      throw new AppError(httpStatus.NOT_FOUND, 'Course not found');
    }

    // Ensure company email and employee email are not the same (case-insensitive)
    if (
      employeeData.companyEmail &&
      employeeData.email &&
      employeeData.companyEmail.trim().toLowerCase() ===
        employeeData.email.trim().toLowerCase()
    ) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Company email and employee email cannot be the same',
      );
    }

    // Try to find an existing company user by company email
    const existingCompanyUser = await tx.user.findUnique({
      where: { email: employeeData.companyEmail },
      include: { Company: true },
    });

    let companyUserId: string;
    let companyRecord: any = null;

    if (existingCompanyUser) {
      // Use existing company user id and existing company record (if any)
      companyUserId = existingCompanyUser.id;
      companyRecord = Array.isArray(existingCompanyUser.Company)
        ? existingCompanyUser.Company[0]
        : ((existingCompanyUser.Company as any) ?? null);

      // If the user exists but has no company record, create one (if enough data provided)
      if (!companyRecord) {
        if (
          !employeeData.companyName ||
          !employeeData.companyEmail ||
          !employeeData.companyAddress ||
          !employeeData.companyVatId
        ) {
          throw new AppError(
            httpStatus.BAD_REQUEST,
            'Incomplete company data to create missing company record',
          );
        }
        companyRecord = await tx.company.create({
          data: {
            userId: companyUserId,
            companyName: employeeData.companyName!,
            companyEmail: employeeData.companyEmail!,
            companyAddress: employeeData.companyAddress!,
            companyVatId: employeeData.companyVatId!,
          },
        });
        if (!companyRecord) {
          throw new AppError(
            httpStatus.BAD_REQUEST,
            'Failed to create company',
          );
        }
      }
    } else {
      // Create company user
      const companyPasswordHashed = await bcrypt.hash(
        employeeData.companyPassword || '12345678',
        12,
      );

      const companyInUser = await tx.user.create({
        data: {
          fullName: employeeData.companyName,
          email: employeeData.companyEmail!,
          password: companyPasswordHashed,
          vatId: employeeData.companyVatId,
          address: employeeData.companyAddress
            ? employeeData.companyAddress
            : '',
          phoneNumber: employeeData.phoneNumber,
          role: UserRoleEnum.COMPANY,
          status: UserStatus.ACTIVE,
          isProfileComplete: true,
          isVerified: true,
        },
      });
      if (!companyInUser) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Failed to create user');
      }
      companyUserId = companyInUser.id;

      // Create company record
      if (
        !employeeData.companyName ||
        !employeeData.companyEmail ||
        !employeeData.companyAddress ||
        !employeeData.companyVatId
      ) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Incomplete company data');
      }
      companyRecord = await tx.company.create({
        data: {
          userId: companyUserId,
          companyName: employeeData.companyName!,
          companyEmail: employeeData.companyEmail!,
          companyAddress: employeeData.companyAddress!,
          companyVatId: employeeData.companyVatId!,
        },
      });
      if (!companyRecord) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Failed to create company');
      }
    }

    // Create company purchase and purchase item for the course
    let purchaseItemId: string | undefined;
    const companyPurchase = await tx.companyPurchase.create({
      data: {
        companyId: companyUserId,
        totalAmount: 0,
      },
    });
    if (!companyPurchase) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Failed to create company purchase',
      );
    }
    const purchaseItem = await tx.companyPurchaseItem.create({
      data: {
        purchaseId: companyPurchase.id,
        courseId: employeeData.courseId!,
      },
    });
    if (!purchaseItem) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Failed to create purchase item',
      );
    }
    purchaseItemId = purchaseItem.id;

    // Ensure employee (end user) does not already exist
    const existingUser = await tx.user.findUnique({
      where: { email: employeeData.email },
    });
    if (existingUser) {
      throw new AppError(httpStatus.NOT_FOUND, 'User already exists');
    }

    const hashedPassword = await bcrypt.hash(employeeData.password, 12);

    // Create employee user
    const newUser = await tx.user.create({
      data: {
        fullName: employeeData.fullName,
        email: employeeData.email,
        password: hashedPassword,
        address: employeeData.address,
        phoneNumber: employeeData.phoneNumber,
        dateOfBirth: employeeData.dateOfBirth,
        role: UserRoleEnum.EMPLOYEE,
        status: UserStatus.ACTIVE,
        isVerified: true,
        isProfileComplete: true,
      },
    });
    if (!newUser) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Failed to create user');
    }

    // Assign course access if courseId is provided
    if (employeeData.courseId) {
      const employee = await tx.employeeCredential.create({
        data: {
          userId: newUser.id,
          purchaseItemId: purchaseItemId!,
          companyId: companyUserId,
          courseId: employeeData.courseId,
          loginEmail: employeeData.email,
          password: hashedPassword,
          paymentStatus: PaymentStatus.COMPLETED,
        },
      });

      if (!employee) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Failed to assign course access to user',
        );
      }
    }

    return {
      id: newUser.id,
      fullName: newUser.fullName,
      email: newUser.email,
      role: newUser.role,
      status: newUser.status,
      courseId: employeeData.courseId || null,
      createdAt: newUser.createdAt,
      companyId: companyUserId,
    };
  });
};

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
};

const getAllCompaniesWithCoursesFromDb = async (
  options: ISearchAndFilterOptions,
) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build search query for company fields
  const searchFields = ['companyName', 'companyEmail'];
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
  const whereQuery = combineQueries(searchQuery, filterQuery);

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

const getAllNewsletterSubscribersFromDb = async (
  options: ISearchAndFilterOptions,
) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build search query for newsletter subscriber fields
  const searchFields = ['email'];
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
  const whereQuery = combineQueries(searchQuery, filterQuery);

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
  getDashboardStatsFromDb,
  getAllUsersFromDb,
  getUserByIdFromDb,
  updateUserStatusIntoDb,
  getAllUsersWithCompanyFromDb,
  getAllCoursesFromDb,
  addUserWithCourseAccessIntoDb,
  getAUsersWithCompanyFromDb,
  addUserWithCompanyIntoDb,
  getAllEnrolledStudentsFromDb,
  getAllCompaniesWithCoursesFromDb,
  getAllNewsletterSubscribersFromDb,
};
