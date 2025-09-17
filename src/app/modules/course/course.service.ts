import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { deleteFileFromSpace } from '../../utils/deleteImage';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import {
  calculatePagination,
  formatPaginationResponse,
  getPaginationQuery,
} from '../../utils/pagination';
import {
  buildFilterQuery,
  buildNumericRangeQuery,
  buildSearchQuery,
  combineQueries,
} from '../../utils/searchFilter';

const createCourseIntoDb = async (userId: string, data: any) => {
  return await prisma.$transaction(async tx => {
    const existingCourse = await prisma.course.findMany({
      where: {
        OR: [
          { courseTitle: data.courseTitle },
          { courseShortDescription: data.courseShortDescription },
          { courseDescription: data.courseDescription },
        ],
      },
    });
    if (existingCourse.length > 0) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Course with similar title or description already exists',
      );
    }

    // Step 1: Create course
    const course = await tx.course.create({
      data: {
        userId: userId,
        courseTitle: data.courseTitle,
        courseShortDescription: data.courseShortDescription,
        courseDescription: data.courseDescription,
        courseLevel: data.courseLevel,
        categoryId: data.categoryId,
        certificate: data.certificate ?? false,
        lifetimeAccess: data.lifetimeAccess ?? false,
        price: data.price,
        discountPrice: data.discountPrice ?? 0,
        instructorName: data.instructorName,
        instructorImage: data.instructorImage,
        instructorDesignation: data.instructorDesignation,
        instructorDescription: data.instructorDescription,
        courseThumbnail: data.courseThumbnail,
        // userId (if your schema actually has this field, since Course currently does not)
        // userId: userId,
      },
    });

    // Step 2: Loop sections and create them
    if (data.sections && Array.isArray(data.sections)) {
      for (let sIndex = 0; sIndex < data.sections.length; sIndex++) {
        const section = data.sections[sIndex];

        const createdSection = await tx.section.create({
          data: {
            courseId: course.id,
            title: section.title,
            order: section.order ?? sIndex + 1,
          },
        });

        // Step 3: Loop lessons for this section
        if (section.lessons && Array.isArray(section.lessons)) {
          for (let lIndex = 0; lIndex < section.lessons.length; lIndex++) {
            const lesson = section.lessons[lIndex];

            await tx.lesson.create({
              data: {
                sectionId: createdSection.id,
                title: lesson.title,
                content: lesson.content, // already mapped to uploaded file URL
                order: lesson.order ?? lIndex + 1,
              },
            });
          }
        }
      }
    }

    // Return full course with nested sections + lessons
    return await tx.course.findUnique({
      where: { id: course.id },
      include: {
        Section: {
          include: {
            Lesson: true,
          },
        },
      },
    });
  });
};

const getCourseListFromDb = async (
  userId: string,
  options: ISearchAndFilterOptions,
) => {
  // Ensure numeric values for price/rating filters
  if (options.priceMin !== undefined) options.priceMin = Number(options.priceMin);
  if (options.priceMax !== undefined) options.priceMax = Number(options.priceMax);
  if (options.discountPriceMin !== undefined) options.discountPriceMin = Number(options.discountPriceMin);
  if (options.discountPriceMax !== undefined) options.discountPriceMax = Number(options.discountPriceMax);
  if (options.rating !== undefined) options.rating = Number(options.rating);
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build search query
  const searchFields = [
    'courseTitle',
    'courseShortDescription',
    'courseDescription',
    'instructorName',
    'instructorDesignation',
  ];
  const searchQuery = buildSearchQuery({
    searchTerm: options.searchTerm,
    searchFields,
  });

  // Build filter query
  const filterFields: Record<string, any> = {
  ...(options.courseLevel && { courseLevel: options.courseLevel }),
  ...(options.categoryName && { category: { name: options.categoryName } }),
  ...(options.certificate !== undefined && { certificate: options.certificate }),
  ...(options.lifetimeAccess !== undefined && { lifetimeAccess: options.lifetimeAccess }),
  ...(options.instructorName && { instructorName: options.instructorName }),
  ...(options.instructorDesignation && { instructorDesignation: options.instructorDesignation }),
  ...(options.rating !== undefined && { rating: Number(options.rating) }),
  ...(options.priceMin !== undefined && { price: { gte: Number(options.priceMin) } }),
  ...(options.priceMax !== undefined && { price: { lte: Number(options.priceMax) } }),
  ...(options.discountPriceMin !== undefined && { discountPrice: { gte: Number(options.discountPriceMin) } }),
  ...(options.discountPriceMax !== undefined && { discountPrice: { lte: Number(options.discountPriceMax) } }),
};
  const filterQuery = buildFilterQuery(filterFields);

  // Numeric range filters
  const priceQuery = buildNumericRangeQuery(
    'price',
    options.priceMin,
    options.priceMax,
  );
  const discountPriceQuery = buildNumericRangeQuery(
    'discountPrice',
    options.discountPriceMin,
    options.discountPriceMax,
  );

  // Combine all queries
  const whereQuery = combineQueries(
    { userId }, // filter by userId if needed
    searchQuery,
    filterQuery,
    priceQuery,
    discountPriceQuery,
  );

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
    include: {
      category: {
        select: {
          name: true,
        },
      },
      Section: {
        include: {
          Lesson: true,
        },
      },
    },
  });

  // Flatten category.name into the course object
  const result = courses.map(course => {
    const { category, ...rest } = course;
    return {
      categoryName: category?.name ?? null,
      ...rest,
    };
  });

  return formatPaginationResponse(result, total, page, limit);
};

