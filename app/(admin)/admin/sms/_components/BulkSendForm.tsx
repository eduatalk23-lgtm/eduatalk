"use client";

import { useState, useTransition, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Label from "@/components/atoms/Label";
import Button from "@/components/atoms/Button";
import { useToast } from "@/components/ui/ToastProvider";
import { handleSupabaseError } from "@/lib/utils/errorHandling";
import SMSFilterPanel, { type SMSFilter } from "./SMSFilterPanel";
import SMSRecipientList from "./SMSRecipientList";
import SelectedRecipientsList from "./SelectedRecipientsList";
import { TemplateSelector } from "./TemplateSelector";
import { SMSPreviewModal } from "./SMSPreviewModal";
import { SMSSendSummary } from "./SMSSendSummary";
import { validateBulkSendForm } from "./utils/validateSMSForm";
import { useRecipientSearch } from "./hooks/useRecipientSearch";
import type { SMSRecipient } from "@/app/api/admin/sms/students/route";
import type { SMSTemplateType, SMSTemplate } from "@/lib/services/smsTemplates";

type BulkSendFormProps = {
  // 상태
  filter: SMSFilter;
  message: string;
  selectedTemplate: SMSTemplateType | "";
  selectedTemplateObj: SMSTemplate | null;
  templateVariables: Record<string, string>;
  templates: SMSTemplate[];
  academyName: string;
  sendTime?: string;

  // 핸들러
  onFilterChange: (filter: SMSFilter) => void;
  onMessageChange: (message: string) => void;
  onTemplateChange: (templateType: SMSTemplateType | "") => void;
  onVariableChange: (variable: string, value: string) => void;
};

export function BulkSendForm({
  filter,
  message,
  selectedTemplate,
  selectedTemplateObj,
  templateVariables,
  templates,
  academyName,
  sendTime,
  onFilterChange,
  onMessageChange,
  onTemplateChange,
  onVariableChange,
}: BulkSendFormProps) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [isPending, startTransition] = useTransition();
  const [showPreview, setShowPreview] = useState(false);

  // 수신자 검색 훅
  const { queryResults, isLoadingResults, handleSearch } = useRecipientSearch({
    filter,
    onFilterChange,
  });

  // 선택된 연락처 (누적 선택)
  const [selectedRecipients, setSelectedRecipients] = useState<
    Map<string, SMSRecipient>
  >(new Map());

  // recipient 키 생성
  const getRecipientKey = useCallback((recipient: SMSRecipient): string => {
    return `${recipient.studentId}-${recipient.recipientType}`;
  }, []);

  // 연락처 선택/해제
  const handleToggleRecipient = useCallback(
    (recipient: SMSRecipient) => {
      setSelectedRecipients((prev) => {
        const next = new Map(prev);
        const key = getRecipientKey(recipient);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.set(key, recipient);
        }
        return next;
      });
    },
    [getRecipientKey]
  );

  // 연락처 제거
  const handleRemoveRecipient = useCallback((key: string) => {
    setSelectedRecipients((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  // 전체 해제
  const handleClearAllRecipients = useCallback(() => {
    setSelectedRecipients(new Map());
  }, []);

  // 선택된 연락처 목록 (배열)
  const selectedRecipientsList = useMemo(() => {
    return Array.from(selectedRecipients.values());
  }, [selectedRecipients]);

  // 발송 실행
  const handleSend = useCallback(() => {
    setShowPreview(false);

    startTransition(async () => {
      try {
        const recipients = selectedRecipientsList.map((r) => ({
          studentId: r.studentId,
          phone: r.phone,
          recipientType: r.recipientType,
        }));

        const response = await fetch("/api/purio/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "bulk",
            recipients,
            message: message.trim(),
            templateVariables: {
              ...templateVariables,
              학원명: academyName,
            },
            ...(sendTime && { sendTime }),
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          showError(result.error || "SMS 발송에 실패했습니다.");
          return;
        }

        if (result.success > 0) {
          const actionText = sendTime ? "예약 발송" : "발송";
          showSuccess(
            `${result.success}명에게 SMS가 성공적으로 ${actionText}되었습니다.${
              result.failed > 0 ? ` (${result.failed}명 실패)` : ""
            }`
          );
          // 결과 페이지로 이동
          setTimeout(() => {
            router.push("/admin/sms/results");
          }, 1000);
        } else {
          showError(
            result.errors && result.errors.length > 0
              ? result.errors[0].error
              : "SMS 발송에 실패했습니다."
          );
        }
      } catch (error: unknown) {
        const errorMessage = handleSupabaseError(error);
        console.error("[SMS] 발송 실패:", error);
        showError(errorMessage || "SMS 발송 중 오류가 발생했습니다.");
      }
    });
  }, [
    selectedRecipientsList,
    message,
    templateVariables,
    academyName,
    sendTime,
    startTransition,
    showSuccess,
    showError,
    router,
  ]);

  // 폼 제출
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const validation = validateBulkSendForm({
      selectedRecipientsCount: selectedRecipients.size,
      message,
    });

    if (!validation.isValid) {
      showError(validation.errors[0].message);
      return;
    }

    // 미리보기 표시
    if (selectedRecipients.size > 0) {
      setShowPreview(true);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* 발송 대상자 선택 */}
        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:gap-6">
          {/* 필터 패널 */}
          <div className="lg:col-span-1">
            <SMSFilterPanel
              filter={filter}
              onFilterChange={onFilterChange}
              onSearch={handleSearch}
              isLoading={isLoadingResults}
            />
          </div>

          {/* 조회 결과 및 선택된 연락처 */}
          <div className="flex flex-col gap-6 lg:col-span-1">
            {/* 조회 결과 */}
            {queryResults.length > 0 && (
              <SMSRecipientList
                recipients={queryResults}
                selectedRecipients={selectedRecipients}
                onToggleRecipient={handleToggleRecipient}
                isLoading={isLoadingResults}
              />
            )}

            {/* 선택된 연락처 목록 */}
            {selectedRecipients.size > 0 && (
              <SelectedRecipientsList
                selectedRecipients={selectedRecipients}
                onRemoveRecipient={handleRemoveRecipient}
                onClearAll={handleClearAllRecipients}
              />
            )}

            {/* 조회 결과가 없을 때 안내 */}
            {queryResults.length === 0 && !isLoadingResults && (
              <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
                <p className="text-sm text-gray-500">
                  필터를 설정하고 조회 버튼을 클릭하여 발송 대상을 검색하세요.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 템플릿 선택 및 메시지 입력 섹션 */}
        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:gap-6">
          <TemplateSelector
            templates={templates}
            selectedTemplate={selectedTemplate}
            selectedTemplateObj={selectedTemplateObj}
            templateVariables={templateVariables}
            onTemplateChange={onTemplateChange}
            onVariableChange={onVariableChange}
          />

          {/* 메시지 내용 */}
          <div className="flex flex-col gap-1 lg:col-span-1">
            <Label htmlFor="message">메시지 내용 *</Label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => onMessageChange(e.target.value)}
              placeholder="메시지 내용을 입력하세요..."
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              rows={4}
              required
            />
            <p className="text-xs text-gray-500">
              {message.length}자 / SMS는 90자, LMS는 2000자까지 가능합니다.
            </p>
          </div>
        </div>

        {/* 발송 요약 */}
        {selectedRecipients.size > 0 && (
          <SMSSendSummary
            recipientCount={selectedRecipients.size}
            messageLength={message.length}
            sendTime={sendTime}
          />
        )}

        {/* 발송 버튼 */}
        <div className="flex justify-end gap-2">
          {selectedRecipients.size > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowPreview(true)}
              disabled={isPending || !message.trim()}
            >
              미리보기
            </Button>
          )}
          <Button
            type="submit"
            disabled={
              isPending ||
              !message.trim() ||
              selectedRecipients.size === 0
            }
          >
            {isPending ? "발송 중..." : sendTime ? "예약 발송" : "SMS 발송"}
          </Button>
        </div>
      </form>

      {/* 미리보기 모달 */}
      <SMSPreviewModal
        open={showPreview}
        onClose={() => setShowPreview(false)}
        onConfirm={handleSend}
        selectedRecipients={selectedRecipientsList}
        message={message}
        templateType={selectedTemplate || undefined}
        templateVariables={templateVariables}
        academyName={academyName}
        isSending={isPending}
        sendTime={sendTime}
      />
    </>
  );
}

