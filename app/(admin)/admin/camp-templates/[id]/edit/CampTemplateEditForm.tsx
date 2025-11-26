"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateCampTemplateAction } from "@/app/(admin)/actions/campTemplateActions";
import { PlanGroupWizard, WizardData } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
import { CampTemplate, CampProgramType } from "@/lib/types/plan";
import { useToast } from "@/components/ui/ToastProvider";
import { BlockSetWithBlocks } from "@/lib/data/blockSets";
import { TemplateFormChecklist } from "../../_components/TemplateFormChecklist";

type CampTemplateEditFormProps = {
  template: CampTemplate;
  initialBlockSets: BlockSetWithBlocks[];
};

const programTypes: Array<{ value: CampProgramType; label: string }> = [
  { value: "윈터캠프", label: "윈터캠프" },
  { value: "썸머캠프", label: "썸머캠프" },
  { value: "파이널캠프", label: "파이널캠프" },
  { value: "기타", label: "기타" },
];

const statuses: Array<{ value: "draft" | "active" | "archived"; label: string }> = [
  { value: "draft", label: "초안" },
  { value: "active", label: "활성" },
  { value: "archived", label: "보관" },
];

export function CampTemplateEditForm({ template, initialBlockSets }: CampTemplateEditFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [programType, setProgramType] = useState<CampProgramType>(template.program_type);
  const [description, setDescription] = useState(template.description || "");
  const [status, setStatus] = useState<"draft" | "active" | "archived">(template.status);
  const [campStartDate, setCampStartDate] = useState(
    template.camp_start_date ? template.camp_start_date.split("T")[0] : ""
  );
  const [campEndDate, setCampEndDate] = useState(
    template.camp_end_date ? template.camp_end_date.split("T")[0] : ""
  );
  const [campLocation, setCampLocation] = useState(template.camp_location || "");

  const handleTemplateUpdate = async (wizardData: WizardData) => {
    const formData = new FormData();
    formData.append("name", wizardData.name);
    formData.append("program_type", programType);
    formData.append("description", description);
    formData.append("status", status);
    formData.append("template_data", JSON.stringify(wizardData));
    if (campStartDate) {
      formData.append("camp_start_date", campStartDate);
    }
    if (campEndDate) {
      formData.append("camp_end_date", campEndDate);
    }
    if (campLocation) {
      formData.append("camp_location", campLocation);
    }

    const result = await updateCampTemplateAction(template.id, formData);
    if (!result.success) {
      throw new Error(result.error || "템플릿 수정에 실패했습니다.");
    }

    toast.showSuccess("템플릿이 성공적으로 수정되었습니다.");
    router.push(`/admin/camp-templates/${template.id}`);
  };

  // template_data를 initialData로 변환
  // templateId는 항상 template.id로 설정 (template_data에 있더라도 덮어쓰기)
  const templateData = (template.template_data as Partial<WizardData>) || {};
  const initialData = {
    ...templateData,
    // 명시적으로 template.id 사용 (항상 최우선)
    templateId: template.id,
    templateProgramType: template.program_type,
    templateStatus: template.status,
  };

  // 디버깅: templateId 확인 (개발 환경에서만)
  if (process.env.NODE_ENV === "development" && !initialData.templateId) {
    console.error("[CampTemplateEditForm] templateId가 없습니다:", {
      templateId: template.id,
      templateData,
      initialData,
    });
  }

  // templateId가 제대로 전달되는지 확인
  if (!initialData.templateId) {
    console.error("[CampTemplateEditForm] templateId가 없습니다:", {
      templateId: template.id,
      initialData,
    });
  }

  // 템플릿 이름 추출 (WizardData에서)
  const templateName = (templateData as Partial<WizardData>).name || "";

  return (
    <div className="flex flex-col gap-6">
      {/* 기본 정보 체크리스트 */}
      <TemplateFormChecklist name={templateName} programType={programType} />

      {/* 템플릿 메타 정보 입력 섹션 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">템플릿 기본 정보</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {/* 프로그램 유형 */}
          <div>
            <label htmlFor="program_type" className="mb-2 block text-sm font-medium text-gray-700">
              프로그램 유형 <span className="text-red-500">*</span>
            </label>
            <select
              id="program_type"
              value={programType}
              onChange={(e) => setProgramType(e.target.value as CampProgramType)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
              required
            >
              {programTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* 상태 */}
          <div>
            <label htmlFor="status" className="mb-2 block text-sm font-medium text-gray-700">
              상태
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as "draft" | "active" | "archived")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
            >
              {statuses.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* 설명 */}
          <div className="md:col-span-2">
            <label htmlFor="description" className="mb-2 block text-sm font-medium text-gray-700">
              설명
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="템플릿에 대한 설명을 입력하세요. (선택사항)"
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
            />
          </div>

          {/* 캠프 기간 */}
          <div>
            <label htmlFor="camp_start_date" className="mb-2 block text-sm font-medium text-gray-700">
              캠프 시작일
            </label>
            <input
              type="date"
              id="camp_start_date"
              value={campStartDate}
              onChange={(e) => setCampStartDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="camp_end_date" className="mb-2 block text-sm font-medium text-gray-700">
              캠프 종료일
            </label>
            <input
              type="date"
              id="camp_end_date"
              value={campEndDate}
              onChange={(e) => setCampEndDate(e.target.value)}
              min={campStartDate || undefined}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
            />
          </div>

          {/* 캠프 장소 */}
          <div className="md:col-span-2">
            <label htmlFor="camp_location" className="mb-2 block text-sm font-medium text-gray-700">
              캠프 장소
            </label>
            <input
              type="text"
              id="camp_location"
              value={campLocation}
              onChange={(e) => setCampLocation(e.target.value)}
              placeholder="캠프 장소를 입력하세요. (선택사항)"
              maxLength={200}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* 플랜 그룹 위저드 */}
      <PlanGroupWizard
        initialBlockSets={initialBlockSets}
        initialContents={{ books: [], lectures: [], custom: [] }}
        initialData={{
          ...initialData,
          templateId: template.id, // 명시적으로 template.id 전달 (최우선)
        }}
        isTemplateMode={true}
        onTemplateSave={handleTemplateUpdate}
      />
    </div>
  );
}
