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
    templateCode: "CONSULTATION_SCHEDULED",
    smsTemplateType: "consultation_scheduled",
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
