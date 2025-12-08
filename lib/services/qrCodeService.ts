/**
 * QR 코드 서비스
 * 출석용 QR 코드 생성 및 검증
 */

import QRCode from "qrcode";
import { getTenantContext } from "@/lib/tenant/getTenantContext";

export type QRCodeData = {
  tenantId: string;
  timestamp: number;
  type: "attendance";
};

export type QRCodeVerificationResult = {
  valid: boolean;
  tenantId?: string;
  error?: string;
};

/**
 * 학원별 출석용 QR 코드 생성
 * @returns QR 코드 이미지 URL (Data URL) 및 QR 코드 데이터
 */
export async function generateAttendanceQRCode(): Promise<{
  qrCodeUrl: string;
  qrCodeData: string;
}> {
  const tenantContext = await getTenantContext();

  if (!tenantContext?.tenantId) {
    throw new Error("테넌트 정보를 찾을 수 없습니다.");
  }

  // QR 코드 데이터 생성 (테넌트 ID + 타임스탬프 + 타입)
  const timestamp = Date.now();
  const qrData: QRCodeData = {
    tenantId: tenantContext.tenantId,
    timestamp,
    type: "attendance",
  };

  const qrDataString = JSON.stringify(qrData);

  // QR 코드 이미지 생성
  const qrCodeUrl = await QRCode.toDataURL(qrDataString, {
    width: 400,
    margin: 2,
    errorCorrectionLevel: "M",
  });

  return {
    qrCodeUrl,
    qrCodeData: qrDataString,
  };
}

/**
 * QR 코드 검증
 * @param qrData - 스캔된 QR 코드 데이터 (JSON 문자열)
 * @returns 검증 결과
 */
export function verifyQRCode(qrData: string): QRCodeVerificationResult {
  try {
    const data = JSON.parse(qrData) as QRCodeData;

    // 타입 검증
    if (data.type !== "attendance") {
      return {
        valid: false,
        error: "잘못된 QR 코드입니다. 출석용 QR 코드가 아닙니다.",
      };
    }

    // tenantId 검증
    if (!data.tenantId || typeof data.tenantId !== "string") {
      return {
        valid: false,
        error: "QR 코드에 테넌트 정보가 없습니다.",
      };
    }

    // 타임스탬프 검증 (24시간 이내)
    const timestamp = data.timestamp;
    if (!timestamp || typeof timestamp !== "number") {
      return {
        valid: false,
        error: "QR 코드에 타임스탬프가 없습니다.",
      };
    }

    const now = Date.now();
    const diff = now - timestamp;
    const oneDay = 24 * 60 * 60 * 1000; // 24시간 (밀리초)

    if (diff < 0) {
      return {
        valid: false,
        error: "QR 코드의 타임스탬프가 미래입니다.",
      };
    }

    if (diff > oneDay) {
      return {
        valid: false,
        error: "QR 코드가 만료되었습니다. (24시간 초과)",
      };
    }

    return {
      valid: true,
      tenantId: data.tenantId,
    };
  } catch (error) {
    return {
      valid: false,
      error: "QR 코드 형식이 올바르지 않습니다.",
    };
  }
}

