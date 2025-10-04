import {
  ObjectCannedACL,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import fs from 'fs';
import config from '../../config';
import multer from 'multer';
// Function to upload a file to DigitalOcean Space
import ffmpeg from 'fluent-ffmpeg';
import { promisify } from 'util';
import streamifier from 'streamifier';

// Configure DigitalOcean Spaces
const s3 = new S3Client({
  region: 'nyc3',
  endpoint: config.s3.do_space_endpoint,
  credentials: {
    accessKeyId: config.s3.do_space_accesskey || '', // Ensure this is never undefined
    secretAccessKey: config.s3.do_space_secret_key || '', // Ensure this is never undefined
  },
});

// Wrap ffprobe into a promise
const getVideoMetadata = (fileBuffer: Buffer): Promise<{ duration: number }> => {
  return new Promise((resolve, reject) => {
    const stream = streamifier.createReadStream(fileBuffer);

    ffmpeg(stream)
      .ffprobe((err, metadata) => {
        if (err) return reject(err);

        const duration = metadata.format.duration || 0;
        resolve({ duration });
      });
  });
};

export const uploadFileToSpace = async (
  file: Express.Multer.File,
  folder: string,
) => {
  if (!process.env.DO_SPACE_BUCKET) {
    throw new Error('DO_SPACE_BUCKET is not defined in the environment variables.');
  }

  const key = `${folder}/${Date.now()}_${file.originalname}`;

  const params = {
    Bucket: process.env.DO_SPACE_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
    ACL: 'public-read' as ObjectCannedACL,
  };

  try {
    await s3.send(new PutObjectCommand(params));

    const url = `https://${config.s3.do_space_bucket}.${(config.s3.do_space_endpoint || 'nyc3.digitaloceanspaces.com').replace('https://', '')}/${key}`;

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
    fileSize: 5 * 1024 * 1024, // Optional: limit file size (5MB in this example)
  },
});

export { multerUploadMultiple };
