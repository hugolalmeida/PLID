import { getGoogleAccessToken } from "./oauth";

function toBase64Url(value: string) {
  return Buffer.from(value, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

type SendGmailPayload = {
  to: string;
  subject: string;
  body?: string;
  text?: string;
  html?: string;
};

export async function sendEmailWithGmail(payload: SendGmailPayload) {
  const accessToken = await getGoogleAccessToken();
  const fromHeader = process.env.GOOGLE_GMAIL_FROM?.trim();
  const fromLine = fromHeader ? `From: ${fromHeader}\r\n` : "";
  const textPart = payload.text || payload.body || "";

  let message = "";
  if (payload.html) {
    const boundary = `plid_${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}`;
    message = [
      `${fromLine}To: ${payload.to}`,
      `Subject: ${payload.subject}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: 8bit",
      "",
      textPart,
      "",
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: 8bit",
      "",
      payload.html,
      "",
      `--${boundary}--`,
    ].join("\r\n");
  } else {
    message = `${fromLine}To: ${payload.to}\r\nSubject: ${payload.subject}\r\nContent-Type: text/plain; charset="UTF-8"\r\n\r\n${textPart}`;
  }
  const raw = toBase64Url(message);

  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gmail send error: ${text}`);
  }

  const data = (await response.json()) as { id?: string };
  return {
    messageId: data.id || null,
  };
}
