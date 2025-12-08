/**
 * QR Code 도메인 Service
 * QR 코드 비즈니스 로직
 */

import * as repository from "./repository";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { AppError, ErrorCode } from "@/lib/errors";
import type { QRCodeRecord } from "@/lib/services/qrCodeService";

/**
 * QR 코드 생성 (기존 활성 QR 코드 자동 비활성화)
 */
export async function createQRCode(
  qrData: string,
  qrCodeUrl: string | null,
  expiresAt: Date
): Promise<QRCodeRecord> {
  const tenantContext = await getTenantContext();
  const user = await getCurrentUser();

  if (!tenantContext?.tenantId) {
    throw new AppError(
      "테넌트 정보를 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  if (!user) {
    throw new AppError(
      "사용자 정보를 찾을 수 없습니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }

  // 기존 활성 QR 코드 비활성화
  await repository.deactivateAllActiveQRCodes(
    tenantContext.tenantId,
    user.userId
  );

  // 새 QR 코드 생성
  return repository.createQRCode(
    tenantContext.tenantId,
    qrData,
    qrCodeUrl,
    expiresAt,
    user.userId
  );
}

/**
 * 활성 QR 코드 조회
 */
export async function getActiveQRCode(): Promise<QRCodeRecord | null> {
  const tenantContext = await getTenantContext();

  if (!tenantContext?.tenantId) {
    throw new AppError(
      "테넌트 정보를 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  return repository.getActiveQRCode(tenantContext.tenantId);
}

/**
 * QR 코드 ID로 조회 및 검증
 */
export async function getQRCodeById(
  qrCodeId: string
): Promise<QRCodeRecord> {
  const tenantContext = await getTenantContext();

  if (!tenantContext?.tenantId) {
    throw new AppError(
      "테넌트 정보를 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  const qrCode = await repository.getQRCodeById(
    qrCodeId,
    tenantContext.tenantId
  );

  if (!qrCode) {
    throw new AppError(
      "QR 코드를 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  return qrCode;
}

/**
 * QR 코드 검증 및 사용 통계 업데이트
 */
export async function verifyAndUpdateQRCode(
  qrCodeId: string
): Promise<QRCodeRecord> {
  const tenantContext = await getTenantContext();

  if (!tenantContext?.tenantId) {
    throw new AppError(
      "테넌트 정보를 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  const qrCode = await repository.getQRCodeById(
    qrCodeId,
    tenantContext.tenantId
  );

  if (!qrCode) {
    throw new AppError(
      "QR 코드를 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // 활성 상태 확인
  if (!qrCode.is_active) {
    throw new AppError(
      "QR 코드가 비활성화되었습니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 만료 시간 확인
  const expiresAt = new Date(qrCode.expires_at);
  const now = new Date();

  if (now > expiresAt) {
    throw new AppError(
      "QR 코드가 만료되었습니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 테넌트 일치 확인
  if (qrCode.tenant_id !== tenantContext.tenantId) {
    throw new AppError(
      "다른 학원의 QR 코드입니다.",
      ErrorCode.VALIDATION_ERROR,
      403,
      true
    );
  }

  // 사용 통계 업데이트
  await repository.incrementQRCodeUsage(qrCodeId, tenantContext.tenantId);

  // 업데이트된 QR 코드 반환
  const updatedQRCode = await repository.getQRCodeById(
    qrCodeId,
    tenantContext.tenantId
  );

  if (!updatedQRCode) {
    throw new AppError(
      "QR 코드를 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  return updatedQRCode;
}

/**
 * QR 코드 비활성화
 */
export async function deactivateQRCode(qrCodeId: string): Promise<void> {
  const tenantContext = await getTenantContext();
  const user = await getCurrentUser();

  if (!tenantContext?.tenantId) {
    throw new AppError(
      "테넌트 정보를 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  if (!user) {
    throw new AppError(
      "사용자 정보를 찾을 수 없습니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }

  // QR 코드 존재 확인
  const qrCode = await repository.getQRCodeById(
    qrCodeId,
    tenantContext.tenantId
  );

  if (!qrCode) {
    throw new AppError(
      "QR 코드를 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // 비활성화
  await repository.deactivateQRCode(
    qrCodeId,
    tenantContext.tenantId,
    user.userId
  );
}

/**
 * QR 코드 이력 조회
 */
export async function getQRCodeHistory(
  limit: number = 50
): Promise<QRCodeRecord[]> {
  const tenantContext = await getTenantContext();

  if (!tenantContext?.tenantId) {
    throw new AppError(
      "테넌트 정보를 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  return repository.getQRCodeHistory(tenantContext.tenantId, limit);
}

