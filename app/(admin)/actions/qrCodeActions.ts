"use server";

import { requireAdminAuth } from "@/lib/auth/requireAdminAuth";
import { generateAttendanceQRCode } from "@/lib/services/qrCodeService";
import { normalizeError, getUserFacingMessage, logError } from "@/lib/errors";

/**
 * 출석용 QR 코드 생성 (서버 액션)
 */
export async function generateQRCodeAction(): Promise<{
  success: boolean;
  qrCodeUrl?: string;
  error?: string;
}> {
  try {
    await requireAdminAuth();
    const result = await generateAttendanceQRCode();
    return {
      success: true,
      qrCodeUrl: result.qrCodeUrl,
    };
  } catch (error) {
    // Next.js의 redirect()와 notFound()는 재throw
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof (error as { digest: string }).digest === "string"
    ) {
      const digest = (error as { digest: string }).digest;
      if (
        digest.startsWith("NEXT_REDIRECT") ||
        digest.startsWith("NEXT_NOT_FOUND")
      ) {
        throw error;
      }
    }

    const normalizedError = normalizeError(error);
    logError(normalizedError, { function: "generateQRCodeAction" });

    return {
      success: false,
      error: getUserFacingMessage(normalizedError),
    };
  }
}
