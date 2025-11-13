import {
  ObjectCannedACL,
  PutObjectCommand,
  S3Client,
  DeleteObjectCommand
} from '@aws-sdk/client-s3';
import config from '../../config';

// AWS S3 Configuration - Remove endpoint and use proper AWS regions
const s3 = new S3Client({
  region: config.aws.aws_region, // Should be like 'us-east-1', 'eu-west-1', etc.
  credentials: {
    accessKeyId: config.aws.aws_access_key_id || '',
    secretAccessKey: config.aws.aws_secret_access_key || '',
  },
});

export const uploadFileToS3 = async (file: Express.Multer.File, folder: string) => {
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
    await s3.send(new PutObjectCommand(params));
    
    // Correct AWS S3 URL format
    const url = `https://${process.env.AWS_S3_BUCKET}.s3.${config.aws.aws_region}.amazonaws.com/${key}`;
    
    return {
      url,
      contentType: file.mimetype,
      videoDuration: null, // Add your video duration logic if needed
    };
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    throw error;
  }
};

export const deleteFileFromSpace = async (fileUrl: string) => {
  if (!process.env.AWS_S3_BUCKET) {
    throw new Error('AWS_S3_BUCKET is not defined in environment variables.');
  }

  const url = new URL(fileUrl);
  const key = url.pathname.substring(1); // remove leading "/"

  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
  };

  try {
    await s3.send(new DeleteObjectCommand(params));
    console.log(`Deleted file from S3: ${key}`);
  } catch (error) {
    console.error('Error deleting file from S3:', error);
    throw error;
  }
};