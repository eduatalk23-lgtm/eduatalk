/**
 * SMS 폼 유효성 검사 유틸리티
 */

export type SMSFormValidationError = {
  field: string;
  message: string;
};

export type SMSFormValidationResult = {
  isValid: boolean;
  errors: SMSFormValidationError[];
};

type ValidateSingleSendFormParams = {
  phone: string;
  message: string;
};

type ValidateBulkSendFormParams = {
  selectedRecipientsCount: number;
  message: string;
};

/**
 * 단일 발송 폼 유효성 검사
 */
export function validateSingleSendForm({
  phone,
  message,
}: ValidateSingleSendFormParams): SMSFormValidationResult {
  const errors: SMSFormValidationError[] = [];

  if (!phone.trim()) {
    errors.push({
      field: "phone",
      message: "수신자 전화번호를 입력해주세요.",
    });
  } else {
    // 전화번호 형식 검증 (간단한 검증)
    const phoneRegex = /^[0-9-]+$/;
    if (!phoneRegex.test(phone.trim())) {
      errors.push({
        field: "phone",
        message: "올바른 전화번호 형식을 입력해주세요.",
      });
    }
  }

  if (!message.trim()) {
    errors.push({
      field: "message",
      message: "메시지 내용을 입력해주세요.",
    });
  } else if (message.trim().length > 2000) {
    errors.push({
      field: "message",
      message: "메시지는 2000자 이하여야 합니다.",
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * 일괄 발송 폼 유효성 검사
 */
export function validateBulkSendForm({
  selectedRecipientsCount,
  message,
}: ValidateBulkSendFormParams): SMSFormValidationResult {
  const errors: SMSFormValidationError[] = [];

  if (selectedRecipientsCount === 0) {
    errors.push({
      field: "recipients",
      message: "최소 1개 이상의 연락처를 선택해주세요.",
    });
  }

  if (!message.trim()) {
    errors.push({
      field: "message",
      message: "메시지 내용을 입력해주세요.",
    });
  } else if (message.trim().length > 2000) {
    errors.push({
      field: "message",
      message: "메시지는 2000자 이하여야 합니다.",
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * 통합 SMS 폼 유효성 검사
 */
export function validateSMSForm(
  sendMode: "single" | "bulk",
  params: ValidateSingleSendFormParams | ValidateBulkSendFormParams
): SMSFormValidationResult {
  if (sendMode === "single") {
    return validateSingleSendForm(params as ValidateSingleSendFormParams);
  } else {
    return validateBulkSendForm(params as ValidateBulkSendFormParams);
  }
}

