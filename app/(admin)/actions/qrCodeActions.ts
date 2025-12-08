"use server";

import { requireAdminAuth } from "@/lib/auth/requireAdminAuth";
import { generateAttendanceQRCode } from "@/lib/services/qrCodeService";
import { normalizeError, getUserFacingMessage, logError } from "@/lib/errors";
import { service } from "@/lib/domains/qrCode";
import type { QRCodeRecord } from "@/lib/services/qrCodeService";

/**
 * 출석용 QR 코드 생성 (서버 액션)
 */
export async function generateQRCodeAction(): Promise<{
  success: boolean;
  qrCodeUrl?: string;
  qrCodeId?: string;
  error?: string;
}> {
  try {
    await requireAdminAuth();
    const result = await generateAttendanceQRCode();
    return {
      success: true,
      qrCodeUrl: result.qrCodeUrl,
      qrCodeId: result.qrCodeId,
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

/**
 * 현재 활성 QR 코드 조회
 */
export async function getActiveQRCodeAction(): Promise<{
  success: boolean;
  data?: QRCodeRecord | null;
  error?: string;
}> {
  try {
    await requireAdminAuth();
    const qrCode = await service.getActiveQRCode();
    return {
      success: true,
      data: qrCode,
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
    logError(normalizedError, { function: "getActiveQRCodeAction" });

    return {
      success: false,
      error: getUserFacingMessage(normalizedError),
    };
  }
}

/**
 * QR 코드 비활성화
 */
export async function deactivateQRCodeAction(
  qrCodeId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await requireAdminAuth();
    await service.deactivateQRCode(qrCodeId);
    return {
      success: true,
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
    logError(normalizedError, { function: "deactivateQRCodeAction" });

    return {
      success: false,
      error: getUserFacingMessage(normalizedError),
    };
  }
}

/**
 * QR 코드 이력 조회
 */
export async function getQRCodeHistoryAction(limit?: number): Promise<{
  success: boolean;
  data?: QRCodeRecord[];
  error?: string;
}> {
  try {
    await requireAdminAuth();
    const history = await service.getQRCodeHistory(limit || 50);
    return {
      success: true,
      data: history,
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
    logError(normalizedError, { function: "getQRCodeHistoryAction" });

    return {
      success: false,
      error: getUserFacingMessage(normalizedError),
    };
  }
}
