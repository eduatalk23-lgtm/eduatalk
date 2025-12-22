"use client";

import { useMemo } from "react";
import Button from "@/components/atoms/Button";
import { formatSMSTemplate, type SMSTemplateType } from "@/lib/services/smsTemplates";
import type { SMSRecipient } from "@/app/api/admin/sms/students/route";

type SMSPreviewModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  selectedRecipients: SMSRecipient[];
  message: string;
  templateType?: SMSTemplateType | "";
  templateVariables?: Record<string, string>;
  academyName?: string;
  isSending?: boolean;
};

export function SMSPreviewModal({
  open,
  onClose,
  onConfirm,
  selectedRecipients,
  message,
  templateType,
  templateVariables = {},
  academyName = "학원",
  isSending = false,
}: SMSPreviewModalProps) {
  const recipientCount = selectedRecipients.length;

  // 각 연락처별 메시지 생성 (템플릿 사용 시)
  const recipientMessages = useMemo(() => {
    if (!templateType || !message) {
      return selectedRecipients.map((r) => ({
        recipient: r,
        message: message,
      }));
    }

    return selectedRecipients.map((recipient) => {
      try {
        const variables = {
          ...templateVariables,
          학원명: academyName,
          학생명: recipient.studentName || "학생",
        };
        const formattedMessage = formatSMSTemplate(templateType, variables);
        return {
          recipient,
          message: formattedMessage,
        };
      } catch {
        // 템플릿 포맷팅 실패 시 원본 메시지 사용
        let finalMessage = message;
        finalMessage = finalMessage.replace(
          /\{학생명\}/g,
          recipient.studentName || "학생"
        );
        finalMessage = finalMessage.replace(/\{학원명\}/g, academyName);
        return {
          recipient,
          message: finalMessage,
        };
      }
    });
  }, [selectedRecipients, message, templateType, templateVariables, academyName]);

  // 전송 대상자 타입 라벨
  const getRecipientTypeLabel = (
    recipientType: SMSRecipient["recipientType"]
  ): string => {
    switch (recipientType) {
      case "student":
        return "학생";
      case "mother":
        return "어머니";
      case "father":
        return "아버지";
      default:
        return "";
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="flex flex-col gap-4 w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-xl font-semibold text-gray-900">
          SMS 발송 미리보기
        </h2>

        {/* 발송 요약 */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-600">발송 대상자</div>
              <div className="text-lg font-semibold text-gray-900">
                {recipientCount}명
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">메시지 길이</div>
              <div className="text-lg font-semibold text-gray-900">
                {message.length}자
              </div>
            </div>
          </div>
        </div>

        {/* 발송 대상자 목록 및 메시지 미리보기 */}
        <div className="max-h-96 overflow-y-auto rounded-lg border border-gray-200">
          <div className="divide-y divide-gray-200">
            {recipientMessages.map(({ recipient, message: recipientMessage }) => {
              const key = `${recipient.studentId}-${recipient.recipientType}`;
              return (
                <div key={key} className="flex flex-col gap-2 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-gray-900">
                          {recipient.studentName || "이름 없음"}
                        </div>
                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">
                          {getRecipientTypeLabel(recipient.recipientType)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {recipient.phone || "연락처 없음"}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="text-xs text-gray-600">발송 메시지:</div>
                    <div className="text-sm text-gray-900 whitespace-pre-wrap">
                      {recipientMessage}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSending}
          >
            취소
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={onConfirm}
            isLoading={isSending}
            disabled={isSending}
          >
            {isSending ? "발송 중..." : "발송하기"}
          </Button>
        </div>
      </div>
    </div>
  );
}

