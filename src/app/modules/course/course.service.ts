import { Review } from './../../../../node_modules/.prisma/client/index.d';
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
                videoDuration: lesson.videoDuration ?? null, // ✅ new
                contentType: lesson.contentType ?? null, // ✅ new
              },
            });
          }
        }
      }
    }

    const totalSections = await tx.section.count({
      where: { courseId: course.id },
    });
    const totalLessons = await tx.lesson.count({
      where: { section: { courseId: course.id } },
    });

    // Calculate total duration in hours
    // Make sure 'duration' exists in your Lesson model as a numeric field
    const lessonAggregate = await tx.lesson.aggregate({
      where: { section: { courseId: course.id } },
      _sum: { videoDuration: true },
    });
    const totalDurationInMinutes = lessonAggregate?._sum?.videoDuration ?? 0;
    const totalDurationInHours = totalDurationInMinutes / 60;

    // Step 4: Update course with totalSections, totalLessons, totalDuration
    await tx.course.update({
      where: { id: course.id },
      data: {
        totalSections,
        totalLessons,
        totalDuration: totalDurationInHours,
      },
    });

    // total lessons and total duration of sections also need to be updated in Section model
    const sections = await tx.section.findMany({
      where: { courseId: course.id },
    });

    for (const section of sections) {
      const sectionLessonCount = await tx.lesson.count({
        where: { sectionId: section.id },
      });

      const sectionLessonAggregate = await tx.lesson.aggregate({
        where: { sectionId: section.id },
        _sum: { videoDuration: true },
      });
      const sectionTotalDurationInMinutes =
        sectionLessonAggregate?._sum?.videoDuration ?? 0;
      const sectionTotalDurationInHours = sectionTotalDurationInMinutes / 60;

      await tx.section.update({
        where: { id: section.id },
        data: {
          totalLessons: sectionLessonCount,
          totalLength: sectionTotalDurationInHours,
        },
      });
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

const getACourseByIdFromDb = async (userId: string, courseId: string) => {

  let isFavoriteCourse = false;
  const checkFavorite = await prisma.favoriteCourse.findFirst({
    where: {
      courseId: courseId,
    },
  });
  if (checkFavorite) {
    isFavoriteCourse = true;
  }


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
          Lesson: {
            select: { title: true, order: true },
            orderBy: { order: 'asc' },
          },
        },
        orderBy: {
          order: 'asc',
        },
      },
      Review: {
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          user: {
            select: { id: true, fullName: true, image: true },
          },
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
    isFavoriteCourse: isFavoriteCourse,
  };
  return formattedResult;
}

