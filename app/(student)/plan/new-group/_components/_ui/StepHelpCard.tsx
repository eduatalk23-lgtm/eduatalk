"use client";

import { useState } from "react";
import { HelpCircle, ChevronDown, ChevronUp, Lightbulb } from "lucide-react";

export type StepHelpContent = {
  /** 단계 목적 설명 */
  purpose: string;
  /** 주요 입력 항목 설명 */
  tips?: string[];
  /** 다음 단계 안내 */
  nextStepHint?: string;
};

type StepHelpCardProps = {
  content: StepHelpContent;
  /** 기본 펼침 상태 (기본값: false) */
  defaultOpen?: boolean;
  /** 컴팩트 모드 (모바일용) */
  compact?: boolean;
};

/**
 * 위저드 단계별 도움말 카드
 *
 * 각 단계의 목적과 입력 가이드를 제공합니다.
 * 접기/펼치기 가능하며, 처음 사용자에게 단계별 안내를 제공합니다.
 */
export function StepHelpCard({
  content,
  defaultOpen = false,
  compact = false,
}: StepHelpCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30">
      {/* 헤더 - 항상 표시 */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-blue-100/50 dark:hover:bg-blue-900/30"
        aria-expanded={isOpen}
        aria-controls="step-help-content"
      >
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
            {compact ? "도움말" : "이 단계는 무엇인가요?"}
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        )}
      </button>

      {/* 콘텐츠 - 펼쳤을 때만 표시 */}
      {isOpen && (
        <div
          id="step-help-content"
          className="border-t border-blue-200 px-4 py-3 dark:border-blue-800"
        >
          {/* 목적 설명 */}
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {content.purpose}
          </p>

          {/* 팁 목록 */}
          {content.tips && content.tips.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {content.tips.map((tip, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400"
                >
                  <Lightbulb className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          )}

          {/* 다음 단계 힌트 */}
          {content.nextStepHint && (
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-500">
              💡 {content.nextStepHint}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 위저드 단계별 도움말 콘텐츠 정의
 */
export const STEP_HELP_CONTENTS: Record<string, StepHelpContent> = {
  step1: {
    purpose:
      "학습 플랜의 기본 정보를 설정합니다. 플랜 이름, 학습 목적, 기간을 정하고 일정 유형을 선택합니다.",
    tips: [
      "플랜 이름은 나중에 쉽게 찾을 수 있도록 구체적으로 작성하세요",
      "학습 목적에 따라 시스템이 적합한 스케줄을 추천해드립니다",
      "슬롯 모드는 정해진 시간표에 맞춰 학습하고 싶을 때 선택하세요",
    ],
    nextStepHint: "다음 단계에서 세부 시간 설정을 진행합니다",
  },
  step2: {
    purpose:
      "학습 가능한 요일과 시간을 설정합니다. 블록 세트를 선택하거나 새로 만들어서 학습 시간표를 정합니다.",
    tips: [
      "블록 세트는 요일별 학습 가능 시간을 미리 정의한 템플릿입니다",
      "제외일을 설정하면 시험, 여행 등 학습이 어려운 날을 건너뜁니다",
      "슬롯 모드에서는 시간대별로 세분화된 스케줄을 설정할 수 있습니다",
    ],
    nextStepHint: "다음 단계에서 학습할 콘텐츠를 선택합니다",
  },
  step3: {
    purpose:
      "플랜에 포함할 학습 콘텐츠를 선택합니다. 교재, 강의, 또는 직접 만든 콘텐츠를 추가할 수 있습니다.",
    tips: [
      "여러 콘텐츠를 하나의 플랜에 추가할 수 있습니다",
      "추천 콘텐츠는 학습 패턴을 분석하여 제안됩니다",
      "콘텐츠별로 학습 범위(시작~끝 페이지/회차)를 설정합니다",
    ],
    nextStepHint: "다음 단계에서 일정 미리보기를 확인합니다",
  },
  step4: {
    purpose:
      "생성될 학습 일정을 미리 확인합니다. 일별 학습량과 전체 일정 분포를 검토할 수 있습니다.",
    tips: [
      "일일 학습량이 너무 많으면 기간을 늘리거나 콘텐츠를 줄이세요",
      "특정 날짜의 학습량이 부담되면 제외일로 설정할 수 있습니다",
      "학습 가능 시간과 콘텐츠 분량에 따라 자동 배분됩니다",
    ],
    nextStepHint: "다음 단계에서 학습량을 세부 조정합니다",
  },
  step5: {
    purpose:
      "일별 학습량을 세부 조정합니다. 자동 배분된 분량을 수정하거나 특정 날짜에 더 많은 학습을 배치할 수 있습니다.",
    tips: [
      "중요한 시험 전날에는 복습 시간을 확보하세요",
      "주말에 더 많은 학습량을 배치할 수 있습니다",
      "드래그 앤 드롭으로 순서를 변경할 수 있습니다",
    ],
    nextStepHint: "다음 단계에서 최종 확인 후 플랜을 생성합니다",
  },
  step6: {
    purpose:
      "모든 설정을 최종 확인합니다. 플랜 정보, 콘텐츠, 일정을 검토하고 수정이 필요하면 이전 단계로 돌아갈 수 있습니다.",
    tips: [
      "모든 정보가 정확한지 꼼꼼히 확인하세요",
      "플랜 생성 후에도 일정 재조정이 가능합니다",
      "생성된 플랜은 '오늘 할 일'에서 바로 시작할 수 있습니다",
    ],
    nextStepHint: "'플랜 생성' 버튼을 눌러 학습을 시작하세요!",
  },
  step7: {
    purpose:
      "생성된 학습 플랜을 확인합니다. 일정별 또는 콘텐츠별로 스케줄을 검토하고, 필요하면 재생성할 수 있습니다.",
    tips: [
      "일정이 마음에 들지 않으면 '플랜 재생성' 버튼으로 다시 생성할 수 있습니다",
      "이전 단계 설정을 변경하면 플랜 재생성이 필요합니다",
      "'완료' 버튼을 누르면 플랜이 활성화되어 바로 학습을 시작할 수 있습니다",
    ],
    nextStepHint: "'완료' 버튼을 눌러 플랜을 활성화하세요!",
  },
};
