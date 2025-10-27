import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { courseService } from './course.service';
import { uploadFileToSpace } from '../../utils/multipleFile';
import { deleteFileFromSpace } from '../../utils/deleteImage';
import { pickValidFields } from '../../utils/pickValidFields';
import AppError from '../../errors/AppError';


const createCourse = catchAsync(async (req, res) => {
  const user = req.user as any;
  const { body } = req;

  // Container for uploads
  const uploads: {
    thumbnail?: string;
    instructorImage?: string;
    lessons: Record<string, { url: string; contentType?: string; videoDuration?: number | null }>;
  } = { lessons: {} };

  const allFiles = req.files as Express.Multer.File[];

  // Find thumbnail
  const thumbnailFile = allFiles.find(f => f.fieldname === 'courseThumbnail');
  if (thumbnailFile) {
    const { url } = await uploadFileToSpace(thumbnailFile, 'courses/thumbnails');
    body.courseThumbnail = url;
  }

  // Find instructor image
  const instructorFile = allFiles.find(f => f.fieldname === 'instructorImage');
  if (instructorFile) {
    const { url } = await uploadFileToSpace(instructorFile, 'courses/instructors');
    body.instructorImage = url;
  }

  // Lessons (dynamic)
  const lessonFiles = allFiles.filter(f => f.fieldname.startsWith('lesson'));
  for (const file of lessonFiles) {
    const { url, contentType, videoDuration } = await uploadFileToSpace(file, 'courses/lessons');
    uploads.lessons[file.fieldname] = { url, contentType, videoDuration };
  }

  // Map lessons back into sections
  if (body.sections && Array.isArray(body.sections)) {
    body.sections.forEach((section: any) => {
      if (section.lessons && Array.isArray(section.lessons)) {
        section.lessons.forEach((lesson: any) => {
          if (lesson.tempKey && uploads.lessons[lesson.tempKey]) {
            const uploaded = uploads.lessons[lesson.tempKey];
            lesson.content = uploaded.url;
            lesson.videoDuration = uploaded.videoDuration ?? null;
            lesson.contentType = uploaded.contentType ?? null;
            delete lesson.tempKey;
          }
        });
      }
    });
  }

  // Save course
  const result = await courseService.createCourseIntoDb(user.id, body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Course created successfully',
    data: result,
  });
});

const getPopularCourses = catchAsync(async (req, res) => {
  const result = await courseService.getPopularCoursesFromDb();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Popular courses retrieved successfully',
    data: result,
  });
});

const getACourseById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await courseService.getACourseByIdFromDb(
    user.id,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Course details retrieved successfully',
    data: result,
  });
});

const getCourseList = catchAsync(async (req, res) => {
  // const user = req.user as any;
  const filters = pickValidFields(req.query, [
    'page',
    'limit',
    'sortBy',
    'sortOrder',
    'searchTerm',
    'categoryName',
    'courseLevel',
    'priceMin',
    'priceMax',
    'rating',
    'instructorName',
    'instructorDesignation',
    'certificate',
    'lifetimeAccess',
    'courseTitle',
    'courseShortDescription',
    'courseDescription',
    'discountPriceMin',
    'discountPriceMax',
  ]);

  const result = await courseService.getCourseListFromDb( filters);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Course list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getCourseById = catchAsync(async (req, res) => {
  // const user = req.user as any;
  const result = await courseService.getCourseByIdFromDb(
    // user.id,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Course details retrieved successfully',
    data: result,
  });
});


const updateCourse = catchAsync(async (req, res) => {
  const user = req.user as any;
  const { id } = req.params;

  // Parse JSON bodyData safely
  let bodyData;
  try {
    bodyData = req.body.bodyData ? JSON.parse(req.body.bodyData) : req.body;
  } catch (error) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid JSON format in bodyData');
  }

  // Get files from req.files
  const allFiles = req.files as Express.Multer.File[];

  // Container for uploads
  const uploads: {
    thumbnail?: string;
    instructorImage?: string;
    lessons: Record<string, { url: string; contentType?: string; videoDuration?: number | null }>;
  } = { lessons: {} };

  // Get existing course
  const existingCourse = await courseService.getCourseById(id);
  if (!existingCourse) {
    throw new AppError(httpStatus.NOT_FOUND, 'Course not found');
  }

  // Handle thumbnail
  const thumbnailFile = allFiles.find(f => f.fieldname === 'thumbnail');
  if (thumbnailFile) {
    if (existingCourse.courseThumbnail) {
      await deleteFileFromSpace(existingCourse.courseThumbnail);
    }
    const { url } = await uploadFileToSpace(thumbnailFile, 'courses/thumbnails');
    bodyData.courseThumbnail = url;
  }

  // Handle instructor image
  const instructorFile = allFiles.find(f => f.fieldname === 'instructorImage');
  if (instructorFile) {
    if (existingCourse.instructorImage) {
      await deleteFileFromSpace(existingCourse.instructorImage);
    }
    const { url } = await uploadFileToSpace(instructorFile, 'courses/instructors');
    bodyData.instructorImage = url;
  }

  // Handle lesson files
  const lessonFiles = allFiles.filter(f => f.fieldname.startsWith('lesson'));
  for (const file of lessonFiles) {
    const { url, contentType, videoDuration } = await uploadFileToSpace(file, 'courses/lessons');
    uploads.lessons[file.fieldname] = { url, contentType, videoDuration };
  }

  // Map lessons back into sections
  if (bodyData.sections && Array.isArray(bodyData.sections)) {
    bodyData.sections.forEach((section: any) => {
      if (section.lessons && Array.isArray(section.lessons)) {
        section.lessons.forEach((lesson: any) => {
          if (lesson.tempKey && uploads.lessons[lesson.tempKey]) {
            const uploaded = uploads.lessons[lesson.tempKey];
            lesson.content = uploaded.url;
            lesson.videoDuration = uploaded.videoDuration ?? null;
            lesson.contentType = uploaded.contentType ?? null;
            delete lesson.tempKey;
          }
        });
      }
    });
  }

  // Update course
  const result = await courseService.updateCourseIntoDb(id, user.id, bodyData);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Course updated successfully',
    data: result,
  });
});


const deleteCourse = catchAsync(async (req, res) => {
  const user = req.user as any;
  const courseId = req.params.id;

  const result = await courseService.deleteCourseItemFromDb(user.id, courseId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Course deleted successfully',
    data: result,
  });
});


export const courseController = {
  createCourse,
  getPopularCourses,
  getACourseById,
  getCourseList,
  getCourseById,
  updateCourse,
  deleteCourse,
};
