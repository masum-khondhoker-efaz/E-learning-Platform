import { Reply } from './../../../../node_modules/.prisma/client/index.d';
import prisma from '../../utils/prisma';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import emailSender from '../../utils/emailSender';
import {
  ReplyStatus,
  ReplyType,
  SupportStatus,
  SupportType,
} from '@prisma/client';
import {
  calculatePagination,
  formatPaginationResponse,
} from '../../utils/pagination';
import { buildCompleteQuery } from '../../utils/searchFilter';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import { date } from 'zod';

const createSupportRepliesIntoDb = async (userId: string, data: any) => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      fullName: true,
    },
  });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  const result = await prisma.support.create({
    data: {
      ...data,
      userId: userId,
      userName: user?.fullName,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Support Item is not created');
  }
  return result;
};

const getSupportRepliesReportsFromDb = async (
  options: ISearchAndFilterOptions,
) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  const whereClause = buildCompleteQuery(
    {
      searchTerm: options.searchTerm,
      searchFields: ['userName', 'message'],
    },
    {
      type: SupportType.CUSTOMER_COMPLAINT,
      status: options.status,
    },
    {
      startDate: options.startDate,
      endDate: options.endDate,
      dateField: 'createdAt',
    },
  );

  const [reports, total] = await Promise.all([
    prisma.support.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
      select: {
        id: true,
        userId: true,
        userName: true,
        message: true,
        status: true,
        type: true,
        user: {
          select: {
            id: true,
            phoneNumber: true,
            address: true,
          },
        },
      },
    }),
    prisma.support.count({
      where: whereClause,
    }),
  ]);

  // Flatten the user object into each report
  const flattenedReports = reports.map(report => ({
    reportId: report.id,
    userId: report.userId,
    userName: report.userName,
    message: report.message,
    status: report.status,
    type: report.type,
    userPhoneNumber: report.user.phoneNumber,
    userAddress: report.user.address,
  }));
  return formatPaginationResponse(flattenedReports, total, page, limit);
};

const getSupportRepliesListFromDb = async (
  options: ISearchAndFilterOptions,
) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  const whereClause = buildCompleteQuery(
    {
      searchTerm: options.searchTerm,
      searchFields: ['userName', 'message'],
    },
    {
      status: options.status,
      type: SupportType.CUSTOMER_QUESTION,
    },
    {
      startDate: options.startDate,
      endDate: options.endDate,
      dateField: 'createdAt',
    },
  );

  const [supportReplies, total] = await Promise.all([
    prisma.support.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
      select: {
        id: true,
        userId: true,
        userName: true,
        message: true,
        status: true,
        type: true,
        user: {
          select: {
            id: true,
            phoneNumber: true,
            address: true,
          },
        },
      },
    }),
    prisma.support.count({
      where: whereClause,
    }),
  ]);

  const flattenFormattedReplies = supportReplies.map(reply => ({
    supportId: reply.id,
    userId: reply.userId,
    userName: reply.userName,
    message: reply.message,
    status: reply.status,
    type: reply.type,
    userPhoneNumber: reply.user.phoneNumber,
    userAddress: reply.user.address,
  }));

  return formatPaginationResponse(flattenFormattedReplies, total, page, limit);
};

const updateSupportByIdFromDb = async (
  userId: string,
  supportRepliesId: string,
  data: {
    userId: string;
    message: string;
  },
) => {
  return await prisma.$transaction(async tx => {
    const result = await tx.support.update({
      where: {
        id: supportRepliesId,
      },
      data: {
        status: SupportStatus.CLOSED,
      },
    });
    if (!result) {
      throw new AppError(httpStatus.NOT_FOUND, 'Support item is not found');
    }

    const userData = await tx.user.findUnique({
      where: {
        id: data.userId,
      },
      include: {
        Support: {
          where: {
            id: supportRepliesId,
            userId: data.userId,
          },
          select: {
            type: true,
            message: true,
          },
        },
      },
    });
    if (!userData) {
      throw new AppError(httpStatus.NOT_FOUND, 'User not found');
    }

    await emailSender(
      'Barbers Time - Support',
      userData.email!,
      `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
      <table width="100%" style="border-collapse: collapse;">
      <tr>
        <td style="background-color: #E98F5A; padding: 20px; text-align: center; color: #000000; border-radius: 10px 10px 0 0;">
          <h2 style="margin: 0; font-size: 24px;">Support from Barber Time</h2>
        </td>
      </tr>
      <tr>
        <td style="padding: 20px;">
          <p style="font-size: 16px; margin: 0;">Hello <strong>${
            userData.fullName
          }</strong>,</p>
          <p style="font-size: 16px;">Your message: ${result.message}</p>
          <div style="text-align: center; margin: 20px 0;">
            <p style="font-size: 18px;" >${data.message}</p>
          </div>
          <p style="font-size: 14px; color: #555;">If you did not request this support, please ignore this email. No further action is needed.</p>
          <p style="font-size: 16px; margin-top: 20px;">Thank you,<br>Barbers Time</p>
        </td>
      </tr>
      <tr>
        <td style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888; border-radius: 0 0 10px 10px;">
          <p style="margin: 0;">&copy; ${new Date().getFullYear()} Barbers Team. All rights reserved.</p>
        </td>
      </tr>
      </table>
    </div>
      `,
    );

    const existingReply = await tx.reply.findFirst({
      where: {
        supportId: supportRepliesId,
        type: ReplyType.SUPPORT,
      },
    });
    if (existingReply) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Reply already exists');
    }

    const updateReplies = await tx.reply.create({
      data: {
        userId: userId,
        supportId: supportRepliesId,
        status: ReplyStatus.CLOSED,
        type: ReplyType.SUPPORT,
        message: data.message,
      },
    });
    if (!updateReplies) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Reply not created');
    }

    return updateReplies;
  });
};



