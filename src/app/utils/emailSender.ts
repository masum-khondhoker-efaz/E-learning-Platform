import nodemailer from 'nodemailer';
import config from '../../config';

const emailSender = async (
  subject: string,
  email: string,
  html: string,
  filePath?: string, // rename for clarity
) => {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: config.emailSender.email,
      pass: config.emailSender.app_pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  const mailOptions: any = {
    from: `"E-learning" <${config.emailSender.email}>`,
    to: email,
    subject,
    html,
  };

  if (filePath) {
    mailOptions.attachments = [
      {
        filename: 'invoice.pdf',
        path: filePath, // ✅ attach from file system
      },
    ];
  }

  const info = await transporter.sendMail(mailOptions);
  console.log(`✅ Email sent to ${email}: ${info.messageId}`);
};

export default emailSender;
