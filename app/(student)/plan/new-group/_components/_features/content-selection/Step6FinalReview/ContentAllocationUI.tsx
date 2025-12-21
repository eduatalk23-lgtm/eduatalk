"use client";

import { WizardData } from "../../../PlanGroupWizard";
import { ContentInfo } from "./types";
import { StrategyWeaknessAllocationEditor } from "./StrategyWeaknessAllocationEditor";

type ContentAllocationUIProps = {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  contentInfos: ContentInfo[];
  editable?: boolean;
};

/**
 * ContentAllocationUI - 콘텐츠별 전략/취약과목 설정 UI
 * 
 * StrategyWeaknessAllocationEditor를 사용하여 일관된 UI 제공
 * 이 컴포넌트는 콘텐츠별 설정만 지원하지만, 통합 컴포넌트를 통해
 * 교과별 설정도 함께 관리할 수 있습니다.
 */
export function ContentAllocationUI({
  data,
  onUpdate,
  contentInfos,
  editable = true,
}: ContentAllocationUIProps) {
  return (
    <StrategyWeaknessAllocationEditor
      data={data}
      onUpdate={onUpdate}
      contentInfos={contentInfos}
      editable={editable}
    />
  );
}