const updateSupportRepliesIntoDb = async (
  userId: string,
  supportRepliesId: string,
  data: {
    userId: string;
    message: string;
  },
) => {

  const userData = await prisma.user.findUnique({
      where: {
        id: data.userId
      },
    });
    if (!userData) {
      throw new AppError(httpStatus.NOT_FOUND, 'User not found');
    }

  return await prisma.$transaction(async tx => {
    
    const supportData = await tx.support.findUnique({
      where: {
        id: supportRepliesId,
        userId: data.userId,
      },
      select: {
        id: true,
        message: true,
        userId: true,
        userName: true,
        type: true,
      },
    });
    if (!supportData) {
      throw new AppError(httpStatus.NOT_FOUND, 'Support item not found');
    }
    await emailSender(
      'Barbers Time - Support',
      userData.email!,
      `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
      <table width="100%" style="border-collapse: collapse;">
      <tr>
        <td style="background-color: #E98F5A; padding: 20px; text-align: center; color: #000000; border-radius: 10px 10px 0 0;">
          <h2 style="margin: 0; font-size: 24px;">Support From Barber Time</h2>
        </td>
      </tr>
      <tr>
        <td style="padding: 20px;">
          <p style="font-size: 16px; margin: 0;">Hello <strong>${
            userData.fullName
          }</strong>,</p>
          <p style="font-size: 16px;">${supportData.message }.</p>
          <div style="text-align: center; margin: 20px 0;">
            <p style="font-size: 18px;" >${data.message!}</p>
          </div>
          <p style="font-size: 14px; color: #555;">If you did not request this change, please ignore this email. No further action is needed.</p>
          <p style="font-size: 16px; margin-top: 20px;">Thank you,<br>Barbers Time</p>
        </td>
      </tr>
      <tr>
        <td style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888; border-radius: 0 0 10px 10px;">
          <p style="margin: 0;">&copy; ${new Date().getFullYear()} Barbers Time Team. All rights reserved.</p>
        </td>
      </tr>
      </table>
    </div>
      `,
    );
    const result = await tx.support.update({
      where: {
        id: supportRepliesId,
      },
      data: {
        status: SupportStatus.CLOSED,
      },
    });
    if (!result) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Support Item is not updated');
    }

    const reportUpdate = await tx.reply.create({
      data: {
        userId: userId,
        reportId: supportRepliesId,
        message: data.message,
        type: ReplyType.REPORT,
        status: ReplyStatus.CLOSED,
      },
    });
    if (!reportUpdate) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Reply not created');
    }
    return reportUpdate;
  });
};

const getSpecificRepliesByIdFromDb = async (
  userId: string,
  supportRepliesId: string,
) => {
  const result = await prisma.reply.findFirst({
    where: {
      reportId: supportRepliesId,
    },
    select: {
      id: true,
      userId: true,
      supportId: true,
      message: true,
      status: true,
      type: true,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Support item not found');
  }

  return {
    id: result.id,
    supportId: result.supportId,
    userId: result.userId,
    message: result.message,
    status: result.status,
    type: result.type,
  };
};

const getSpecificSupportReplyByIdFromDb = async (
  userId: string,
  supportRepliesId: string,
) => {
  const result = await prisma.reply.findFirst({
    where: {
      supportId: supportRepliesId,
      // userId: userId,
    },
    select: {
      id: true,
      userId: true,
      message: true,
      status: true,
      type: true,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Support item not found');
  }

  return {
    id: result.id,
    userId: result.userId,
    message: result.message,
    status: result.status,
    type: result.type,
  };
};

const deleteSupportRepliesItemFromDb = async (
  userId: string,
  supportRepliesId: string,
) => {
  const deletedItem = await prisma.support.delete({
    where: {
      id: supportRepliesId,
    },
  });
  if (!deletedItem) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'supportRepliesId is not deleted',
    );
  }

  return deletedItem;
};

export const supportRepliesService = {
  createSupportRepliesIntoDb,
  getSupportRepliesListFromDb,
  updateSupportByIdFromDb,
  updateSupportRepliesIntoDb,
  deleteSupportRepliesItemFromDb,
  getSpecificRepliesByIdFromDb,
  getSupportRepliesReportsFromDb,
  getSpecificSupportReplyByIdFromDb,
};
