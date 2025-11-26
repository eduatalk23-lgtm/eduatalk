import { WizardData } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
import { CampTemplate } from "@/lib/types/plan";

export type ChecklistItem = {
  id: string;
  label: string;
  checked: boolean;
  description?: string;
  category: "basic" | "template_data" | "wizard_data";
};

/**
 * 캠프 템플릿 필수요소 체크리스트 생성
 */
export function getCampTemplateChecklist(template: CampTemplate): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  
  // 기본 정보 필수 항목
  items.push({
    id: "name",
    label: "템플릿명",
    checked: !!template.name && template.name.trim().length > 0,
    description: "템플릿의 이름을 입력해주세요",
    category: "basic",
  });

  items.push({
    id: "program_type",
    label: "프로그램 유형",
    checked: !!template.program_type,
    description: "프로그램 유형을 선택해주세요 (윈터캠프, 썸머캠프, 파이널캠프, 기타)",
    category: "basic",
  });

  // 템플릿 데이터 검증
  const templateData = template.template_data as Partial<WizardData> | null;
  const hasTemplateData = !!templateData;

  items.push({
    id: "template_data",
    label: "템플릿 데이터",
    checked: hasTemplateData,
    description: "템플릿 데이터가 필요합니다",
    category: "template_data",
  });

  if (hasTemplateData) {
    const lockedFields = templateData.templateLockedFields?.step1 || {};
    
    // 학생 입력 허용 필드 확인 헬퍼
    const isStudentInputAllowed = (fieldName: string): boolean => {
      const allowFieldName = `allow_student_${fieldName}` as keyof typeof lockedFields;
      return lockedFields[allowFieldName] === true;
    };

    // 기간 정보 (학생 입력 허용이 아닐 때만 필수)
    if (!isStudentInputAllowed("period")) {
      items.push({
        id: "period",
        label: "학습 기간",
        checked: !!(
          templateData.period_start &&
          templateData.period_end &&
          templateData.period_start.trim().length > 0 &&
          templateData.period_end.trim().length > 0
        ),
        description: "학습 시작일과 종료일을 설정해주세요",
        category: "wizard_data",
      });
    }

    // 블록 세트는 기본값 옵션이 추가되어 체크리스트에서 제외

    // 스케줄러 유형 (학생 입력 허용이 아닐 때만 필수)
    if (!isStudentInputAllowed("scheduler_type")) {
      items.push({
        id: "scheduler_type",
        label: "스케줄러 유형",
        checked: !!templateData.scheduler_type && templateData.scheduler_type.trim().length > 0,
        description: "스케줄러 유형을 선택해주세요",
        category: "wizard_data",
      });
    }

    // 학생 수준 항목이 삭제되어 체크리스트에서 제외
    // 과목 배정은 학생 입력폼 제출 후 관리자 영역이므로 체크리스트에서 제외
  }

  return items;
}

/**
 * 체크리스트 완료율 계산
 */
export function getChecklistCompletion(items: ChecklistItem[]): {
  completed: number;
  total: number;
  percentage: number;
} {
  const completed = items.filter((item) => item.checked).length;
  const total = items.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { completed, total, percentage };
}

/**
 * 카테고리별로 그룹화
 */
export function groupChecklistByCategory(items: ChecklistItem[]): {
  basic: ChecklistItem[];
  template_data: ChecklistItem[];
  wizard_data: ChecklistItem[];
} {
  return {
    basic: items.filter((item) => item.category === "basic"),
    template_data: items.filter((item) => item.category === "template_data"),
    wizard_data: items.filter((item) => item.category === "wizard_data"),
  };
}

