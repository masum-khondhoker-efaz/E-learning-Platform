import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

const createCertificateContentIntoDb = async (userId: string, data: any) => {
  // check course exists
  const course = await prisma.course.findUnique({
    where: { id: data.courseId },
  });
  if (!course) {
    throw new AppError(httpStatus.NOT_FOUND, 'Course not found');
  }

  // check any existing certificate for this course
  const existingCertificate = await prisma.certificateContent.findUnique({
    where: { courseId: data.courseId },
  });
  if (existingCertificate) {
    throw new AppError(
      httpStatus.CONFLICT,
      'Certificate template already exists for this course',
    );
  }

  // create certificate template
  const certificateTemplate = await prisma.certificateContent.create({
    data: {
      userId: userId,
      courseId: data.courseId,
      title: data.title,
      htmlContent: data.htmlContent,
      placeholders: data.placeholders,
    },
  });
  if (!certificateTemplate) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Failed to create certificate template',
    );
  }

  // update the certificate model with certificateContentId
  // await prisma.certificate.update({
  //   where: { courseId: data.courseId, certificateContentId: null },
  //   data: { certificateContentId: certificateTemplate.id },
  // });

  return certificateTemplate;
};

const getCertificateContentListFromDb = async (userId: string) => {
  const result = await prisma.certificateContent.findMany({
    include: {
      course: {
        select: { id: true, courseTitle: true },
      },
    },
  });
  if (result.length === 0) {
    return { message: 'No certificateContent found' };
  }

  // format the result to include courseTitle directly
  const formattedResult = result.map((item) => ({
    id: item.id,
    courseId: item.courseId,
    courseTitle: item.course.courseTitle,
    title: item.title,
    // htmlContent: item.htmlContent,
    // placeholders: item.placeholders,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));

  return formattedResult;
};

const getCertificateContentByIdFromDb = async (
  userId: string,
  certificateContentId: string,
) => {
  const result = await prisma.certificateContent.findUnique({
    where: {
      id: certificateContentId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'certificateContent not found');
  }
  return result;
};

const updateCertificateContentIntoDb = async (
  userId: string,
  certificateContentId: string,
  data: any,
) => {
  const result = await prisma.certificateContent.update({
    where: {
      id: certificateContentId,
      // userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'certificateContentId, not updated',
    );
  }
  return result;
};

const deleteCertificateContentItemFromDb = async (
  userId: string,
  certificateContentId: string,
) => {
  
  // find existing certificateContent
  const existingItem = await prisma.certificateContent.findUnique({
    where: {
      id: certificateContentId,
      // userId: userId,
    },
  });
  if (!existingItem) {
    throw new AppError(httpStatus.NOT_FOUND, 'certificateContent not found');
  }

  // delete certificateContent
  const deletedItem = await prisma.certificateContent.delete({
    where: {
      id: certificateContentId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'certificateContentId, not deleted',
    );
  }

  return deletedItem;
};

export const certificateContentService = {
  createCertificateContentIntoDb,
  getCertificateContentListFromDb,
  getCertificateContentByIdFromDb,
  updateCertificateContentIntoDb,
  deleteCertificateContentItemFromDb,
};
