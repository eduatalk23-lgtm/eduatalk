"use client";

import { useState } from "react";
import Label from "@/components/atoms/Label";
import { useSMSFormState } from "./hooks/useSMSFormState";
import { SingleSendForm } from "./SingleSendForm";
import { BulkSendForm } from "./BulkSendForm";
import type { SMSFilter } from "./SMSFilterPanel";

type SMSSendFormProps = {
  academyName?: string;
};

export function SMSSendForm({ academyName = "학원" }: SMSSendFormProps) {
  // 폼 상태 관리
  const formState = useSMSFormState({
    academyName,
    initialSendMode: "bulk",
  });

  // 필터 상태 (일괄 발송 모드용)
  const [filter, setFilter] = useState<SMSFilter>({
    search: "",
    grades: [],
    divisions: [],
    recipientTypes: [],
  });

  return (
    <div className="flex flex-col gap-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">SMS 발송</h2>

      {/* 발송 모드 선택 */}
      <div className="flex flex-col gap-2">
        <Label>발송 모드</Label>
        <div className="flex gap-4">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="sendMode"
              value="bulk"
              checked={formState.sendMode === "bulk"}
              onChange={() => {
                formState.setSendMode("bulk");
                formState.resetForm();
              }}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700">일괄 발송</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="sendMode"
              value="single"
              checked={formState.sendMode === "single"}
              onChange={() => {
                formState.setSendMode("single");
                formState.resetForm();
              }}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700">단일 발송</span>
          </label>
        </div>
      </div>

      {/* 발송 모드에 따라 폼 표시 */}
      {formState.sendMode === "single" ? (
        <SingleSendForm
          recipientType={formState.recipientType}
          customPhone={formState.customPhone}
          selectedStudentName={formState.selectedStudentName}
          message={formState.message}
          selectedTemplate={formState.selectedTemplate}
          selectedTemplateObj={formState.selectedTemplateObj ?? null}
          templateVariables={formState.templateVariables}
          templates={formState.templates}
          academyName={academyName}
          onRecipientTypeChange={formState.setRecipientType}
          onCustomPhoneChange={formState.setCustomPhone}
          onSelectedStudentNameChange={formState.setSelectedStudentName}
          onMessageChange={formState.setMessage}
          onTemplateChange={formState.setSelectedTemplate}
          onVariableChange={formState.setTemplateVariables}
        />
      ) : (
        <BulkSendForm
          filter={filter}
          message={formState.message}
          selectedTemplate={formState.selectedTemplate}
          selectedTemplateObj={formState.selectedTemplateObj ?? null}
          templateVariables={formState.templateVariables}
          templates={formState.templates}
          academyName={academyName}
          onFilterChange={setFilter}
          onMessageChange={formState.setMessage}
          onTemplateChange={formState.setSelectedTemplate}
          onVariableChange={formState.setTemplateVariables}
        />
      )}
    </div>
  );
}
