import {
  ObjectCannedACL,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import os from 'os';
import config from '../../config';
import multer from 'multer';
// Function to upload a file to DigitalOcean Space
import ffmpeg from 'fluent-ffmpeg';
import ffprobeStatic from 'ffprobe-static';

// Ensure fluent-ffmpeg knows where ffprobe is located (uses ffprobe-static)
ffmpeg.setFfprobePath(ffprobeStatic.path);

// Configure DigitalOcean Spaces
// const s3 = new S3Client({
//   region: 'nyc3',
//   endpoint: config.s3.do_space_endpoint,
//   credentials: {
//     accessKeyId: config.s3.do_space_accesskey || '', // Ensure this is never undefined
//     secretAccessKey: config.s3.do_space_secret_key || '', // Ensure this is never undefined
//   },
// });

// const getVideoMetadata = async (fileBuffer: Buffer): Promise<{ duration: number }> => {
//   const tmpDir = os.tmpdir();
//   const tmpPath = path.join(
//     tmpDir,
//     `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.tmp`
//   );

//   // Write buffer to a temp file so ffprobe can inspect it reliably
//   // Convert Buffer to Uint8Array to satisfy the fs.promises.writeFile type signature
//   await fs.promises.writeFile(tmpPath, new Uint8Array(fileBuffer));

//   try {
//     // Wrap ffprobe in a Promise because fluent-ffmpeg uses a callback
//     const ffprobePromise = (filePath: string) =>
//       new Promise<any>((resolve, reject) => {
//         (ffmpeg as any).ffprobe(filePath, (err: any, data: any) => {
//           if (err) return reject(err);
//           resolve(data);
//         });
//       });

//     const metadata: any = await ffprobePromise(tmpPath);
//     const duration = metadata && metadata.format && metadata.format.duration
//       ? Number(metadata.format.duration)
//       : 0;
//     console.log(`Probed video duration: ${duration} seconds`);
//     return { duration };
//   } finally {
//     // Clean up temp file (ignore errors)
//     fs.promises.unlink(tmpPath).catch(() => {});
//   }
// };

// export const uploadFileToSpace = async (
//   file: Express.Multer.File,
//   folder: string,
// ) => {
//   if (!process.env.DO_SPACE_BUCKET) {
//     throw new Error('DO_SPACE_BUCKET is not defined in the environment variables.');
//   }

//   const key = `${folder}/${Date.now()}_${file.originalname}`;

//   const params = {
//     Bucket: process.env.DO_SPACE_BUCKET,
//     Key: key,
//     Body: file.buffer,
//     ContentType: file.mimetype,
//     ACL: 'public-read' as ObjectCannedACL,
//   };

//   try {
//     await s3.send(new PutObjectCommand(params));

//     const url = `https://${config.s3.do_space_bucket}.${(config.s3.do_space_endpoint || 'nyc3.digitaloceanspaces.com').replace('https://', '')}/${key}`;

//     let videoDuration: number | null = null;

//     // Only probe video files
//     if (file.mimetype.startsWith('video')) {
//       try {
//         const metadata = await getVideoMetadata(file.buffer);
//         videoDuration = metadata.duration;
//       } catch (err) {
//         console.error('Error getting video metadata:', err);
//       }
//     }

//     return {
//       url,
//       contentType: file.mimetype,
//       videoDuration,
//     };
//   } catch (error) {
//     console.error('Error uploading file:', error);
//     throw error;
//   }
// };

export const aws = new S3Client({
  region: config.aws.aws_region,
  credentials: {
    accessKeyId: config.aws.aws_access_key_id || '',
    secretAccessKey: config.aws.aws_secret_access_key || '',
  },
});

ffmpeg.setFfprobePath(ffprobeStatic.path);

const getVideoMetadata = async (fileBuffer: Buffer): Promise<{ duration: number }> => {
  const tmpDir = os.tmpdir();
  const tmpPath = path.join(
    tmpDir,
    `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.tmp`
  );

  // Write buffer to a temp file so ffprobe can inspect it reliably
  // Convert Buffer to Uint8Array to satisfy the fs.promises.writeFile type signature
  await fs.promises.writeFile(tmpPath, new Uint8Array(fileBuffer));

  try {
    // Wrap ffprobe in a Promise because fluent-ffmpeg uses a callback
    const ffprobePromise = (filePath: string) =>
      new Promise<any>((resolve, reject) => {
        (ffmpeg as any).ffprobe(filePath, (err: any, data: any) => {
          if (err) return reject(err);
          resolve(data);
        });
      });

    const metadata: any = await ffprobePromise(tmpPath);
    const duration = metadata && metadata.format && metadata.format.duration
      ? Number(metadata.format.duration)
      : 0;
    console.log(`Probed video duration: ${duration} seconds`);
    return { duration };
  } finally {
    // Clean up temp file (ignore errors)
    fs.promises.unlink(tmpPath).catch(() => {});
  }
};

export const uploadFileToS3 = async (
  file: Express.Multer.File,
  folder: string,
) => {
  if (!process.env.AWS_S3_BUCKET) {
    throw new Error('AWS_S3_BUCKET is not defined in environment variables.');
  }

  const key = `${folder}/${Date.now()}_${file.originalname}`;

  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
    ACL: 'public-read' as ObjectCannedACL,
  };

  try {
    await aws.send(new PutObjectCommand(params));

    const url = `https://${process.env.AWS_S3_BUCKET}.s3.${config.aws.aws_region}.amazonaws.com/${key}`;

    let videoDuration: number | null = null;

    // Only probe video files
    if (file.mimetype.startsWith('video')) {
      try {
        const metadata = await getVideoMetadata(file.buffer);
        videoDuration = metadata.duration;
      } catch (err) {
        console.error('Error getting video metadata:', err);
      }
    }

    return {
      url,
      contentType: file.mimetype,
      videoDuration,
    };
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};

//upload utilities function multer.ts file import multer from "multer";
const multerUploadMultiple = multer({
  storage: multer.memoryStorage(), // Store file in memory (buffer)
  limits: {
    fileSize: 25 * 1024 * 1024, // Optional: limit file size (5MB in this example)
  },
});

export { multerUploadMultiple };
