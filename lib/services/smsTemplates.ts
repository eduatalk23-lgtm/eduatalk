/**
 * SMS 템플릿 관리
 * 출석, 수강료, 상담 등 다양한 용도의 SMS 템플릿 정의
 */

export type SMSTemplateType =
  | "attendance_check_in"
  | "attendance_check_out"
  | "attendance_absent"
  | "attendance_late"
  | "payment_due"
  | "payment_overdue"
  | "consultation_scheduled"
  | "notice";

export interface SMSTemplate {
  id: string;
  type: SMSTemplateType;
  title: string;
  content: string;
  variables: string[]; // 템플릿 변수 목록
}

export const SMS_TEMPLATES: Record<SMSTemplateType, SMSTemplate> = {
  attendance_check_in: {
    id: "attendance_check_in",
    type: "attendance_check_in",
    title: "입실 알림",
    content: "[{학원명}] {학생명}님이 {시간}에 입실하셨습니다.",
    variables: ["학원명", "학생명", "시간"],
  },
  attendance_check_out: {
    id: "attendance_check_out",
    type: "attendance_check_out",
    title: "퇴실 알림",
    content: "[{학원명}] {학생명}님이 {시간}에 퇴실하셨습니다.",
    variables: ["학원명", "학생명", "시간"],
  },
  attendance_absent: {
    id: "attendance_absent",
    type: "attendance_absent",
    title: "결석 알림",
    content: "[{학원명}] {학생명}님이 {날짜}에 결석하셨습니다.",
    variables: ["학원명", "학생명", "날짜"],
  },
  attendance_late: {
    id: "attendance_late",
    type: "attendance_late",
    title: "지각 알림",
    content: "[{학원명}] {학생명}님이 {시간}에 지각하셨습니다.",
    variables: ["학원명", "학생명", "시간"],
  },
  payment_due: {
    id: "payment_due",
    type: "payment_due",
    title: "수강료 납부 안내",
    content:
      "[{학원명}] {학생명}님의 {월}월 수강료 {금액}원 납부 기한이 {날짜}까지입니다.",
    variables: ["학원명", "학생명", "월", "금액", "날짜"],
  },
  payment_overdue: {
    id: "payment_overdue",
    type: "payment_overdue",
    title: "수강료 연체 안내",
    content:
      "[{학원명}] {학생명}님의 {월}월 수강료 {금액}원이 연체되었습니다. 빠른 시일 내에 납부 부탁드립니다.",
    variables: ["학원명", "학생명", "월", "금액"],
  },
  consultation_scheduled: {
    id: "consultation_scheduled",
    type: "consultation_scheduled",
    title: "상담 일정 안내",
    content:
      "[{학원명}] {학생명}님의 상담 일정이 {날짜} {시간}로 예약되었습니다.",
    variables: ["학원명", "학생명", "날짜", "시간"],
  },
  notice: {
    id: "notice",
    type: "notice",
    title: "공지사항",
    content: "[{학원명}] {제목}\n{내용}",
    variables: ["학원명", "제목", "내용"],
  },
};

/**
 * SMS 템플릿 포맷팅
 * 변수를 실제 값으로 치환
 */
export function formatSMSTemplate(
  templateType: SMSTemplateType,
  variables: Record<string, string>
): string {
  const template = SMS_TEMPLATES[templateType];
  if (!template) {
    throw new Error(`템플릿을 찾을 수 없습니다: ${templateType}`);
  }

  let content = template.content;

  // 변수 치환
  for (const [key, value] of Object.entries(variables)) {
    content = content.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }

  // 치환되지 않은 변수가 있는지 확인 (선택사항)
  const remainingVariables = content.match(/\{([^}]+)\}/g);
  if (remainingVariables && remainingVariables.length > 0) {
    console.warn(
      `[SMS Template] 치환되지 않은 변수: ${remainingVariables.join(", ")}`
    );
  }

  return content;
}

/**
 * 템플릿 정보 조회
 */
export function getSMSTemplate(
  templateType: SMSTemplateType
): SMSTemplate | null {
  return SMS_TEMPLATES[templateType] || null;
}

/**
 * 모든 템플릿 목록 조회
 */
export function getAllSMSTemplates(): SMSTemplate[] {
  return Object.values(SMS_TEMPLATES);
}

