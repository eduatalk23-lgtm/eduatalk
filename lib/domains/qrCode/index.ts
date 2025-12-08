/**
 * QR Code 도메인 Public API
 *
 * 외부에서는 이 파일을 통해서만 qrCode 도메인에 접근합니다.
 */

// Types
export type { QRCodeRecord } from "@/lib/services/qrCodeService";

// Repository (데이터 접근)
export * as repository from "./repository";

// Service (비즈니스 로직)
export * as service from "./service";
