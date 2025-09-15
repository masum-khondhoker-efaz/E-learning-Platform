import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { courseService } from './course.service';
import { uploadFileToSpace } from '../../utils/multipleFile';

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
const thumbnailFile = allFiles.find(f => f.fieldname === "thumbnail");
if (thumbnailFile) {
  const thumbnailUrl = await uploadFileToSpace(thumbnailFile, "courses/thumbnails");
  body.courseThumbnail = thumbnailUrl;
}

// Find instructor image
const instructorFile = allFiles.find(f => f.fieldname === "instructorImage");
if (instructorFile) {
  const instructorImageUrl = await uploadFileToSpace(instructorFile, "courses/instructors");
  body.instructorImage = instructorImageUrl;
}

// Lessons (dynamic)
const lessonFiles = allFiles.filter(f => f.fieldname.startsWith("lesson"));
for (const file of lessonFiles) {
  const uploadedUrl = await uploadFileToSpace(file, "courses/lessons");
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
    message: "Course created successfully",
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