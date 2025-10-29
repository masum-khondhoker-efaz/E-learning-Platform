import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { certificateContentService } from './certificateContent.service';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';

const createCertificateContent = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await certificateContentService.createCertificateContentIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'CertificateContent created successfully',
    data: result,
  });
});

const getCoursesWithoutCertificateContent = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await certificateContentService.getCoursesWithoutCertificateContentFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Courses without CertificateContent retrieved successfully',
    data: result,
  });
});


const getCertificateContentList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await certificateContentService.getCertificateContentListFromDb(user.id, req.query as ISearchAndFilterOptions);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'CertificateContent list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getCertificateContentById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await certificateContentService.getCertificateContentByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'CertificateContent details retrieved successfully',
    data: result,
  });
});

const updateCertificateContent = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await certificateContentService.updateCertificateContentIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'CertificateContent updated successfully',
    data: result,
  });
});

const deleteCertificateContent = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await certificateContentService.deleteCertificateContentItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'CertificateContent deleted successfully',
    data: result,
  });
});

export const certificateContentController = {
  createCertificateContent,
  getCoursesWithoutCertificateContent,
  getCertificateContentList,
  getCertificateContentById,
  updateCertificateContent,
  deleteCertificateContent,
};