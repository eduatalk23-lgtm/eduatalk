"use client";

import { useMemo } from "react";
import Button from "@/components/atoms/Button";
import type { SMSRecipient } from "@/app/api/admin/sms/students/route";

type SelectedRecipientsListProps = {
  selectedRecipients: Map<string, SMSRecipient>;
  onRemoveRecipient: (key: string) => void;
  onClearAll: () => void;
};

export default function SelectedRecipientsList({
  selectedRecipients,
  onRemoveRecipient,
  onClearAll,
}: SelectedRecipientsListProps) {
  // 선택된 연락처 목록 (배열로 변환)
  const recipientsList = useMemo(() => {
    return Array.from(selectedRecipients.values());
  }, [selectedRecipients]);

  // recipient 키 생성
  const getRecipientKey = (recipient: SMSRecipient): string => {
    return `${recipient.studentId}-${recipient.recipientType}`;
  };

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

  // 구분 라벨
  const getDivisionLabel = (
    division: SMSRecipient["division"]
  ): string => {
    return division || "미설정";
  };

  if (recipientsList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-12">
        <div className="text-sm text-gray-500">
          선택된 연락처가 없습니다. 조회 후 연락처를 선택해주세요.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          선택된 연락처 ({recipientsList.length}개)
        </h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClearAll}
        >
          전체 해제
        </Button>
      </div>

      <div className="max-h-96 overflow-y-auto rounded-lg border border-gray-200">
        <div className="divide-y divide-gray-200">
          {recipientsList.map((recipient) => {
            const key = getRecipientKey(recipient);

            return (
              <div
                key={key}
                className="flex items-center justify-between gap-3 p-3 hover:bg-gray-50"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {recipient.studentName}
                    </span>
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">
                      {getRecipientTypeLabel(recipient.recipientType)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    {recipient.grade && (
                      <span>{recipient.grade}학년</span>
                    )}
                    <span>{getDivisionLabel(recipient.division)}</span>
                    <span className="font-mono">{recipient.phone}</span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onRemoveRecipient(key)}
                  className="shrink-0"
                >
                  제거
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

