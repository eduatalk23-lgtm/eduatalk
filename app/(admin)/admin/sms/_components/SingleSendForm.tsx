"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Label from "@/components/atoms/Label";
import Input from "@/components/atoms/Input";
import Button from "@/components/atoms/Button";
import { useToast } from "@/components/ui/ToastProvider";
import { handleSupabaseError } from "@/lib/utils/errorHandling";
import { TemplateSelector } from "./TemplateSelector";
import { validateSingleSendForm } from "./utils/validateSMSForm";
import type { SMSTemplateType, SMSTemplate } from "@/lib/services/smsTemplates";

type SingleSendFormProps = {
  // 상태
  recipientType: "student" | "mother" | "father";
  customPhone: string;
  selectedStudentName: string;
  message: string;
  selectedTemplate: SMSTemplateType | "";
  selectedTemplateObj: SMSTemplate | null;
  templateVariables: Record<string, string>;
  templates: SMSTemplate[];
  academyName: string;

  // 핸들러
  onRecipientTypeChange: (type: "student" | "mother" | "father") => void;
  onCustomPhoneChange: (phone: string) => void;
  onSelectedStudentNameChange: (name: string) => void;
  onMessageChange: (message: string) => void;
  onTemplateChange: (templateType: SMSTemplateType | "") => void;
  onVariableChange: (variable: string, value: string) => void;
};

export function SingleSendForm({
  recipientType,
  customPhone,
  selectedStudentName,
  message,
  selectedTemplate,
  selectedTemplateObj,
  templateVariables,
  templates,
  academyName,
  onRecipientTypeChange,
  onCustomPhoneChange,
  onSelectedStudentNameChange,
  onMessageChange,
  onTemplateChange,
  onVariableChange,
}: SingleSendFormProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showSuccess, showError } = useToast();

  const handleSend = () => {
    const validation = validateSingleSendForm({
      phone: customPhone,
      message,
    });

    if (!validation.isValid) {
      showError(validation.errors[0].message);
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/purio/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "single",
            phone: customPhone.trim(),
            message: message.trim(),
          }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          showError(result.error || "SMS 발송에 실패했습니다.");
          return;
        }

        showSuccess("SMS가 성공적으로 발송되었습니다.");
        // 결과 페이지로 이동
        setTimeout(() => {
          router.push("/admin/sms/results");
        }, 1000);
      } catch (error: unknown) {
        const errorMessage = handleSupabaseError(error);
        console.error("[SMS] 발송 실패:", error);
        showError(errorMessage || "SMS 발송 중 오류가 발생했습니다.");
      }
    });
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSend();
  };

  return (
    <form onSubmit={handleFormSubmit} className="flex flex-col gap-6">
      {/* 전송 대상자 선택 */}
      <div className="flex flex-col gap-2">
        <Label>전송 대상자</Label>
        <div className="flex gap-4">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="recipientType"
              value="student"
              checked={recipientType === "student"}
              onChange={() => onRecipientTypeChange("student")}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700">학생 본인</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="recipientType"
              value="mother"
              checked={recipientType === "mother"}
              onChange={() => onRecipientTypeChange("mother")}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700">어머니</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="recipientType"
              value="father"
              checked={recipientType === "father"}
              onChange={() => onRecipientTypeChange("father")}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700">아버지</span>
          </label>
        </div>
      </div>

      {/* 수신자 입력 */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">수신자 전화번호 *</Label>
        <Input
          id="phone"
          type="tel"
          placeholder="010-1234-5678"
          value={customPhone}
          onChange={(e) => {
            onCustomPhoneChange(e.target.value);
            if (!e.target.value) {
              onSelectedStudentNameChange("");
            }
          }}
          required
        />
        {selectedStudentName && (
          <p className="text-xs text-gray-600">
            선택된 학생: {selectedStudentName}
          </p>
        )}
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

      {/* 발송 버튼 */}
      <div className="flex justify-end gap-2">
        <Button
          type="submit"
          disabled={isPending || !message.trim() || !customPhone.trim()}
        >
          {isPending ? "발송 중..." : "SMS 발송"}
        </Button>
      </div>
    </form>
  );
}

