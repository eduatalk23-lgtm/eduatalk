"use client";

import { useMemo } from "react";
import { getAllSMSTemplates, type SMSTemplate } from "@/lib/services/smsTemplates";
import type { SMSCustomTemplate } from "@/lib/domains/sms/types";

type CombinedTemplateSelectorProps = {
  customTemplates: SMSCustomTemplate[];
  selectedTemplateId: string;
  onChange: (templateId: string, content: string, variables: string[]) => void;
};

export function CombinedTemplateSelector({
  customTemplates,
  selectedTemplateId,
  onChange,
}: CombinedTemplateSelectorProps) {
  const systemTemplates = useMemo(() => getAllSMSTemplates(), []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;

    if (!id) {
      onChange("", "", []);
      return;
    }

    // 커스텀 템플릿에서 찾기
    const custom = customTemplates.find((t) => t.id === id);
    if (custom) {
      onChange(id, custom.content, custom.variables);
      return;
    }

    // 시스템 템플릿에서 찾기
    const system = systemTemplates.find((t: SMSTemplate) => t.id === id);
    if (system) {
      onChange(id, system.content, system.variables);
    }
  };

  // 카테고리별 그룹핑
  const categoryLabel: Record<string, string> = {
    general: "일반",
    payment: "수납",
    notice: "공지",
    consultation: "상담",
  };

  return (
    <select
      value={selectedTemplateId}
      onChange={handleChange}
      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
    >
      <option value="">직접 작성</option>

      {customTemplates.length > 0 && (
        <optgroup label="내 템플릿">
          {customTemplates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({categoryLabel[t.category] ?? t.category})
            </option>
          ))}
        </optgroup>
      )}

      <optgroup label="시스템 템플릿">
        {systemTemplates.map((t: SMSTemplate) => (
          <option key={t.id} value={t.id}>
            {t.title}
          </option>
        ))}
      </optgroup>
    </select>
  );
}
