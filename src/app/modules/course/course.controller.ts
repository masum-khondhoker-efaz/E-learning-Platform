import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { courseService } from './course.service';
import { uploadFileToSpace } from '../../utils/multipleFile';

const createCourse = catchAsync(async (req, res) => {
  const user = req.user as any;

  // Parse JSON data from body
  const parsedData = JSON.parse(req.body.data);

  // Upload thumbnail if provided
  if (req.files && 'thumbnail' in req.files) {
    const thumbnailFile = (req.files as any).thumbnail[0];
    const thumbnailUrl = await uploadFileToSpace(thumbnailFile, 'courses/thumbnails');
    parsedData.courseThumbnail = thumbnailUrl;
  }

  // Upload lessons dynamically and map them into sections
  if (parsedData.sections && Array.isArray(parsedData.sections)) {
    for (let sIndex = 0; sIndex < parsedData.sections.length; sIndex++) {
      const section = parsedData.sections[sIndex];

      if (section.lessons && Array.isArray(section.lessons)) {
        for (let lIndex = 0; lIndex < section.lessons.length; lIndex++) {
          const lesson = section.lessons[lIndex];

          // tempKey = fieldName for lesson file upload (e.g., lesson1, lesson2...)
          if (lesson.tempKey && req.files && lesson.tempKey in req.files) {
            const file = (req.files as any)[lesson.tempKey][0];

            // Upload to Spaces
            const uploadedUrl = await uploadFileToSpace(
              file,
              `courses/section-${sIndex + 1}-lesson-${lIndex + 1}`,
            );

            // Replace tempKey with actual URL
            lesson.content = uploadedUrl;

            // Optionally remove tempKey after mapping
            delete lesson.tempKey;
          }
        }
      }
    }
  }

  // Save course to DB
  const result = await courseService.createCourseIntoDb(user.id, parsedData);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Course created successfully',
    data: result,
  });
});

const getCourseList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await courseService.getCourseListFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Course list retrieved successfully',
    data: result,
  });
});

const getCourseById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await courseService.getCourseByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Course details retrieved successfully',
    data: result,
  });
});

const updateCourse = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await courseService.updateCourseIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Course updated successfully',
    data: result,
  });
});

const deleteCourse = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await courseService.deleteCourseItemFromDb(user.id, req.params.id);
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