const getCourseListFromDb = async (
  // userId: string,
  options: ISearchAndFilterOptions,
) => {
  // Ensure numeric values for price/rating filters
  if (options.priceMin !== undefined)
    options.priceMin = Number(options.priceMin);
  if (options.priceMax !== undefined)
    options.priceMax = Number(options.priceMax);
  if (options.discountPriceMin !== undefined)
    options.discountPriceMin = Number(options.discountPriceMin);
  if (options.discountPriceMax !== undefined)
    options.discountPriceMax = Number(options.discountPriceMax);
  if (options.rating !== undefined) options.rating = Number(options.rating);
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build search query
  const searchFields = [
    'courseTitle',
    'courseShortDescription',
    'courseDescription',
    'instructorName',
    'instructorDesignation',
    'category.name',
  ];
  const searchQuery = buildSearchQuery({
    searchTerm: options.searchTerm,
    searchFields,
  });

  // Build filter query
  const filterFields: Record<string, any> = {
    ...(options.courseLevel && { courseLevel: options.courseLevel }),
    ...(options.categoryName && { category: { name: options.categoryName } }),
    ...(options.certificate !== undefined && {
      certificate: options.certificate,
    }),
    ...(options.lifetimeAccess !== undefined && {
      lifetimeAccess: options.lifetimeAccess,
    }),
    ...(options.instructorName && { instructorName: options.instructorName }),
    ...(options.instructorDesignation && {
      instructorDesignation: options.instructorDesignation,
    }),
    ...(options.rating !== undefined && { avgRating: Number(options.rating) }),
    ...(options.priceMin !== undefined && {
      price: { gte: Number(options.priceMin) },
    }),
    ...(options.priceMax !== undefined && {
      price: { lte: Number(options.priceMax) },
    }),
    ...(options.discountPriceMin !== undefined && {
      discountPrice: { gte: Number(options.discountPriceMin) },
    }),
    ...(options.discountPriceMax !== undefined && {
      discountPrice: { lte: Number(options.discountPriceMax) },
    }),
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

  // Remove ratingQuery if already handled in filterFields
  // const ratingQuery = buildNumericRangeQuery(
  //   'rating',
  //   options.rating,
  //   options.rating,
  // );

  // Combine all queries
  const whereQuery = combineQueries(
    // { userId }, // filter by userId if needed
    searchQuery,
    filterQuery,
    priceQuery,
    discountPriceQuery,
    // ratingQuery, // Remove this line
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
      // Section: {
      //   include: {
      //     Lesson: true,
      //   },
      // },
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

const getCourseByIdFromDb = async (courseId: string) => {
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
          Lesson: {
            select: { title: true, order: true },
            orderBy: { order: 'asc' },
          },
        },
        orderBy: {
          order: 'asc',
        },
      },
      Review: {
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          user: {
            select: { id: true, fullName: true, image: true },
          },
        },
      },
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'course not found');
  }

  // Find similar courses in the same category, excluding the main one
  const similarCourses = await prisma.course.findMany({
    where: {
      categoryId: result.categoryId,
      id: { not: courseId },
    },
    select: {
      id: true,
      courseTitle: true,
      courseShortDescription: true,
      courseThumbnail: true,
      price: true,
      discountPrice: true,
      instructorName: true,
      totalSections: true,
      totalLessons: true,
      totalDuration: true,
      avgRating: true,
      totalRatings: true,
      category: { select: { name: true } },
    },
    take: 5, // limit to 5 similar courses
  });

  // Flatten category.name into the course object
  const { category, ...rest } = result;
  const formattedResult = {
    categoryName: category?.name ?? null,
    ...rest,
    similarCourses,
  };
  return formattedResult;
};

