/**
 * 초대 QR 코드 생성 유틸리티
 *
 * 초대 토큰 → /join/{token} URL → QR 코드 이미지(Data URL)
 * 기존 qrcode 패키지 활용 (이미 package.json에 설치됨)
 */

import QRCode from "qrcode";
import { getBaseUrl } from "@/lib/utils/getBaseUrl";

/**
 * 초대 토큰으로 QR 코드 Data URL 생성
 */
export async function generateInviteQRCode(token: string): Promise<string> {
  const baseUrl = getBaseUrl();
  const joinUrl = `${baseUrl}/join/${token}`;

  return QRCode.toDataURL(joinUrl, {
    width: 300,
    margin: 2,
    errorCorrectionLevel: "M",
    color: {
      dark: "#18181b",
      light: "#ffffff",
    },
  });
}

/**
 * 초대 토큰으로 QR 코드 SVG 문자열 생성
 */
export async function generateInviteQRCodeSVG(token: string): Promise<string> {
  const baseUrl = getBaseUrl();
  const joinUrl = `${baseUrl}/join/${token}`;

  return QRCode.toString(joinUrl, {
    type: "svg",
    width: 300,
    margin: 2,
    errorCorrectionLevel: "M",
    color: {
      dark: "#18181b",
      light: "#ffffff",
    },
  });
}

/**
 * 초대 토큰으로 가입 URL 생성
 */
export function getInviteJoinUrl(token: string): string {
  const baseUrl = getBaseUrl();
  return `${baseUrl}/join/${token}`;
}
