import { createSign } from "crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

function base64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function getServiceAccountCredentials() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n",
  );

  if (!email || !privateKey) {
    throw new Error(
      "Google Sheets is not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.",
    );
  }

  return { email, privateKey };
}

async function getAccessToken(): Promise<string> {
  const { email, privateKey } = getServiceAccountCredentials();
  const now = Math.floor(Date.now() / 1000);

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({
      iss: email,
      scope: SHEETS_SCOPE,
      aud: TOKEN_URL,
      exp: now + 3600,
      iat: now,
    }),
  );
  const signatureInput = `${header}.${claim}`;
  const sign = createSign("RSA-SHA256");
  sign.update(signatureInput);
  sign.end();
  const signature = base64url(sign.sign(privateKey));
  const jwt = `${signatureInput}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google auth failed: ${text}`);
  }

  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("Google auth did not return an access token.");
  }

  return data.access_token;
}

export function parseSpreadsheetUrl(url: string): {
  spreadsheetId: string;
  gid: string | null;
} {
  const trimmed = url.trim();
  const idMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) {
    throw new Error("Invalid Google Sheets URL.");
  }

  const gidMatch = trimmed.match(/[#?&]gid=(\d+)/);
  return {
    spreadsheetId: idMatch[1],
    gid: gidMatch?.[1] ?? null,
  };
}

type SheetMeta = { title: string; sheetId: number };

async function getSpreadsheetMeta(
  spreadsheetId: string,
  accessToken: string,
): Promise<{ sheets: SheetMeta[] }> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(title,sheetId))`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 403) {
      throw new Error(
        "Permission denied. Share the sheet with your service account email as Viewer.",
      );
    }
    throw new Error(`Could not read spreadsheet: ${text}`);
  }

  const data = (await res.json()) as {
    sheets?: { properties?: { title?: string; sheetId?: number } }[];
  };

  const sheets =
    data.sheets?.map((s) => ({
      title: s.properties?.title ?? "Sheet1",
      sheetId: s.properties?.sheetId ?? 0,
    })) ?? [];

  return { sheets };
}

function pickResponseSheetTitle(sheets: SheetMeta[]): string {
  const formResponses = sheets.find((s) =>
    /^form responses/i.test(s.title),
  );
  return formResponses?.title ?? sheets[0]?.title ?? "Sheet1";
}

function resolveSheetTitle(
  sheets: SheetMeta[],
  gid: string | null,
): string {
  if (gid) {
    const gidNum = parseInt(gid, 10);
    const match = sheets.find((s) => s.sheetId === gidNum);
    if (match) return match.title;
  }
  return pickResponseSheetTitle(sheets);
}

export async function fetchSpreadsheetRows(
  sheetUrl: string,
): Promise<string[][]> {
  const { spreadsheetId, gid } = parseSpreadsheetUrl(sheetUrl);
  const accessToken = await getAccessToken();
  const { sheets } = await getSpreadsheetMeta(spreadsheetId, accessToken);
  const sheetTitle = resolveSheetTitle(sheets, gid);
  const range = encodeURIComponent(`'${sheetTitle.replace(/'/g, "''")}'!A:Z`);

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Could not read sheet values: ${text}`);
  }

  const data = (await res.json()) as { values?: string[][] };
  const rows = data.values ?? [];

  if (rows.length < 2) {
    throw new Error("Sheet has no responses yet.");
  }

  return rows;
}

export function isGoogleSheetsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim(),
  );
}
