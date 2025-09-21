import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { certificateService } from './certificate.service';

// certificate.controller.ts
const issueCertificate = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await certificateService.issueCertificate(user.id, req.body.courseId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Certificate issued successfully',
    data: result,
  });
});

const checkCompletion = catchAsync(async (req, res) => {
  const user = req.user as any;
  const courseId = req.params.id;
  const result =
    await certificateService.checkCourseCompletionAndIssueCertificate(
      user.id,
      courseId,
    );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Course completion status checked',
    data: result,
  });
});

const getCertificates = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await certificateService.getAllCertificatesFromDb(user.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'All certificates retrieved successfully',
    data: result,
  });
});

const getACertificate = catchAsync(async (req, res) => {
  const user = req.user as any;
  const certificateId = req.params.id;
  console.log(certificateId, 'certificateId');
  const result = await certificateService.getCertificateByIdForAdmin(
    certificateId,
    user.id,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Certificate details retrieved successfully',
    data: result,
  });
});

const getMyCertificates = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await certificateService.getUserCertificates(user.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Certificates retrieved successfully',
    data: result,
  });
});

const getCertificate = catchAsync(async (req, res) => {
  const user = req.user as any;
  const certificateId = req.params.id;
  const result = await certificateService.getCertificateById(
    certificateId,
    user.id,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Certificate retrieved successfully',
    data: result,
  });
});

const verifyCertificate = catchAsync(async (req, res) => {
  const certificateId = req.params.id;
  const result = await certificateService.verifyCertificate(certificateId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Certificate verified successfully',
    data: result,
  });
});

export const certificateController = {
  issueCertificate,
  checkCompletion,
  getCertificates,
  getACertificate,
  getMyCertificates,
  getCertificate,
  verifyCertificate,
};
