"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCampTemplateDraftAction } from "@/app/(admin)/actions/campTemplateActions";
import { CampProgramType } from "@/lib/types/plan";
import { useToast } from "@/components/ui/ToastProvider";

const programTypes: Array<{ value: CampProgramType; label: string }> = [
  { value: "윈터캠프", label: "윈터캠프" },
  { value: "썸머캠프", label: "썸머캠프" },
  { value: "파이널캠프", label: "파이널캠프" },
  { value: "기타", label: "기타" },
];

export function NewCampTemplateForm() {
  const router = useRouter();
  const toast = useToast();
  const [templateName, setTemplateName] = useState("");
  const [programType, setProgramType] = useState<CampProgramType>("기타");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!templateName.trim()) {
      toast.showError("템플릿 이름을 입력해주세요.");
      return;
    }

    if (!programType) {
      toast.showError("프로그램 유형을 선택해주세요.");
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("name", templateName.trim());
      formData.append("program_type", programType);

      const result = await createCampTemplateDraftAction(formData);

      if (!result.success) {
        throw new Error(result.error || "템플릿 생성에 실패했습니다.");
      }

      if (result.templateId) {
        toast.showSuccess("템플릿이 생성되었습니다. 이제 상세 정보를 입력하세요.");
        router.push(`/admin/camp-templates/${result.templateId}/edit`);
      }
    } catch (error) {
      console.error("[NewCampTemplateForm] 템플릿 생성 실패:", error);
      toast.showError(
        error instanceof Error
          ? error.message
          : "템플릿 생성에 실패했습니다."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 템플릿 이름 */}
        <div>
          <label
            htmlFor="template_name"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            템플릿 이름 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="template_name"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="템플릿 이름을 입력하세요"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
            required
            disabled={isSubmitting}
          />
        </div>

        {/* 프로그램 유형 */}
        <div>
          <label
            htmlFor="program_type"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            프로그램 유형 <span className="text-red-500">*</span>
          </label>
          <select
            id="program_type"
            value={programType}
            onChange={(e) => setProgramType(e.target.value as CampProgramType)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
            required
            disabled={isSubmitting}
          >
            {programTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* 안내 메시지 */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm text-blue-800">
            템플릿 생성 후 상세 정보(블록 세트, 학습 기간, 콘텐츠 등)를 입력할 수 있습니다.
          </p>
        </div>

        {/* 제출 버튼 */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSubmitting}
          >
            취소
          </button>
          <button
            type="submit"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? "생성 중..." : "템플릿 생성 시작"}
          </button>
        </div>
      </form>
    </div>
  );
}

