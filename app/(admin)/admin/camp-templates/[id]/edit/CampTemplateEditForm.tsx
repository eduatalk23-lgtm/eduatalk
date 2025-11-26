"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateCampTemplateAction } from "@/app/(admin)/actions/campTemplateActions";
import {
  PlanGroupWizard,
  WizardData,
} from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
import {
  CampTemplate,
  CampProgramType,
} from "@/lib/types/plan";
import { useToast } from "@/components/ui/ToastProvider";
import { BlockSetWithBlocks } from "@/lib/data/blockSets";
import { TemplateFormChecklist } from "../../_components/TemplateFormChecklist";

type CampTemplateEditFormProps = {
  template: CampTemplate;
  initialBlockSets: BlockSetWithBlocks[];
  selectedBlockSetId?: string | null;
};

const programTypes: Array<{ value: CampProgramType; label: string }> = [
  { value: "윈터캠프", label: "윈터캠프" },
  { value: "썸머캠프", label: "썸머캠프" },
  { value: "파이널캠프", label: "파이널캠프" },
  { value: "기타", label: "기타" },
];

const statuses: Array<{
  value: "draft" | "active" | "archived";
  label: string;
}> = [
  { value: "draft", label: "초안" },
  { value: "active", label: "활성" },
  { value: "archived", label: "보관" },
];

export function CampTemplateEditForm({
  template,
  initialBlockSets,
  selectedBlockSetId = null,
}: CampTemplateEditFormProps) {
  const router = useRouter();
  const toast = useToast();

  // template_data에서 템플릿 이름 추출
  const templateData = (template.template_data as Partial<WizardData>) || {};
  const [templateName, setTemplateName] = useState(
    (templateData as Partial<WizardData>).name || template.name || ""
  );
  const [programType, setProgramType] = useState<CampProgramType>(
    template.program_type
  );
  const [description, setDescription] = useState(template.description || "");

  // 날짜 형식 안전하게 변환 (이미 문자열인 경우 처리)
  const formatDateForInput = (dateValue: string | null | undefined): string => {
    if (!dateValue) return "";
    // 이미 YYYY-MM-DD 형식인 경우
    if (
      typeof dateValue === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(dateValue)
    ) {
      return dateValue;
    }
    // ISO 형식인 경우 (YYYY-MM-DDTHH:mm:ss 형식)
    if (typeof dateValue === "string" && dateValue.includes("T")) {
      return dateValue.split("T")[0];
    }
    return "";
  };

  const [campStartDate, setCampStartDate] = useState(
    formatDateForInput(template.camp_start_date)
  );
  const [campEndDate, setCampEndDate] = useState(
    formatDateForInput(template.camp_end_date)
  );
  const [campLocation, setCampLocation] = useState(
    template.camp_location || ""
  );

  const handleTemplateUpdate = async (wizardData: WizardData) => {
    const finalWizardData: WizardData = {
      ...wizardData,
      name: templateName || wizardData.name, // templateName을 우선 사용
    };

    const formData = new FormData();
    formData.append("name", templateName || finalWizardData.name); // templateName을 명시적으로 사용
    formData.append("program_type", programType);
    formData.append("description", description);
    // 상태는 수정 폼에서 변경하지 않음 (액션 버튼으로만 변경)
    formData.append("template_data", JSON.stringify(finalWizardData));
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
  const initialData = {
    ...templateData,
    // 명시적으로 template.id 사용 (항상 최우선)
    templateId: template.id,
    templateProgramType: template.program_type,
    templateStatus: template.status,
    // 학습기간 명시적으로 포함 (templateData에서 가져오기)
    period_start: templateData.period_start || "",
    period_end: templateData.period_end || "",
    // 블록 세트 ID: 연결 테이블에서 가져온 값 우선, 없으면 template_data에서 (하위 호환성)
    block_set_id: selectedBlockSetId || templateData.block_set_id || "",
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

  return (
    <div className="flex flex-col gap-6">
      {/* 기본 정보 체크리스트 */}
      <TemplateFormChecklist name={templateName} programType={programType} />

      {/* 템플릿 메타 정보 입력 섹션 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          템플릿 기본 정보
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {/* 템플릿 이름 */}
          <div className="md:col-span-2">
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
            <label
              htmlFor="program_type"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              프로그램 유형 <span className="text-red-500">*</span>
            </label>
            <select
              id="program_type"
              value={programType}
              onChange={(e) =>
                setProgramType(e.target.value as CampProgramType)
              }
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
            <label
              htmlFor="description"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
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
            <label
              htmlFor="camp_start_date"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
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
            <label
              htmlFor="camp_end_date"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
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
            <label
              htmlFor="camp_location"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
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
          name: templateName, // templateName state와 동기화
          templateId: template.id, // 명시적으로 template.id 전달 (최우선)
        }}
        isTemplateMode={true}
        onTemplateSave={handleTemplateUpdate}
      />
    </div>
  );
}
