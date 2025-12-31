/**
 * QR 코드 서비스
 * 출석용 QR 코드 생성 및 검증
 */

import QRCode from "qrcode";
import { headers } from "next/headers";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getBaseUrl } from "@/lib/utils/getBaseUrl";

export type QRCodeData = {
  qrCodeId: string; // 데이터베이스 ID
  tenantId: string;
  timestamp: number;
  type: "attendance";
};

export type QRCodeVerificationResult = {
  valid: boolean;
  tenantId?: string;
  qrCodeId?: string;
  error?: string;
};

export type QRCodeRecord = {
  id: string;
  tenant_id: string;
  qr_data: string;
  qr_code_url: string | null;
  is_active: boolean;
  expires_at: string;
  created_by: string | null;
  created_at: string;
  deactivated_at: string | null;
  deactivated_by: string | null;
  usage_count: number;
  last_used_at: string | null;
};

/**
 * 학원별 출석용 QR 코드 생성
 * @returns QR 코드 이미지 URL (Data URL), QR 코드 데이터, QR 코드 ID
 */
export async function generateAttendanceQRCode(): Promise<{
  qrCodeUrl: string;
  qrCodeData: string;
  qrCodeId: string;
}> {
  const { service } = await import("@/lib/domains/qrCode");
  const tenantContext = await getTenantContext();

  if (!tenantContext?.tenantId) {
    throw new Error("테넌트 정보를 찾을 수 없습니다.");
  }

  // 만료 시간 설정 (기본 24시간)
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  // 임시 ID 생성 (실제 ID는 DB에서 생성됨)
  const tempId = crypto.randomUUID();

  // QR 코드 데이터 생성 (임시 ID 사용, 나중에 실제 ID로 업데이트)
  const timestamp = Date.now();
  const qrData: QRCodeData = {
    qrCodeId: tempId,
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

  // QR 코드 생성 (기존 활성 QR 코드 자동 비활성화)
  const qrCodeRecord = await service.createQRCode(
    qrDataString,
    qrCodeUrl,
    expiresAt
  );

  // 실제 ID로 QR 코드 데이터 업데이트
  const actualQrData: QRCodeData = {
    ...qrData,
    qrCodeId: qrCodeRecord.id,
  };
  const actualQrDataString = JSON.stringify(actualQrData);

  // BASE_URL 가져오기 (Deep Link용)
  const headersList = await headers();
  const baseUrl = getBaseUrl(headersList);
  const deepLinkUrl = `${baseUrl}/attendance/check-in/qr?code=${qrCodeRecord.id}`;

  // Deep Link URL로 QR 코드 이미지 생성 (카메라 앱에서 스캔 시 자동으로 열림)
  const deepLinkQrCodeUrl = await QRCode.toDataURL(deepLinkUrl, {
    width: 400,
    margin: 2,
    errorCorrectionLevel: "M",
  });

  // DB에 실제 QR 코드 데이터 및 이미지 URL 업데이트
  // qr_data는 기존 JSON 형식 유지 (하위 호환성)
  // qr_code_url은 Deep Link URL로 생성된 이미지 사용
  const { repository } = await import("@/lib/domains/qrCode");
  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();

  await supabase
    .from("attendance_qr_codes")
    .update({
      qr_data: actualQrDataString, // JSON 데이터는 DB에 저장 (기존 스캐너 호환)
      qr_code_url: deepLinkQrCodeUrl, // Deep Link URL로 생성된 이미지
    })
    .eq("id", qrCodeRecord.id)
    .eq("tenant_id", tenantContext.tenantId);

  return {
    qrCodeUrl: deepLinkQrCodeUrl,
    qrCodeData: actualQrDataString, // 기존 호환성을 위해 JSON 데이터도 반환
    qrCodeId: qrCodeRecord.id,
  };
}

/**
 * QR 코드 검증 (DB 기반)
 * URL 형식과 JSON 형식 모두 지원
 * @param qrData - 스캔된 QR 코드 데이터 (URL 또는 JSON 문자열)
 * @returns 검증 결과
 */
export async function verifyQRCode(
  qrData: string
): Promise<QRCodeVerificationResult> {
  try {
    // URL 형식인지 확인 (예: https://domain.com/attendance/check-in/qr?code=xxx)
    const urlMatch = qrData.match(/\/attendance\/check-in\/qr\?code=([^&]+)/);
    if (urlMatch) {
      const qrCodeId = urlMatch[1];
      // DB에서 QR 코드 조회 및 검증
      const { service } = await import("@/lib/domains/qrCode");

      try {
        const qrCodeRecord = await service.verifyAndUpdateQRCode(qrCodeId);

        return {
          valid: true,
          tenantId: qrCodeRecord.tenant_id,
          qrCodeId: qrCodeRecord.id,
        };
      } catch (error: unknown) {
        // AppError인 경우 에러 메시지 반환
        if (error instanceof Error) {
          return {
            valid: false,
            error: error.message,
          };
        }
        return {
          valid: false,
          error: "QR 코드 검증에 실패했습니다.",
        };
      }
    }

    // JSON 형식인 경우 (기존 호환성)
    const data = JSON.parse(qrData) as QRCodeData;

    // 타입 검증
    if (data.type !== "attendance") {
      return {
        valid: false,
        error: "잘못된 QR 코드입니다. 출석용 QR 코드가 아닙니다.",
      };
    }

    // qrCodeId 검증
    if (!data.qrCodeId || typeof data.qrCodeId !== "string") {
      return {
        valid: false,
        error: "QR 코드에 ID가 없습니다.",
      };
    }

    // tenantId 검증
    if (!data.tenantId || typeof data.tenantId !== "string") {
      return {
        valid: false,
        error: "QR 코드에 테넌트 정보가 없습니다.",
      };
    }

    // DB에서 QR 코드 조회 및 검증
    const { service } = await import("@/lib/domains/qrCode");

    try {
      const qrCodeRecord = await service.verifyAndUpdateQRCode(data.qrCodeId);

      return {
        valid: true,
        tenantId: qrCodeRecord.tenant_id,
        qrCodeId: qrCodeRecord.id,
      };
    } catch (error: unknown) {
      // AppError인 경우 에러 메시지 반환
      if (error instanceof Error) {
        return {
          valid: false,
          error: error.message,
        };
      }
      return {
        valid: false,
        error: "QR 코드 검증에 실패했습니다.",
      };
    }
  } catch (error) {
    return {
      valid: false,
      error: "QR 코드 형식이 올바르지 않습니다.",
    };
  }
}
