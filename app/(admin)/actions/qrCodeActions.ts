"use server";

import { requireAdminAuth } from "@/lib/auth/requireAdminAuth";
import { generateAttendanceQRCode } from "@/lib/services/qrCodeService";
import { withErrorHandling } from "@/lib/errors";

/**
 * 출석용 QR 코드 생성 (서버 액션)
 */
export async function generateQRCodeAction(): Promise<{
  success: boolean;
  qrCodeUrl?: string;
  error?: string;
}> {
  return withErrorHandling(async () => {
    await requireAdminAuth();
    const result = await generateAttendanceQRCode();
    return {
      success: true,
      qrCodeUrl: result.qrCodeUrl,
    };
  });
}

