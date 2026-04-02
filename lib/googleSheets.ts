import { google } from "googleapis";
import type { SheetTab } from "./types";

const UBER_RANGE = "Uber!A2:G";
const OZEL_RANGE = "Ozel!A2:G";
const GELIR_RANGE = "Gelir!A2:E";

/**
 * Vercel'de yanlış yapıştırılmış key OpenSSL hatası verir:
 * error:1E08010C:DECODER routines::unsupported
 */
function getPrivateKey(): string {
  const b64 = process.env.GOOGLE_PRIVATE_KEY_BASE64?.trim();
  if (b64) {
    const pem = Buffer.from(b64.replace(/\s/g, ""), "base64").toString("utf8");
    if (
      !pem.includes("BEGIN PRIVATE KEY") &&
      !pem.includes("BEGIN RSA PRIVATE KEY")
    ) {
      throw new Error(
        "GOOGLE_PRIVATE_KEY_BASE64 cozuldu ama gecerli PEM degil"
      );
    }
    return pem.trim();
  }

  let k = process.env.GOOGLE_PRIVATE_KEY;
  if (!k?.trim()) {
    throw new Error(
      "GOOGLE_PRIVATE_KEY veya GOOGLE_PRIVATE_KEY_BASE64 eksik"
    );
  }
  k = k.trim();
  if (k.charCodeAt(0) === 0xfeff) k = k.slice(1);
  if (
    (k.startsWith('"') && k.endsWith('"')) ||
    (k.startsWith("'") && k.endsWith("'"))
  ) {
    k = k.slice(1, -1);
  }
  k = k
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .trim();

  if (
    !k.includes("BEGIN PRIVATE KEY") &&
    !k.includes("BEGIN RSA PRIVATE KEY")
  ) {
    throw new Error(
      "Private key PEM degil. JSON'daki private_key degerinin tamamini kopyalayin veya GOOGLE_PRIVATE_KEY_BASE64 kullanin."
    );
  }
  return k;
}

export function getSheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!email || !sheetId) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_EMAIL veya GOOGLE_SHEET_ID eksik");
  }
  const auth = new google.auth.JWT({
    email,
    key: getPrivateKey(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return { sheets: google.sheets({ version: "v4", auth }), sheetId };
}

export async function readAllData() {
  const { sheets, sheetId } = getSheetsClient();
  const [uberRes, ozelRes, gelirRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: UBER_RANGE }),
    sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: OZEL_RANGE }),
    sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: GELIR_RANGE }),
  ]);
  return {
    uber: uberRes.data.values ?? [],
    ozel: ozelRes.data.values ?? [],
    gelir: gelirRes.data.values ?? [],
  };
}

function rangeForTab(tab: SheetTab): string {
  if (tab === "Uber") return "Uber!A:G";
  if (tab === "Ozel") return "Ozel!A:G";
  return "Gelir!A:E";
}

export async function appendRow(tab: SheetTab, values: (string | number)[]) {
  const { sheets, sheetId } = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: rangeForTab(tab),
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values.map(String)] },
  });
}

/** Başlık satırı (1. satır) kalır; tüm veri satırlarını siler. */
export async function clearAllDataRows() {
  const { sheets, sheetId } = getSheetsClient();
  await sheets.spreadsheets.values.batchClear({
    spreadsheetId: sheetId,
    requestBody: {
      ranges: [
        "Uber!A2:G5000",
        "Ozel!A2:G5000",
        "Gelir!A2:E5000",
      ],
    },
  });
}

export async function deleteRowById(tab: SheetTab, id: string) {
  const { sheets, sheetId } = getSheetsClient();
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: sheetId,
    fields: "sheets(properties(sheetId,title))",
  });
  const title =
    tab === "Uber" ? "Uber" : tab === "Ozel" ? "Ozel" : "Gelir";
  const sh = meta.data.sheets?.find((s) => s.properties?.title === title);
  const sheetIdNum = sh?.properties?.sheetId;
  if (sheetIdNum == null) {
    throw new Error(`Sayfa bulunamadı: ${title}`);
  }

  const range =
    tab === "Uber" ? UBER_RANGE : tab === "Ozel" ? OZEL_RANGE : GELIR_RANGE;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range,
  });
  const rows = res.data.values ?? [];
  const rowIndex = rows.findIndex((r) => r[0] === id);
  if (rowIndex < 0) throw new Error("Kayıt bulunamadı");

  const deleteRowIndex = rowIndex + 2;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheetIdNum,
              dimension: "ROWS",
              startIndex: deleteRowIndex - 1,
              endIndex: deleteRowIndex,
            },
          },
        },
      ],
    },
  });
}
