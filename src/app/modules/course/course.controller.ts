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

  const { files, body } = req;

  // Container for uploads
  const uploads: {
    thumbnail?: string;
    instructorImage?: string;
    lessons: Record<string, string>; // tempKey → uploaded URL
  } = { lessons: {} };

  const allFiles = req.files as Express.Multer.File[];

  // Find thumbnail
  const thumbnailFile = allFiles.find(f => f.fieldname === 'thumbnail');
  if (thumbnailFile) {
    const thumbnailUrl = await uploadFileToSpace(
      thumbnailFile,
      'courses/thumbnails',
    );
    body.courseThumbnail = thumbnailUrl;
  }

  // Find instructor image
  const instructorFile = allFiles.find(f => f.fieldname === 'instructorImage');
  if (instructorFile) {
    const instructorImageUrl = await uploadFileToSpace(
      instructorFile,
      'courses/instructors',
    );
    body.instructorImage = instructorImageUrl;
  }

  // Lessons (dynamic)
  const lessonFiles = allFiles.filter(f => f.fieldname.startsWith('lesson'));
  for (const file of lessonFiles) {
    const uploadedUrl = await uploadFileToSpace(file, 'courses/lessons');
    uploads.lessons[file.fieldname] = uploadedUrl;
  }

  // Upload lessons dynamically (lesson1, lesson2, etc.)
  // (This block is redundant and can be removed since lesson files are already handled above)

  // Merge uploads into body
  if (uploads.thumbnail) body.courseThumbnail = uploads.thumbnail;
  if (uploads.instructorImage) body.instructorImage = uploads.instructorImage;

  // Map lessons back into sections
  if (body.sections && Array.isArray(body.sections)) {
    body.sections.forEach((section: any, sIndex: number) => {
      if (section.lessons && Array.isArray(section.lessons)) {
        section.lessons.forEach((lesson: any) => {
          if (lesson.tempKey && uploads.lessons[lesson.tempKey]) {
            lesson.content = uploads.lessons[lesson.tempKey];
            delete lesson.tempKey; // cleanup
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

const getCourseList = catchAsync(async (req, res) => {
  const user = req.user as any;
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

  const result = await courseService.getCourseListFromDb(user.id, filters);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Course list retrieved successfully',
    data: result,
  });
});

const getCourseById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await courseService.getCourseByIdFromDb(
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

const updateCourse = catchAsync(async (req, res) => {
  const user = req.user as any;
  const { id } = req.params;
  
  // Get the parsed JSON data from bodyData
  let bodyData;
  try {
    bodyData = req.body.bodyData ? JSON.parse(req.body.bodyData) : req.body;
  } catch (error) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid JSON format in bodyData');
  }

  // Get files from req.files (processed by multer)
  const allFiles = req.files as Express.Multer.File[];

  // Container for uploads
  const uploads: {
    thumbnail?: string;
    instructorImage?: string;
    lessons: Record<string, string>;
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
    const thumbnailUrl = await uploadFileToSpace(thumbnailFile, 'courses/thumbnails');
    bodyData.courseThumbnail = thumbnailUrl;
  }

  // Handle instructor image
  const instructorFile = allFiles.find(f => f.fieldname === 'instructorImage');
  if (instructorFile) {
    if (existingCourse.instructorImage) {
      await deleteFileFromSpace(existingCourse.instructorImage);
    }
    const instructorImageUrl = await uploadFileToSpace(instructorFile, 'courses/instructors');
    bodyData.instructorImage = instructorImageUrl;
  }

  // Handle lesson files
  const lessonFiles = allFiles.filter(f => f.fieldname.startsWith('lesson'));
  console.log('Lesson files found:', lessonFiles.map(f => ({ fieldname: f.fieldname, originalname: f.originalname })));

  for (const file of lessonFiles) {
    const uploadedUrl = await uploadFileToSpace(file, 'courses/lessons');
    console.log(`Uploaded ${file.fieldname} to: ${uploadedUrl}`);
    uploads.lessons[file.fieldname] = uploadedUrl;
  }

  console.log('Uploads mapping:', uploads.lessons);

  // Map lessons back into sections
  if (bodyData.sections && Array.isArray(bodyData.sections)) {
    bodyData.sections.forEach((section: any) => {
      if (section.lessons && Array.isArray(section.lessons)) {
        section.lessons.forEach((lesson: any) => {
          console.log(`Processing lesson: ${lesson.title}, tempKey: ${lesson.tempKey}`);
          if (lesson.tempKey && uploads.lessons[lesson.tempKey]) {
            console.log(`Setting content for ${lesson.tempKey}`);
            lesson.content = uploads.lessons[lesson.tempKey];
            delete lesson.tempKey;
          }
        });
      }
    });
  }

  // Debug final body
  console.log('Final body before service:', JSON.stringify(bodyData, null, 2));

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
  const result = await courseService.deleteCourseItemFromDb(
    user.id,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Course deleted successfully',
    data: result,
  });
});

export const courseController = {
  createCourse,
  getCourseList,
  getCourseById,
  updateCourse,
  deleteCourse,
};
