"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createCampTemplateAction } from "@/lib/domains/camp/actions";
import { PlanGroupWizard, WizardData } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
import { BlockSetWithBlocks } from "@/lib/data/blockSets";
import { CampProgramType } from "@/lib/types/plan";
import { TemplateFormChecklist } from "../_components/TemplateFormChecklist";
import { useToast } from "@/components/ui/ToastProvider";

type CampTemplateFormProps = {
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

export function CampTemplateForm({ initialBlockSets }: CampTemplateFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [programType, setProgramType] = useState<CampProgramType>("기타");
  const [description, setDescription] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [campStartDate, setCampStartDate] = useState("");
  const [campEndDate, setCampEndDate] = useState("");
  const [campLocation, setCampLocation] = useState("");

  const handleTemplateSave = async (wizardData: WizardData) => {
    // 디버깅: wizardData 확인
    console.log("[CampTemplateForm] handleTemplateSave 호출:", {
      has_block_set_id: !!wizardData.block_set_id,
      block_set_id: wizardData.block_set_id,
      wizardDataKeys: Object.keys(wizardData),
    });

    const finalWizardData: WizardData = {
      ...wizardData,
      name: templateName || wizardData.name, // templateName을 우선 사용
    };

    // 디버깅: finalWizardData 확인
    console.log("[CampTemplateForm] finalWizardData:", {
      has_block_set_id: !!finalWizardData.block_set_id,
      block_set_id: finalWizardData.block_set_id,
      template_data_string: JSON.stringify(finalWizardData).substring(0, 200),
    });

    const formData = new FormData();
    formData.append("name", templateName || finalWizardData.name); // templateName을 명시적으로 사용
    formData.append("program_type", programType);
    formData.append("description", description);
    formData.append("status", "draft"); // 템플릿 생성 시 기본값은 draft
    formData.append("template_data", JSON.stringify(finalWizardData));
    
    // 디버깅: FormData 확인
    const templateDataFromForm = formData.get("template_data");
    if (templateDataFromForm) {
      try {
        const parsed = JSON.parse(templateDataFromForm as string);
        console.log("[CampTemplateForm] FormData의 template_data:", {
          has_block_set_id: !!parsed.block_set_id,
          block_set_id: parsed.block_set_id,
        });
      } catch (e) {
        console.error("[CampTemplateForm] FormData 파싱 에러:", e);
      }
    }
    if (campStartDate) {
      formData.append("camp_start_date", campStartDate);
    }
    if (campEndDate) {
      formData.append("camp_end_date", campEndDate);
    }
    if (campLocation) {
      formData.append("camp_location", campLocation);
    }

    const result = await createCampTemplateAction(formData);
    if (!result.success) {
      throw new Error(result.error || "템플릿 저장에 실패했습니다.");
    }

    // 템플릿 저장 성공 후 템플릿 상세 페이지로 리다이렉트
    if (result.templateId) {
      toast.showSuccess("템플릿이 성공적으로 생성되었습니다.");
      router.push(`/admin/camp-templates/${result.templateId}`);
    }
  };


  return (
    <div className="flex flex-col gap-6">
      {/* 기본 정보 체크리스트 */}
      <TemplateFormChecklist name={templateName} programType={programType} />

      {/* 템플릿 메타 정보 입력 섹션 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">템플릿 기본 정보</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {/* 템플릿 이름 */}
          <div className="md:col-span-2">
            <label htmlFor="template_name" className="mb-2 block text-sm font-medium text-gray-700">
              템플릿 이름 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="template_name"
              value={templateName}
              onChange={(e) => {
                setTemplateName(e.target.value);
              }}
              placeholder="템플릿 이름을 입력하세요"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
              required
            />
          </div>

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
          name: templateName,
        }}
        isTemplateMode={true}
        onTemplateSave={handleTemplateSave}
      />
    </div>
  );
}

