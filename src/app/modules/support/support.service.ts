import prisma from '../../utils/prisma';
import { SupportStatus, UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import emailSender from '../../utils/emailSender';
import { calculatePagination, formatPaginationResponse, getPaginationQuery } from '../../utils/pagination';
import { buildFilterQuery, buildSearchQuery, combineQueries } from '../../utils/searchFilter';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';

const createSupportIntoDb = async (data: any) => {
  const result = await prisma.support.create({
    data: {
      ...data,
      status: SupportStatus.OPEN,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'support not created');
  }
  return result;
};

const getSupportListFromDb = async (userId: string, options: ISearchAndFilterOptions) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build search query
  const searchFields = [
    'subject',
    'message',
    'userEmail',
    'userName',
  ];
  const searchQuery = buildSearchQuery({
    searchTerm: options.searchTerm,
    searchFields,
  });

  // Build filter query
  const filterFields: Record<string, any> = {
    ...(options.status && { status: options.status }),
    // Add any other support-specific filters here
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
  const total = await prisma.support.count({ where: whereQuery });

  if (total === 0) {
    return formatPaginationResponse([], 0, page, limit);
  }
  // Fetch paginated data
  const supports = await prisma.support.findMany({
    where: whereQuery,
    skip,
    take: limit,
    orderBy,
    include: {
      Reply: {
        select: {
          id: true,
          message: true,
          status: true,
          createdAt: true,
        },
      },
    },
  });

  return formatPaginationResponse(supports, total, page, limit);
};


const getSupportByIdFromDb = async (userId: string, supportId: string) => {
  const result = await prisma.support.findUnique({
    where: {
      id: supportId,
    },
    include: {
      Reply: {
        select: {
          id: true,
          message: true,
          status: true,
          createdAt: true,
      },
    }
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'support not found');
  }

  const updateStatus = await prisma.support.update({
    where: {
      id: supportId,
    },
    data: {
      status: SupportStatus.IN_PROGRESS,
    },
  });
  if (!updateStatus) {
    throw new AppError(httpStatus.BAD_REQUEST, 'status not updated');
  }

  return result;
};

const updateSupportIntoDb = async (
  userId: string,
  supportId: string,
  data: any,
) => {
  return await prisma.$transaction(async tx => {
    const findExisting = await tx.support.findUnique({
      where: {
        id: supportId,
      },
    });
    if (!findExisting) {
      throw new AppError(httpStatus.NOT_FOUND, 'support not found');
    }

    if (findExisting.status === SupportStatus.CLOSED) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'This ticket is already closed',
      );
    }

    //extract username from email
    const username = findExisting.userEmail?.split('@')[0];

    await emailSender(
      'E-learning - Support',
      findExisting.userEmail!,
      `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <table width="100%" style="border-collapse: collapse;">
        <tr>
          <td style="background-color: #46BEF2; padding: 20px; text-align: center; color: #000000; border-radius: 10px 10px 0 0;">
            <h2 style="margin: 0; font-size: 24px;">Support from Barber Time</h2>
          </td>
        </tr>
        <tr>
          <td style="padding: 20px;">
            <p style="font-size: 16px; margin: 0;">Hello <strong>${
              username
            }</strong>,</p>
            <p style="font-size: 16px;">Your message: ${findExisting.message}</p>
            <div style="text-align: center; margin: 20px 0;">
              <p style="font-size: 18px;" >${data.message}</p>
            </div>
            <p style="font-size: 14px; color: #555;">If you did not request this support, please ignore this email. No further action is needed.</p>
            <p style="font-size: 16px; margin-top: 20px;">Thank you,<br>E-learning</p>
          </td>
        </tr>
        <tr>
          <td style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888; border-radius: 0 0 10px 10px;">
            <p style="margin: 0;">&copy; ${new Date().getFullYear()} E-learning Team. All rights reserved.</p>
          </td>
        </tr>
        </table>
      </div>
        `,
    );

    const result = await tx.support.update({
      where: {
        id: supportId,
      },
      data: {
        status: SupportStatus.CLOSED,
      },
    });
    if (!result) {
      throw new AppError(httpStatus.BAD_REQUEST, 'supportId, not updated');
    }

    const updateReply = await tx.reply.create({
      data: {
        message: data.message,
        userId: userId,
        supportId: supportId,
      },
    });
    if (!updateReply) {
      throw new AppError(httpStatus.BAD_REQUEST, 'reply not created');
    }

    return result;
  });
};

const deleteSupportItemFromDb = async (userId: string, supportId: string) => {
  const deletedItem = await prisma.support.delete({
    where: {
      id: supportId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'supportId, not deleted');
  }

  return deletedItem;
};

export const supportService = {
  createSupportIntoDb,
  getSupportListFromDb,
  getSupportByIdFromDb,
  updateSupportIntoDb,
  deleteSupportItemFromDb,
};
