
import nodemailer from 'nodemailer';

const GMAIL_EMAIL = process.env.GMAIL_EMAIL;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

if (!GMAIL_EMAIL || !GMAIL_APP_PASSWORD) {
  console.warn(
    'Nodemailer not configured. Email sending will fail. Please set GMAIL_EMAIL and GMAIL_APP_PASSWORD environment variables.'
  );
}

export const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: GMAIL_EMAIL,
    pass: GMAIL_APP_PASSWORD,
  },
});

export interface MailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export const sendMail = async (mailOptions: MailOptions) => {
  if (!GMAIL_EMAIL || !GMAIL_APP_PASSWORD) {
    throw new Error('Nodemailer is not configured. Cannot send email.');
  }
  try {
    await transporter.sendMail({
      from: GMAIL_EMAIL,
      ...mailOptions,
    });
    console.log('Email sent successfully to:', mailOptions.to);
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send email.');
  }
};
