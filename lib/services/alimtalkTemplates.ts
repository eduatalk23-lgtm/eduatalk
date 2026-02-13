/**
 * 카카오 알림톡 템플릿 매핑
 * SMS 템플릿 타입을 카카오 심사 완료 템플릿 코드에 매핑
 */

import type { SMSTemplateType } from "./smsTemplates";

export interface AlimtalkButton {
  name: string; // 버튼 제목 (28자)
  type: "WL" | "AL"; // WL=웹링크, AL=앱링크
  url_mobile?: string;
  url_pc?: string;
}

export interface AlimtalkTemplate {
  templateCode: string; // 카카오 심사 완료 템플릿 코드
  smsTemplateType: SMSTemplateType; // 대응하는 SMS 템플릿
  buttons?: AlimtalkButton[]; // 버튼 설정 (선택)
  variableOrder?: string[]; // 뿌리오 changeWord 변수 순서 (var1, var2, ...)
}

/**
 * SMS 템플릿 -> 카카오 알림톡 템플릿 매핑
 * 템플릿 코드는 카카오 심사 완료 후 실제 값으로 교체 필요
 */
export const ALIMTALK_TEMPLATE_MAP: Partial<
  Record<SMSTemplateType, AlimtalkTemplate>
> = {
  attendance_check_in: {
    templateCode: "ATTENDANCE_CHECKIN",
    smsTemplateType: "attendance_check_in",
  },
  attendance_check_out: {
    templateCode: "ATTENDANCE_CHECKOUT",
    smsTemplateType: "attendance_check_out",
  },
  attendance_absent: {
    templateCode: "ATTENDANCE_ABSENT",
    smsTemplateType: "attendance_absent",
  },
  attendance_late: {
    templateCode: "ATTENDANCE_LATE",
    smsTemplateType: "attendance_late",
  },
  payment_due: {
    templateCode: "PAYMENT_DUE",
    smsTemplateType: "payment_due",
  },
  payment_overdue: {
    templateCode: "PAYMENT_OVERDUE",
    smsTemplateType: "payment_overdue",
  },
  consultation_scheduled: {
    templateCode: "ppur_2026021316135251510801768",
    smsTemplateType: "consultation_scheduled",
    variableOrder: ["학원명", "학생명", "상담유형", "컨설턴트명", "방문상담자", "상담일정", "상담장소", "대표번호"],
  },
  consultation_changed: {
    templateCode: "ppur_2026021316143751510108085",
    smsTemplateType: "consultation_changed",
    variableOrder: ["학원명", "학생명", "상담유형", "상담일정", "컨설턴트명", "방문상담자", "상담장소", "대표번호"],
  },
  consultation_cancelled: {
    templateCode: "ppur_2026021316150212712013607",
    smsTemplateType: "consultation_cancelled",
    variableOrder: ["학원명", "학생명", "상담유형", "상담일정", "대표번호"],
  },
  consultation_reminder: {
    templateCode: "ppur_2026021316153051510158280",
    smsTemplateType: "consultation_reminder",
    variableOrder: ["학원명", "학생명", "상담유형", "상담일정", "컨설턴트명", "방문상담자", "상담장소", "대표번호"],
  },
  consultation_scheduled_remote: {
    templateCode: "ppur_2026021316155312712402569",
    smsTemplateType: "consultation_scheduled_remote",
    variableOrder: ["학원명", "학생명", "상담유형", "컨설턴트명", "방문상담자", "상담일정", "참가링크", "대표번호"],
  },
  consultation_changed_remote: {
    templateCode: "ppur_2026021316163351510176777",
    smsTemplateType: "consultation_changed_remote",
    variableOrder: ["학원명", "학생명", "상담유형", "상담일정", "컨설턴트명", "방문상담자", "참가링크", "대표번호"],
  },
  consultation_reminder_remote: {
    templateCode: "ppur_2026021316165651510958475",
    smsTemplateType: "consultation_reminder_remote",
    variableOrder: ["학원명", "학생명", "상담유형", "상담일정", "컨설턴트명", "방문상담자", "참가링크", "대표번호"],
  },
  consultation_missed_call: {
    templateCode: "ppur_2026021316131812712366335",
    smsTemplateType: "consultation_missed_call",
    variableOrder: ["학원명", "대표번호"],
  },
  notice: {
    templateCode: "NOTICE",
    smsTemplateType: "notice",
  },
};

export function getAlimtalkTemplate(
  smsType: SMSTemplateType
): AlimtalkTemplate | null {
  return ALIMTALK_TEMPLATE_MAP[smsType] ?? null;
}

/**
 * 뿌리오 /v1/kakao changeWord 객체 생성
 * variableOrder 순서대로 var1, var2, ... 매핑 (최대 var8)
 * 뿌리오 API는 var1~var8만 허용
 */
export function buildChangeWord(
  variableOrder: string[],
  variables: Record<string, string>
): Record<string, string> {
  const changeWord: Record<string, string> = {};
  variableOrder.forEach((varName, index) => {
    if (index < 8) {
      changeWord[`var${index + 1}`] = variables[varName] ?? "";
    }
  });
  return changeWord;
}
