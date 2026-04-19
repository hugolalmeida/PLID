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
  body: string;
};

export async function sendEmailWithGmail(payload: SendGmailPayload) {
  const accessToken = await getGoogleAccessToken();
  const fromHeader = process.env.GOOGLE_GMAIL_FROM?.trim();
  const fromLine = fromHeader ? `From: ${fromHeader}\r\n` : "";
  const message = `${fromLine}To: ${payload.to}\r\nSubject: ${payload.subject}\r\nContent-Type: text/plain; charset="UTF-8"\r\n\r\n${payload.body}`;
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
