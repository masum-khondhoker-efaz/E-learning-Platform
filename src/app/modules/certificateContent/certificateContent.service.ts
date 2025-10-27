import prisma from '../../utils/prisma';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import { 
  calculatePagination, 
  formatPaginationResponse 
} from '../../utils/pagination';

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


const getCertificateContentListFromDb = async (userId: string, options: ISearchAndFilterOptions) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build the complete where clause manually
  const whereQuery: any = {};

  // Add search conditions
  if (options.searchTerm) {
    whereQuery.OR = [
      {
        title: {
          contains: options.searchTerm,
          mode: 'insensitive' as const,
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

  // Date range filter for creation date
  if (options.startDate || options.endDate) {
    whereQuery.createdAt = {};
    if (options.startDate) {
      whereQuery.createdAt.gte = new Date(options.startDate);
    }
    if (options.endDate) {
      whereQuery.createdAt.lte = new Date(options.endDate);
    }
  }

  // Sorting
  const orderBy = {
    [sortBy]: sortOrder,
  };

  // Fetch total count for pagination
  const total = await prisma.certificateContent.count({ where: whereQuery });

  if (total === 0) {
    return formatPaginationResponse([], 0, page, limit);
  }

  // Fetch paginated data
  const certificateContents = await prisma.certificateContent.findMany({
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
        },
      },
      _count: {
        select: {
          Certificate: true,
        },
      },
    },
  });

  // Transform data to include additional fields
  const transformedContents = certificateContents.map(content => ({
    id: content.id,
    courseId: content.courseId,
    courseTitle: content.course?.courseTitle,
    courseLevel: content.course?.courseLevel,
    instructorName: content.course?.instructorName,
    categoryName: content.course?.category?.name,
    title: content.title,
    htmlContents: content.htmlContent,
    placeholders: content.placeholders,
    createdAt: content.createdAt,
    updatedAt: content.updatedAt,
    
    // Creator details
    createdBy: {
      id: content.user?.id,
      fullName: content.user?.fullName,
      email: content.user?.email,
    },
    
    // Usage statistics
    certificatesIssued: content._count.Certificate,
    
    // Template info
    hasPlaceholders: !!(content.placeholders && Object.keys(content.placeholders).length > 0),
    placeholderCount: content.placeholders ? Object.keys(content.placeholders).length : 0,
  }));

  return formatPaginationResponse(transformedContents, total, page, limit);
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
