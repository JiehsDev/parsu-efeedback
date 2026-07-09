// src/features/reports/services/report-upload.service.ts
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, isR2Configured } from "@/lib/r2";
import { env } from "@/lib/env";

const EXTENSIONS: Record<string, string> = { csv: "csv", excel: "xlsx", pdf: "pdf" };
const CONTENT_TYPES: Record<string, string> = {
  csv: "text/csv",
  excel: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
};

// Returns the R2 object key (not a public URL) — the report is fetched
// through our own authenticated route, never directly from R2.
export async function uploadReportFile(
  buffer: Buffer,
  format: "csv" | "excel" | "pdf",
  reportId: string,
): Promise<string> {
  if (!isR2Configured() || !r2Client) {
    throw new Error("R2 is not configured");
  }

  const key = `reports/${reportId}.${EXTENSIONS[format]}`;

  await r2Client.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: CONTENT_TYPES[format],
    }),
  );

  return key; // store the key, not a URL
}
