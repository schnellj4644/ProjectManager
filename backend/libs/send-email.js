import mailjet from "node-mailjet";
import dotenv from "dotenv";

dotenv.config();

const client = mailjet.apiConnect(
  process.env.MAIL_JET_API_KEY,
  process.env.MAIL_JET_SECRET_KEY,
);

export const sendEmail = (toEmail, subject, textPart, htmlPart) => {
  return client.post("send", { version: "v3.1" }).request({
    Messages: [
      {
        From: {
          Email: "TaskHUB <schnellj4644@gmail.com>",
          Name: "TaskHUB",
        },
        To: [
          {
            Email: toEmail,
          },
        ],
        Subject: subject,
        TextPart: textPart,
        HTMLPart: htmlPart,
      },
    ],
  });
};
