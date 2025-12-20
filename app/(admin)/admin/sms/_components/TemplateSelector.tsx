"use client";

import Label from "@/components/atoms/Label";
import Input from "@/components/atoms/Input";
import Select from "@/components/atoms/Select";
import type { SMSTemplateType } from "@/lib/services/smsTemplates";
import type { SMSTemplate } from "@/lib/services/smsTemplates";

type TemplateSelectorProps = {
  templates: SMSTemplate[];
  selectedTemplate: SMSTemplateType | "";
  selectedTemplateObj: SMSTemplate | null;
  templateVariables: Record<string, string>;
  onTemplateChange: (templateType: SMSTemplateType | "") => void;
  onVariableChange: (variable: string, value: string) => void;
};

export function TemplateSelector({
  templates,
  selectedTemplate,
  selectedTemplateObj,
  templateVariables,
  onTemplateChange,
  onVariableChange,
}: TemplateSelectorProps) {
  return (
    <div className="flex flex-col gap-4 lg:col-span-1">
      {/* 템플릿 선택 */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="template">템플릿 선택 (선택사항)</Label>
        <Select
          id="template"
          value={selectedTemplate}
          onChange={(e) => {
            const templateType = e.target.value as SMSTemplateType | "";
            onTemplateChange(templateType);
          }}
        >
          <option value="">템플릿 선택 안 함</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.title}
            </option>
          ))}
        </Select>
      </div>

      {/* 템플릿 변수 입력 (템플릿 선택 시) */}
      {selectedTemplateObj &&
        selectedTemplateObj.variables.length > 0 &&
        selectedTemplateObj.variables.filter(
          (v) => v !== "학원명" && v !== "학생명"
        ).length > 0 && (
          <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <Label className="block text-sm font-medium text-gray-700">
              템플릿 변수 입력
            </Label>
            <div className="flex flex-col gap-2">
              {selectedTemplateObj.variables
                .filter((v) => v !== "학원명" && v !== "학생명")
                .map((variable) => (
                  <div key={variable}>
                    <Label htmlFor={`var-${variable}`} className="text-xs">
                      {variable}
                    </Label>
                    <Input
                      id={`var-${variable}`}
                      type="text"
                      value={templateVariables[variable] || ""}
                      onChange={(e) => onVariableChange(variable, e.target.value)}
                      placeholder={`${variable} 입력`}
                    />
                  </div>
                ))}
            </div>
            <p className="text-xs text-gray-500">
              * 학원명과 학생명은 자동으로 채워집니다.
            </p>
          </div>
        )}
    </div>
  );
}

