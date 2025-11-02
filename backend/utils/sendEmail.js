import nodemailer from "nodemailer";

const { EMAIL_USER, EMAIL_PASS } = process.env;

let transporter = null;

if (EMAIL_USER && EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });
} else {
  console.warn(
    "⚠️ Email credentials missing. Set EMAIL_USER and EMAIL_PASS to enable email notifications."
  );
}

export const sendEmail = async (to, subject, text) => {
  if (!transporter) {
    console.warn(
      `⚠️ Skipping email to ${to} because transporter is not configured.`
    );
    return;
  }

  try {
    await transporter.sendMail({
      from: EMAIL_USER,
      to,
      subject,
      text,
    });
    console.log(`📧 Email sent to ${to}`);
  } catch (err) {
    console.error("❌ Email sending failed:", err.message);
  }
};
