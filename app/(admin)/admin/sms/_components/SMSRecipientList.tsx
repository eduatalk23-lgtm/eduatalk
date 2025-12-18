"use client";

import { useMemo } from "react";
import type { SMSRecipient } from "@/app/api/admin/sms/students/route";

type SMSRecipientListProps = {
  recipients: SMSRecipient[];
  selectedRecipients: Map<string, SMSRecipient>;
  onToggleRecipient: (recipient: SMSRecipient) => void;
  isLoading?: boolean;
};

export default function SMSRecipientList({
  recipients,
  selectedRecipients,
  onToggleRecipient,
  isLoading = false,
}: SMSRecipientListProps) {
  // 선택 가능한 연락처 수
  const selectableCount = useMemo(() => recipients.length, [recipients]);

  // 선택된 연락처 수
  const selectedCount = useMemo(
    () => selectedRecipients.size,
    [selectedRecipients]
  );

  // recipient 키 생성
  const getRecipientKey = (recipient: SMSRecipient): string => {
    return `${recipient.studentId}-${recipient.recipientType}`;
  };

  // recipient 선택 여부 확인
  const isRecipientSelected = (recipient: SMSRecipient): boolean => {
    return selectedRecipients.has(getRecipientKey(recipient));
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

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-12">
        <div className="text-sm text-gray-500">조회 중...</div>
      </div>
    );
  }

  if (recipients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-12">
        <div className="text-sm text-gray-500">
          조회 결과가 없습니다. 필터 조건을 변경해주세요.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">조회 결과</h3>
        <div className="text-sm text-gray-600">
          <span className="font-medium text-gray-900">{selectedCount}개 선택됨</span>
          <span className="pl-2 text-gray-500">
            (전체: {selectableCount}개)
          </span>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto rounded-lg border border-gray-200">
        <div className="divide-y divide-gray-200">
          {recipients.map((recipient) => {
            const isSelected = isRecipientSelected(recipient);
            const key = getRecipientKey(recipient);

            return (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-3 p-3 hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggleRecipient(recipient)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
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
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