const getCourseByIdFromDb = async (userId: string, courseId: string) => {
  const result = await prisma.course.findUnique({
    where: {
      id: courseId,
    },
    include: {
      category: {
        select: {
          name: true,
        },
      },
      Section: {
        include: {
          Lesson: true,
        },
      },
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'course not found');
  }

  // Flatten category.name into the course object
  const { category, ...rest } = result;
  const formattedResult = {
    categoryName: category?.name ?? null,
    ...rest,
  };
  return formattedResult;
};

const updateCourseIntoDb = async (courseId: string, userId: string, data: any) => {
  return await prisma.$transaction(async tx => {
    // Check if course exists and belongs to user
    const existingCourse = await tx.course.findFirst({
      where: {
        id: courseId,
        userId: userId,
      },
      include: {
        Section: {
          include: {
            Lesson: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    if (!existingCourse) {
      throw new AppError(httpStatus.NOT_FOUND, 'Course not found');
    }

    // Check for duplicate course title/description (excluding current course)
    const duplicateCourse = await tx.course.findFirst({
      where: {
        id: { not: courseId },
        OR: [
          { courseTitle: data.courseTitle },
          { courseShortDescription: data.courseShortDescription },
          { courseDescription: data.courseDescription },
        ],
      },
    });

    if (duplicateCourse) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Course with similar title or description already exists',
      );
    }

    // Step 1: Update course basic info
    const updatedCourse = await tx.course.update({
      where: { id: courseId },
      data: {
        ...(data.courseTitle !== undefined && { courseTitle: data.courseTitle }),
        ...(data.courseShortDescription !== undefined && { courseShortDescription: data.courseShortDescription }),
        ...(data.courseDescription !== undefined && { courseDescription: data.courseDescription }),
        ...(data.courseLevel !== undefined && { courseLevel: data.courseLevel }),
        ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
        ...(data.certificate !== undefined && { certificate: data.certificate }),
        ...(data.lifetimeAccess !== undefined && { lifetimeAccess: data.lifetimeAccess }),
        ...(data.price !== undefined && { price: data.price }),
        ...(data.discountPrice !== undefined && { discountPrice: data.discountPrice }),
        ...(data.instructorName !== undefined && { instructorName: data.instructorName }),
        ...(data.instructorImage !== undefined && { instructorImage: data.instructorImage }),
        ...(data.instructorDesignation !== undefined && { instructorDesignation: data.instructorDesignation }),
        ...(data.instructorDescription !== undefined && { instructorDescription: data.instructorDescription }),
        ...(data.courseThumbnail !== undefined && { courseThumbnail: data.courseThumbnail }),
      },
    });

    // Step 2: Handle sections and lessons
    if (data.sections && Array.isArray(data.sections)) {
      const existingSections = existingCourse.Section;
      const existingLessons = existingSections.flatMap(section => section.Lesson);

      // First, update all existing sections to temporary orders to avoid constraint violations
      await Promise.all(existingSections.map((section, index) =>
        tx.section.update({
          where: { id: section.id },
          data: { order: 10000 + index } // Temporary high order values
        })
      ));

      const sectionsToKeep: string[] = [];
      const lessonsToKeep: string[] = [];

      // Process each section from the update data
      for (let sIndex = 0; sIndex < data.sections.length; sIndex++) {
        const sectionData = data.sections[sIndex];
        let sectionId = sectionData.id;

        // Update existing section or create new one
        if (sectionId) {
          // Update existing section
          await tx.section.update({
            where: { id: sectionId },
            data: {
              title: sectionData.title,
              order: sIndex + 1,
            },
          });
          sectionsToKeep.push(sectionId);
        } else {
          // Create new section
          const newSection = await tx.section.create({
            data: {
              courseId: courseId,
              title: sectionData.title,
              order: sIndex + 1,
            },
          });
          sectionId = newSection.id;
          sectionsToKeep.push(sectionId);
        }

        // Process lessons for this section
        if (sectionData.lessons && Array.isArray(sectionData.lessons)) {
          // First, update all existing lessons in this section to temporary orders
          const sectionLessons = existingLessons.filter(l => l.sectionId === sectionId);
          await Promise.all(sectionLessons.map((lesson, index) =>
            tx.lesson.update({
              where: { id: lesson.id },
              data: { order: 10000 + index }
            })
          ));

          for (let lIndex = 0; lIndex < sectionData.lessons.length; lIndex++) {
            const lessonData = sectionData.lessons[lIndex];
            let lessonId = lessonData.id;

            if (lessonId) {
              // Update existing lesson - check if content changed and delete old file
              const existingLesson = existingLessons.find(l => l.id === lessonId);
              if (existingLesson && lessonData.content !== existingLesson.content) {
                // Content changed, delete old file
                await deleteFileFromSpace(existingLesson.content);
              }

              await tx.lesson.update({
                where: { id: lessonId },
                data: {
                  title: lessonData.title,
                  content: lessonData.content,
                  order: lIndex + 1,
                },
              });
              lessonsToKeep.push(lessonId);
            } else {
              // Create new lesson
              await tx.lesson.create({
                data: {
                  sectionId: sectionId,
                  title: lessonData.title,
                  content: lessonData.content,
                  order: lIndex + 1,
                },
              });
            }
          }

          // Delete lessons that were removed from this section
          const lessonsToDelete = existingLessons.filter(lesson =>
            lesson.sectionId === sectionId && !lessonsToKeep.includes(lesson.id)
          );

          for (const lesson of lessonsToDelete) {
            if (lesson.content) {
              await deleteFileFromSpace(lesson.content);
            }
            await tx.lesson.delete({
              where: { id: lesson.id }
            });
          }
        }
      }

      // Delete sections that are no longer present
      const sectionsToDelete = existingSections.filter(section => !sectionsToKeep.includes(section.id));

      for (const section of sectionsToDelete) {
        // Delete all lessons in the section first
        const sectionLessons = existingLessons.filter(l => l.sectionId === section.id);
        for (const lesson of sectionLessons) {
          if (lesson.content) {
            await deleteFileFromSpace(lesson.content);
          }
        }
        
        await tx.lesson.deleteMany({
          where: { sectionId: section.id }
        });

        await tx.section.delete({
          where: { id: section.id }
        });
      }
    }

    // Return the updated course with all relations
    return await tx.course.findUnique({
      where: { id: courseId },
      include: {
        Section: {
          include: {
            Lesson: {
              orderBy: {
                order: 'asc',
              },
            },
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });
  });
};

// Helper function to get course by ID
const getCourseById = async (courseId: string) => {
  return await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      Section: {
        include: {
          Lesson: true,
        },
        orderBy: {
          order: 'asc',
        },
      },
    },
  });
};



const deleteCourseItemFromDb = async (userId: string, courseId: string) => {

  // delete associated files first
  const course = await prisma.course.findFirst({
    where: {
      id: courseId,
      // userId: userId,
    },
    include: {
      Section: {
        include: {
          Lesson: true,
        },
      },
    },
  });

  if (!course) {
    throw new AppError(httpStatus.NOT_FOUND, 'Course not found');
  }

  // Delete lesson content files
  for (const section of course.Section) {
    for (const lesson of section.Lesson) {
      if (lesson.content) {
        await deleteFileFromSpace(lesson.content);
      }
    }
  }

  // Delete course thumbnail
  if (course.courseThumbnail) {
    await deleteFileFromSpace(course.courseThumbnail);
  }

  // Now delete the course record (this will cascade to sections and lessons if set up in Prisma schema)    

  const deletedItem = await prisma.course.delete({
    where: {
      id: courseId,
    },
    include: {
      Section: {
        include: {
          Lesson: true,
        },
      },
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'courseId, not deleted');
  }

  return deletedItem;
};

export const courseService = {
  createCourseIntoDb,
  getCourseListFromDb,
  getCourseByIdFromDb,
  updateCourseIntoDb,
  getCourseById,
  deleteCourseItemFromDb,
};
