import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';


const createCourseIntoDb = async (userId: string, data: any) => {
  return await prisma.$transaction(async (tx) => {


    const existingCourse = await prisma.course.findMany({
      where: {
        OR: [
          { courseTitle: data.courseTitle },
          { courseShortDescription: data.courseShortDescription },
          { courseDescription: data.courseDescription },
        ],
      }
    })
    if (existingCourse.length > 0) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Course with similar title or description already exists');
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


const getCourseListFromDb = async (userId: string) => {
  
    const result = await prisma.course.findMany();
    if (result.length === 0) {
    return { message: 'No course found' };
  }
    return result;
};

const getCourseByIdFromDb = async (userId: string, courseId: string) => {
  
    const result = await prisma.course.findUnique({ 
    where: {
      id: courseId,
    }
   });
    if (!result) {
    throw new AppError(httpStatus.NOT_FOUND,'course not found');
  }
    return result;
  };



const updateCourseIntoDb = async (userId: string, courseId: string, data: any) => {
  
    const result = await prisma.course.update({
      where:  {
        id: courseId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'courseId, not updated');
  }
    return result;
  };

const deleteCourseItemFromDb = async (userId: string, courseId: string) => {
    const deletedItem = await prisma.course.delete({
      where: {
      id: courseId,
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
deleteCourseItemFromDb,
};