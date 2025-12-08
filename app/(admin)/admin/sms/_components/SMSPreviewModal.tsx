"use client";

import { useMemo } from "react";
import Button from "@/components/atoms/Button";
import { formatSMSTemplate, type SMSTemplateType } from "@/lib/services/smsTemplates";

type Student = {
  id: string;
  name: string | null;
  parent_contact: string | null;
};

type SMSPreviewModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  selectedStudents: Student[];
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
  selectedStudents,
  message,
  templateType,
  templateVariables = {},
  academyName = "학원",
  isSending = false,
}: SMSPreviewModalProps) {
  if (!open) return null;

  const recipientCount = selectedStudents.length;

  // 각 학생별 메시지 생성 (템플릿 사용 시)
  const studentMessages = useMemo(() => {
    if (!templateType || !message) {
      return selectedStudents.map((s) => ({
        student: s,
        message: message,
      }));
    }

    return selectedStudents.map((student) => {
      try {
        const variables = {
          ...templateVariables,
          학원명: academyName,
          학생명: student.name || "학생",
        };
        const formattedMessage = formatSMSTemplate(templateType, variables);
        return {
          student,
          message: formattedMessage,
        };
      } catch {
        // 템플릿 포맷팅 실패 시 원본 메시지 사용
        let finalMessage = message;
        finalMessage = finalMessage.replace(
          /\{학생명\}/g,
          student.name || "학생"
        );
        finalMessage = finalMessage.replace(/\{학원명\}/g, academyName);
        return {
          student,
          message: finalMessage,
        };
      }
    });
  }, [selectedStudents, message, templateType, templateVariables, academyName]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">
          SMS 발송 미리보기
        </h2>

        {/* 발송 요약 */}
        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
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
        <div className="mb-4 max-h-96 overflow-y-auto rounded-lg border border-gray-200">
          <div className="divide-y divide-gray-200">
            {studentMessages.map(({ student, message: studentMessage }) => (
              <div key={student.id} className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {student.name || "이름 없음"}
                    </div>
                    <div className="text-xs text-gray-500">
                      {student.parent_contact}
                    </div>
                  </div>
                </div>
                <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="text-xs text-gray-600 mb-1">발송 메시지:</div>
                  <div className="text-sm text-gray-900 whitespace-pre-wrap">
                    {studentMessage}
                  </div>
                </div>
              </div>
            ))}
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

