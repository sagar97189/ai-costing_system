const nodemailer = require("nodemailer");

/**
 * Sends a 6-digit verification code to the specified email address.
 * @param {string} email 
 * @param {string} otp 
 */
async function sendOTPEmail(email, otp) {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER || process.env.SMTP_EMAIL || "";
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD || "";

  const isPlaceholder = !user || !pass || user.includes("your_email") || pass.includes("your_app_password");
  if (isPlaceholder) {
    throw new Error("SMTP credentials are not configured or are placeholders.");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  const mailOptions = {
    from: `"Amanzi AI Costing" <${user}>`,
    to: email.trim(),
    subject: "Your Amanzi OTP Verification Code",
    text: `Your one-time password (OTP) is: ${otp}. It is valid for 5 minutes.`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #2563eb; font-size: 24px; margin: 0; font-weight: 700;">Amanzi Secure Gateway</h2>
          <p style="color: #64748b; font-size: 14px; margin: 4px 0 0 0;">AI-Powered Costing Engine</p>
        </div>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 0 0 24px 0;" />
        <p style="font-size: 16px; line-height: 1.5; margin: 0 0 16px 0;">Hello,</p>
        <p style="font-size: 16px; line-height: 1.5; margin: 0 0 24px 0;">Please use the following one-time password (OTP) to complete your login process. This code is valid for <strong>5 minutes</strong>.</p>
        <div style="font-size: 36px; font-weight: 700; letter-spacing: 6px; color: #2563eb; padding: 18px; background-color: #f8fafc; text-align: center; margin: 24px 0; border-radius: 8px; border: 1px solid #cbd5e1;">
          ${otp}
        </div>
        <p style="color: #ef4444; font-size: 14px; margin: 0 0 24px 0; font-weight: 500;">Do not share this code with anyone. Amanzi support will never ask for your OTP.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 0 0 16px 0;" />
        <p style="color: #64748b; font-size: 12px; margin: 0; text-align: center;">This is an automated email. Please do not reply directly to this message.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
  console.log(`[EMAIL] OTP sent successfully to ${email}`);
}

module.exports = { sendOTPEmail };
