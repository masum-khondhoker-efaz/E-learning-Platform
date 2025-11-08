import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { adminService } from './admin.service';
import { pickValidFields } from '../../utils/pickValidFields';

const getDashboardStats = catchAsync(async (req, res) => {
  const result = await adminService.getDashboardStatsFromDb(req.query.year as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Dashboard stats retrieved successfully',
    data: result,
  });
});

const getAllUsers = catchAsync(async (req, res) => {
  const filters = pickValidFields(req.query, [
      'page',
      'limit',
      'sortBy',
      'sortOrder',
      'searchTerm',
      'status',
    ]);
  const result = await adminService.getAllUsersFromDb(filters);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getUserById = catchAsync(async (req, res) => {
  const result = await adminService.getUserByIdFromDb(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User details retrieved successfully',
    data: result,
  });
});

const updateUserStatus = catchAsync(async (req, res) => {
  const result = await adminService.updateUserStatusIntoDb(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User updated successfully',
    data: result,
  });
});

const getAllUsersWithCompany = catchAsync(async (req, res) => {
  const filters = pickValidFields(req.query, [
      'page',
      'limit',
      'sortBy',
      'sortOrder',
      'searchTerm',
      'status',
      'dateOfBirth',
      'role',
      'fullName',
      'email',
      'companyName',
      'companyAddress',
      'companyEmail',
      'companyDescription',
      'courseTitle',
    ]);
  const result = await adminService.getAllUsersWithCompanyFromDb(filters);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User with company list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});


const getAUsersWithCompany = catchAsync(async (req, res) => {
  const result = await adminService.getAUsersWithCompanyFromDb(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User with company details retrieved successfully',
    data: result,
  });
});

const getAllCourses = catchAsync(async (req, res) => {
  const filters = pickValidFields(req.query, [
      'page',
      'limit',
      'sortBy',
      'sortOrder',
      'searchTerm',
      'category',
      'level',
      'status',
      'title',
    ]);
  const result = await adminService.getAllCoursesFromDb(filters);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Course list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const addUserWithCourseAccess = catchAsync(async (req, res) => {
  const result = await adminService.addUserWithCourseAccessIntoDb(req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'User with company created successfully',
    data: result,
  });
});

const getAllEnrolledStudents = catchAsync(async (req, res) => {
  const result = await adminService.getAllEnrolledStudentsFromDb();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Enrolled students list retrieved successfully',
    data: result,
  });
});

const getAllCompaniesWithCourses = catchAsync(async (req, res) => {
  const filters = pickValidFields(req.query, [
      'page',
      'limit',
      'sortBy',
      'sortOrder',
      'searchTerm',
      'companyName',
      'companyEmail',
      'companyAddress',
      'companyVatId',
      'courseTitle',
    ]);
  const result = await adminService.getAllCompaniesWithCoursesFromDb(filters);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Companies with courses list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getAllNewsletterSubscribers = catchAsync(async (req, res) => {
  const filters = pickValidFields(req.query, [
      'page',
      'limit',
      'sortBy',
      'sortOrder',
      'searchTerm',
      'email',
    ]);
  const result = await adminService.getAllNewsletterSubscribersFromDb(filters);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Newsletter Subscribers list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

export const adminController = {
  getDashboardStats,
  getAllUsers,
  getUserById,
  updateUserStatus,
  getAllUsersWithCompany,
  getAllCourses,
  addUserWithCourseAccess,
  getAUsersWithCompany,
  getAllEnrolledStudents,
  getAllCompaniesWithCourses,
  getAllNewsletterSubscribers,
};
