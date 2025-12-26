/**
 * 캠프 초대 관련 헬퍼 함수
 */

/**
 * 초대 상태 업데이트 데이터 생성
 */
export function buildCampInvitationStatusUpdate(
  status: "pending" | "accepted" | "declined" | "expired"
): {
  status: string;
  updated_at: string;
  accepted_at?: string | null;
  declined_at?: string | null;
} {
  const updateData: {
    status: string;
    updated_at: string;
    accepted_at?: string | null;
    declined_at?: string | null;
  } = {
    status,
    updated_at: new Date().toISOString(),
  };

  // 상태에 따라 타임스탬프 설정
  if (status === "accepted") {
    updateData.accepted_at = new Date().toISOString();
    updateData.declined_at = null;
  } else if (status === "declined") {
    updateData.declined_at = new Date().toISOString();
    updateData.accepted_at = null;
  } else if (status === "expired") {
    // 만료됨 상태: 타임스탬프 유지 (변경하지 않음)
  } else {
    // pending 상태로 변경 시 타임스탬프 초기화 (재발송 시)
    updateData.accepted_at = null;
    updateData.declined_at = null;
  }

  return updateData;
}