const updateCourseIntoDb = async (
  courseId: string,
  userId: string,
  data: any,
) => {
  return await prisma.$transaction(async tx => {
    // 1. Check if course exists and belongs to user
    const existingCourse = await tx.course.findFirst({
      where: { id: courseId, userId },
      include: {
        Section: {
          include: { Lesson: true },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!existingCourse) {
      throw new AppError(httpStatus.NOT_FOUND, 'Course not found');
    }

    // 2. Check duplicate course title/description
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

    // 3. Update basic course info
    const updatedCourse = await tx.course.update({
      where: { id: courseId },
      data: {
        ...(data.courseTitle !== undefined && { courseTitle: data.courseTitle }),
        ...(data.courseShortDescription !== undefined && {
          courseShortDescription: data.courseShortDescription,
        }),
        ...(data.courseDescription !== undefined && {
          courseDescription: data.courseDescription,
        }),
        ...(data.courseLevel !== undefined && { courseLevel: data.courseLevel }),
        ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
        ...(data.certificate !== undefined && { certificate: data.certificate }),
        ...(data.lifetimeAccess !== undefined && {
          lifetimeAccess: data.lifetimeAccess,
        }),
        ...(data.price !== undefined && { price: data.price }),
        ...(data.discountPrice !== undefined && {
          discountPrice: data.discountPrice,
        }),
        ...(data.instructorName !== undefined && {
          instructorName: data.instructorName,
        }),
        ...(data.instructorImage !== undefined && {
          instructorImage: data.instructorImage,
        }),
        ...(data.instructorDesignation !== undefined && {
          instructorDesignation: data.instructorDesignation,
        }),
        ...(data.instructorDescription !== undefined && {
          instructorDescription: data.instructorDescription,
        }),
        ...(data.courseThumbnail !== undefined && {
          courseThumbnail: data.courseThumbnail,
        }),
        lastUpdated: new Date(),
      },
    });

    // 4. Handle sections & lessons
    let totalLessons = 0;
    let totalDurationSeconds = 0;
    let totalSections = 0;

    if (data.sections && Array.isArray(data.sections)) {
      const existingSections = existingCourse.Section;
      const existingLessons = existingSections.flatMap(s => s.Lesson);

      // Temp reorder to avoid constraint errors
      await Promise.all(
        existingSections.map((section, index) =>
          tx.section.update({
            where: { id: section.id },
            data: { order: 10000 + index },
          }),
        ),
      );

      const sectionsToKeep: string[] = [];
      const lessonsToKeep: string[] = [];

      for (let sIndex = 0; sIndex < data.sections.length; sIndex++) {
        const sectionData = data.sections[sIndex];
        let sectionId = sectionData.id;

        if (sectionId) {
          await tx.section.update({
            where: { id: sectionId },
            data: { title: sectionData.title, order: sIndex + 1 },
          });
          sectionsToKeep.push(sectionId);
        } else {
          const newSection = await tx.section.create({
            data: {
              courseId,
              title: sectionData.title,
              order: sIndex + 1,
            },
          });
          sectionId = newSection.id;
          sectionsToKeep.push(sectionId);
        }

        totalSections++;

        // Lessons in section
        if (sectionData.lessons && Array.isArray(sectionData.lessons)) {
          const sectionLessons = existingLessons.filter(l => l.sectionId === sectionId);

          await Promise.all(
            sectionLessons.map((lesson, index) =>
              tx.lesson.update({
                where: { id: lesson.id },
                data: { order: 10000 + index },
              }),
            ),
          );

          for (let lIndex = 0; lIndex < sectionData.lessons.length; lIndex++) {
            const lessonData = sectionData.lessons[lIndex];
            let lessonId = lessonData.id;

            if (lessonId) {
              const existingLesson = existingLessons.find(l => l.id === lessonId);

              if (existingLesson && lessonData.content !== existingLesson.content) {
                await deleteFileFromSpace(existingLesson.content);
              }

              await tx.lesson.update({
                where: { id: lessonId },
                data: {
                  title: lessonData.title,
                  content: lessonData.content,
                  order: lIndex + 1,
                  videoDuration: lessonData.duration || existingLesson?.videoDuration || 0,
                },
              });
              lessonsToKeep.push(lessonId);
              totalLessons++;
              totalDurationSeconds += lessonData.duration || 0;
            } else {
              const newLesson = await tx.lesson.create({
                data: {
                  sectionId,
                  title: lessonData.title,
                  content: lessonData.content,
                  order: lIndex + 1,
                  videoDuration: lessonData.videoDuration || 0,
                },
              });
              lessonsToKeep.push(newLesson.id);
              totalLessons++;
              totalDurationSeconds += lessonData.duration || 0;
            }
          }

          // Delete removed lessons
          const lessonsToDelete = sectionLessons.filter(
            l => !lessonsToKeep.includes(l.id),
          );
          for (const lesson of lessonsToDelete) {
            if (lesson.content) await deleteFileFromSpace(lesson.content);
            await tx.lesson.delete({ where: { id: lesson.id } });
          }
        }
      }

      // Delete removed sections
      const sectionsToDelete = existingSections.filter(
        s => !sectionsToKeep.includes(s.id),
      );
      for (const section of sectionsToDelete) {
        const sectionLessons = existingLessons.filter(l => l.sectionId === section.id);
        for (const lesson of sectionLessons) {
          if (lesson.content) await deleteFileFromSpace(lesson.content);
        }
        await tx.lesson.deleteMany({ where: { sectionId: section.id } });
        await tx.section.delete({ where: { id: section.id } });
      }
    }

    // 5. Update aggregate stats
    await tx.course.update({
      where: { id: courseId },
      data: {
        totalSections,
        totalLessons,
        totalDuration: totalDurationSeconds / 3600, // store in hours
      },
    });

    // 6. Return updated course
    return await tx.course.findUnique({
      where: { id: courseId },
      include: {
        Section: {
          include: { Lesson: true },
          orderBy: { order: 'asc' },
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
  getACourseByIdFromDb,
  getCourseListFromDb,
  getCourseByIdFromDb,
  updateCourseIntoDb,
  getCourseById,
  deleteCourseItemFromDb,
};
