type SyncTaskPayload = {
  title: string;
  description: string | null;
  dueDate: string;
  dueTime: string | null;
  ownerName: string;
  ownerEmail: string | null;
  organizationName: string;
  meetingTitle: string | null;
};

type ExistingCalendarEvent = {
  googleEventId: string;
  calendarId: string;
} | null;

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
}

function normalizeTime(value: string | null) {
  if (!value) return "09:00";
  return value.slice(0, 5);
}

function plusOneHour(time: string) {
  const [hoursRaw, minutesRaw] = time.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  const totalRaw = hours * 60 + minutes + 60;
  const dayIncrement = totalRaw >= 24 * 60 ? 1 : 0;
  const total = totalRaw % (24 * 60);
  const nextHours = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const nextMinutes = (total % 60).toString().padStart(2, "0");
  return {
    time: `${nextHours}:${nextMinutes}`,
    dayIncrement,
  };
}

function addDays(date: string, days: number) {
  if (days === 0) return date;
  const base = new Date(`${date}T00:00:00`);
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

async function getAccessToken() {
  const clientId = requiredEnv("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = requiredEnv("GOOGLE_OAUTH_CLIENT_SECRET");
  const refreshToken = requiredEnv("GOOGLE_OAUTH_REFRESH_TOKEN");

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google OAuth token error: ${text}`);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("Google OAuth response missing access_token.");
  }
  return data.access_token;
}

function buildEventBody(payload: SyncTaskPayload) {
  const time = normalizeTime(payload.dueTime);
  const { time: endTime, dayIncrement } = plusOneHour(time);
  const endDate = addDays(payload.dueDate, dayIncrement);
  const timeZone = process.env.GOOGLE_CALENDAR_TIMEZONE || "America/Sao_Paulo";

  const descriptionLines = [
    payload.description ? `Descricao: ${payload.description}` : "",
    `Responsavel: ${payload.ownerName}`,
    `Organizacao: ${payload.organizationName}`,
    payload.meetingTitle ? `Reuniao: ${payload.meetingTitle}` : "",
  ].filter(Boolean);

  return {
    summary: payload.title,
    description: descriptionLines.join("\n"),
    start: {
      dateTime: `${payload.dueDate}T${time}:00`,
      timeZone,
    },
    end: {
      dateTime: `${endDate}T${endTime}:00`,
      timeZone,
    },
    attendees: payload.ownerEmail ? [{ email: payload.ownerEmail }] : [],
  };
}

export async function syncTaskToGoogleCalendar(
  payload: SyncTaskPayload,
  existing: ExistingCalendarEvent,
) {
  const accessToken = await getAccessToken();
  const calendarId = existing?.calendarId || requiredEnv("GOOGLE_CALENDAR_ID");
  const encodedCalendarId = encodeURIComponent(calendarId);
  const body = buildEventBody(payload);

  const url = existing
    ? `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events/${existing.googleEventId}?sendUpdates=all`
    : `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events?sendUpdates=all`;

  const response = await fetch(url, {
    method: existing ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Calendar sync error: ${text}`);
  }

  const event = (await response.json()) as { id?: string };
  if (!event.id) {
    throw new Error("Google Calendar response missing event id.");
  }

  return {
    googleEventId: event.id,
    calendarId,
  };
}
