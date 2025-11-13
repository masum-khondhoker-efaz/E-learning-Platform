import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { courseService } from './course.service';
// import { uploadFileToSpace } from '../../utils/multipleFile';
import { deleteFileFromSpace } from '../../utils/deleteImage';
import { pickValidFields } from '../../utils/pickValidFields';
import AppError from '../../errors/AppError';
import { uploadFileToS3 } from '../../utils/multipleFile';


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
    const { url } = await uploadFileToS3(thumbnailFile, 'courses/thumbnails');
    body.courseThumbnail = url;
  }

  // Find instructor image
  const instructorFile = allFiles.find(f => f.fieldname === 'instructorImage');
  if (instructorFile) {
    const { url } = await uploadFileToS3(instructorFile, 'courses/instructors');
    body.instructorImage = url;
  }

  // Lessons (dynamic)
  const lessonFiles = allFiles.filter(f => f.fieldname.startsWith('lesson'));
  for (const file of lessonFiles) {
    const { url, contentType, videoDuration } = await uploadFileToS3(file, 'courses/lessons');
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

const getCourseByIdForAdmin = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await courseService.getCourseByIdForAdminFromDb(
    user.id,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Course details for admin retrieved successfully',
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
  const thumbnailFile = allFiles.find(f => f.fieldname === 'courseThumbnail');
  if (thumbnailFile) {
    if (existingCourse.courseThumbnail) {
      await deleteFileFromSpace(existingCourse.courseThumbnail);
    }
    const { url } = await uploadFileToS3(thumbnailFile, 'courses/thumbnails');
    bodyData.courseThumbnail = url;
  }

  // Handle instructor image
  const instructorFile = allFiles.find(f => f.fieldname === 'instructorImage');
  if (instructorFile) {
    if (existingCourse.instructorImage) {
      await deleteFileFromSpace(existingCourse.instructorImage);
    }
    const { url } = await uploadFileToS3(instructorFile, 'courses/instructors');
    bodyData.instructorImage = url;
  }

  // Handle lesson files
  const lessonFiles = allFiles.filter(f => f.fieldname.startsWith('lesson'));
  for (const file of lessonFiles) {
    const { url, contentType, videoDuration } = await uploadFileToS3(file, 'courses/lessons');
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

const updateCourseContent = catchAsync(async (req, res) => {
  const user = req.user as any;
  const { id: courseId } = req.params;
const { body } = req;
  // 1️⃣ Parse JSON body safely
  // let bodyData;
  // try {
  //   bodyData = req.body.bodyData ? JSON.parse(req.body.bodyData) : req.body;
  // } catch {
  //   throw new AppError(httpStatus.BAD_REQUEST, 'Invalid JSON format in bodyData');
  // }

  const { sections } = body;
  if (!Array.isArray(sections) || sections.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Sections array is required and cannot be empty');
  }

  // 2️⃣ Handle uploaded files (lessons, tests, etc.)
  const allFiles = (req.files as Express.Multer.File[]) || [];
  const uploads: Record<string, { url: string; contentType?: string; videoDuration?: number | null }> = {};

  if (allFiles.length > 0) {
    for (const file of allFiles) {
      const { url, contentType, videoDuration } = await uploadFileToS3(file, 'courses/lessons');
      uploads[file.fieldname] = { url, contentType, videoDuration };
      console.log(`Uploaded file ${file.fieldname} to ${url}, and contentType: ${contentType} with duration: ${videoDuration}`);
    }
  }

  // 3️⃣ Delegate to service (this will handle DB updates, additions, removals, etc.)
  const result = await courseService.updateCourseContentInDb({
    courseId,
    userId: user.id,
    sections,
    uploads,
  });

  // 4️⃣ Respond to client
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Course content updated successfully',
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
  getCourseByIdForAdmin,
  getACourseById,
  getCourseList,
  getCourseById,
  updateCourse,
  updateCourseContent,
  deleteCourse,
};
