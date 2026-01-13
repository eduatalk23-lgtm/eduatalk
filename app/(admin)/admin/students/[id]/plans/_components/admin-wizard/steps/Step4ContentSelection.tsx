"use client";

/**
 * Step 4: 콘텐츠 선택
 *
 * Phase 3: 7단계 위저드 확장
 * - 학생의 콘텐츠 목록 표시
 * - 콘텐츠 선택/해제
 * - 범위 설정 (시작/종료)
 * - 과목별 전략/약점 분류
 * - 마스터 콘텐츠 검색 및 추가 기능
 *
 * 탭 기반 UI 리팩토링 (Sprint 1)
 * - 학생 콘텐츠 탭
 * - 마스터 검색 탭
 * - 선택 요약 탭
 *
 * @module app/(admin)/admin/students/[id]/plans/_components/admin-wizard/steps/Step4ContentSelection
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  BookOpen,
  Video,
  Check,
  Loader2,
  ChevronDown,
  ChevronUp,
  Zap,
  Target,
  AlertCircle,
  Package,
  X,
  ListChecks,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  getStudentContentsForAdmin,
  type StudentContentItem,
} from "@/lib/domains/admin-plan/actions";
import { getBatchPlanRoundsAction } from "@/lib/domains/admin-plan/actions/getPlanRound";
import { generatePlanName } from "@/lib/domains/admin-plan/utils/planNaming";
import {
  useAdminWizardData,
  useAdminWizardValidation,
} from "../_context";
import type { SelectedContent, SubjectType } from "../_context/types";
import { SUBJECT_TYPE_OPTIONS } from "@/lib/domains/admin-plan/types";
import { MasterContentSearchModal } from "./_components/MasterContentSearchModal";

/**
 * 탭 타입 정의
 */
type ContentTab = "student" | "master" | "summary";

/**
 * Step4ContentSelection Props
 */
interface Step4ContentSelectionProps {
  studentId: string;
  tenantId: string;
}

const WEEKLY_DAYS_OPTIONS: { value: 2 | 3 | 4 | null; label: string }[] = [
  { value: null, label: "미지정" },
  { value: 2, label: "2일" },
  { value: 3, label: "3일" },
  { value: 4, label: "4일" },
];

/**
 * Step 4: 콘텐츠 선택 컴포넌트
 */
export function Step4ContentSelection({
  studentId,
  tenantId,
}: Step4ContentSelectionProps) {
  const { wizardData, updateData } = useAdminWizardData();
  const { setFieldError, clearFieldError } = useAdminWizardValidation();

  const { selectedContents, skipContents } = wizardData;

  // 탭 상태
  const [activeTab, setActiveTab] = useState<ContentTab>("student");

  const [contents, setContents] = useState<StudentContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [masterSearchModalOpen, setMasterSearchModalOpen] = useState(false);

  // 이미 선택된 콘텐츠 ID 집합 (중복 방지용)
  const existingContentIds = useMemo(() => {
    return new Set(selectedContents.map((c) => c.contentId));
  }, [selectedContents]);

  // 이름 생성 중복 방지용 ref
  const isGeneratingNamesRef = useRef(false);
  const lastProcessedContentsRef = useRef<string>("");

  // 콘텐츠 이름 자동 생성 (회차 계산 포함)
  useEffect(() => {
    const generateNames = async () => {
      // 빈 배열이거나 이미 처리 중이면 스킵
      if (selectedContents.length === 0 || isGeneratingNamesRef.current) {
        return;
      }

      // 변경 감지용 키 생성 (contentId + range)
      const currentKey = selectedContents
        .map((c) => `${c.contentId}:${c.startRange}-${c.endRange}`)
        .join("|");

      // 동일한 내용이면 스킵
      if (currentKey === lastProcessedContentsRef.current) {
        return;
      }

      // 회차 계산이 필요한 콘텐츠가 있는지 확인
      const needsRoundCalculation = selectedContents.some(
        (c) => c.round === undefined
      );

      isGeneratingNamesRef.current = true;

      try {
        // 회차 계산이 필요한 콘텐츠만 API 호출
        let roundMap = new Map<string, number>();
        if (needsRoundCalculation) {
          const contentsForRound = selectedContents
            .filter((c) => c.round === undefined)
            .map((c) => ({
              contentId: c.contentId,
              contentType: c.contentType,
            }));

          if (contentsForRound.length > 0) {
            roundMap = await getBatchPlanRoundsAction(studentId, contentsForRound);
          }
        }

        // 이름 생성 및 업데이트 (범위가 변경되면 항상 재생성)
        const updatedContents = selectedContents.map((content) => {
          const newRound = content.round ?? roundMap.get(content.contentId) ?? 1;

          const { groupName } = generatePlanName({
            subject: content.subject,
            contentTitle: content.title,
            startRange: content.startRange,
            endRange: content.endRange,
            contentType: content.contentType,
            round: newRound,
          });

          return {
            ...content,
            generatedGroupName: groupName,
            round: newRound,
          };
        });

        // 변경사항이 있으면 업데이트
        const hasChanges = updatedContents.some(
          (updated, i) =>
            updated.generatedGroupName !== selectedContents[i].generatedGroupName ||
            updated.round !== selectedContents[i].round
        );

        if (hasChanges) {
          updateData({ selectedContents: updatedContents });
        }

        lastProcessedContentsRef.current = currentKey;
      } catch (error) {
        console.error("[Step4] 이름 생성 실패:", error);
      } finally {
        isGeneratingNamesRef.current = false;
      }
    };

    generateNames();
  }, [selectedContents, studentId, updateData]);

  // 콘텐츠 로드 함수
  const loadContents = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getStudentContentsForAdmin(studentId, tenantId);

      if ("success" in result && result.success === false) {
        console.error("[Step4] 콘텐츠 로드 실패:", result.error);
        setFieldError("contents", "콘텐츠를 불러오는데 실패했습니다.");
        return;
      }

      const data = result as { contents: StudentContentItem[] };
      setContents(data.contents);
      clearFieldError("contents");
    } catch (error) {
      console.error("[Step4] 콘텐츠 로드 실패:", error);
      setFieldError("contents", "콘텐츠를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [studentId, tenantId, setFieldError, clearFieldError]);

  // 초기 로드
  useEffect(() => {
    loadContents();
  }, [loadContents]);

  // 선택 여부 확인
  const isSelected = useCallback(
    (contentId: string) => selectedContents.some((c) => c.contentId === contentId),
    [selectedContents]
  );

  // 선택된 콘텐츠 찾기
  const getSelectedContent = useCallback(
    (contentId: string) => selectedContents.find((c) => c.contentId === contentId),
    [selectedContents]
  );

  // 콘텐츠 토글
  const handleToggle = useCallback(
    (item: StudentContentItem) => {
      const existing = getSelectedContent(item.id);
      if (existing) {
        // 선택 해제
        updateData({
          selectedContents: selectedContents.filter((c) => c.contentId !== item.id),
        });
      } else {
        // 선택 추가 (최대 9개)
        if (selectedContents.length >= 9) return;

        const newContent: SelectedContent = {
          contentId: item.id,
          contentType: item.type,
          title: item.title,
          subject: item.subject ?? undefined,
          startRange: 1,
          endRange: item.totalRange,
          totalRange: item.totalRange,
          subjectType: null,
          displayOrder: selectedContents.length,
        };
        updateData({
          selectedContents: [...selectedContents, newContent],
        });
      }
    },
    [selectedContents, getSelectedContent, updateData]
  );

  // 범위 업데이트
  const handleUpdateRange = useCallback(
    (contentId: string, startRange: number, endRange: number) => {
      updateData({
        selectedContents: selectedContents.map((c) =>
          c.contentId === contentId ? { ...c, startRange, endRange } : c
        ),
      });
    },
    [selectedContents, updateData]
  );

  // 과목 타입 업데이트
  const handleUpdateSubjectType = useCallback(
    (contentId: string, subjectType: SubjectType) => {
      updateData({
        selectedContents: selectedContents.map((c) =>
          c.contentId === contentId
            ? {
                ...c,
                subjectType,
                // 전략과목이 아니면 weeklyDays 초기화
                weeklyDays: subjectType === "strategy" ? c.weeklyDays : null,
              }
            : c
        ),
      });
    },
    [selectedContents, updateData]
  );

  // 주간 배정일 업데이트 (전략 과목 전용)
  const handleUpdateWeeklyDays = useCallback(
    (contentId: string, weeklyDays: 2 | 3 | 4 | null) => {
      updateData({
        selectedContents: selectedContents.map((c) =>
          c.contentId === contentId ? { ...c, weeklyDays } : c
        ),
      });
    },
    [selectedContents, updateData]
  );

  // 건너뛰기 토글
  const handleSkipToggle = useCallback(
    (skip: boolean) => {
      updateData({ skipContents: skip });
    },
    [updateData]
  );

  // 마스터 콘텐츠에서 선택된 콘텐츠 추가
  const handleMasterContentSelect = useCallback(
    async (content: SelectedContent) => {
      // 최대 개수 체크
      if (selectedContents.length >= 9) {
        alert("최대 9개의 콘텐츠를 선택할 수 있습니다.");
        return;
      }

      // 중복 체크
      if (existingContentIds.has(content.contentId)) {
        alert("이미 추가된 콘텐츠입니다.");
        return;
      }

      // 콘텐츠 추가
      updateData({
        selectedContents: [
          ...selectedContents,
          {
            ...content,
            displayOrder: selectedContents.length,
          },
        ],
      });

      // 콘텐츠 목록 새로고침 (새로 추가된 학생 콘텐츠 반영)
      await loadContents();

      // 모달 닫기
      setMasterSearchModalOpen(false);
    },
    [selectedContents, existingContentIds, updateData, loadContents]
  );

  // 확장 토글
  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">콘텐츠 로딩 중...</span>
      </div>
    );
  }

  if (contents.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-gray-400" />
          <p className="mt-2 text-sm text-gray-600">
            학생에게 등록된 콘텐츠가 없습니다.
          </p>
          <p className="mt-1 text-xs text-gray-500">
            마스터 콘텐츠에서 검색하여 추가하거나, 콘텐츠 없이 플랜 그룹을 생성할 수 있습니다.
          </p>
          {/* 마스터에서 추가 버튼 */}
          <button
            type="button"
            onClick={() => setMasterSearchModalOpen(true)}
            disabled={selectedContents.length >= 9 || skipContents}
            className={cn(
              "mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition",
              selectedContents.length >= 9 || skipContents
                ? "cursor-not-allowed bg-gray-100 text-gray-400"
                : "bg-blue-600 text-white hover:bg-blue-700"
            )}
          >
            <Package className="h-4 w-4" />
            마스터에서 추가
          </button>
        </div>

        {/* 마스터에서 추가한 콘텐츠 목록 */}
        {selectedContents.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">
              마스터에서 추가한 콘텐츠 ({selectedContents.length}개)
            </p>
            <div className="space-y-2">
              {selectedContents.map((content) => (
                <div
                  key={content.contentId}
                  className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                      {content.contentType === "book" ? (
                        <BookOpen className="h-4 w-4 text-blue-600" />
                      ) : (
                        <Video className="h-4 w-4 text-blue-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{content.title}</p>
                      <p className="text-xs text-gray-500">
                        범위: {content.startRange} - {content.endRange}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateData({
                        selectedContents: selectedContents.filter(
                          (c) => c.contentId !== content.contentId
                        ),
                      })
                    }
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={skipContents}
            onChange={(e) => handleSkipToggle(e.target.checked)}
            data-testid="skip-contents-checkbox"
            className="h-4 w-4 rounded border-gray-300 text-blue-600"
          />
          콘텐츠 선택 건너뛰기
        </label>

        {/* 마스터 콘텐츠 검색 모달 */}
        <MasterContentSearchModal
          open={masterSearchModalOpen}
          onClose={() => setMasterSearchModalOpen(false)}
          onSelect={handleMasterContentSelect}
          studentId={studentId}
          tenantId={tenantId}
          existingContentIds={existingContentIds}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 선택 현황 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <p className="text-sm text-gray-600">
            선택:{" "}
            <span className="font-semibold text-gray-900">
              {selectedContents.length}
            </span>
            /9개
          </p>
          {selectedContents.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3 text-orange-500" />
                전략: {selectedContents.filter((c) => c.subjectType === "strategy").length}
              </span>
              <span className="flex items-center gap-1">
                <Target className="h-3 w-3 text-blue-500" />
                취약: {selectedContents.filter((c) => c.subjectType === "weakness").length}
              </span>
            </div>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={skipContents}
            onChange={(e) => handleSkipToggle(e.target.checked)}
            data-testid="skip-contents-checkbox"
            className="h-4 w-4 rounded border-gray-300 text-blue-600"
          />
          콘텐츠 선택 건너뛰기
        </label>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab("student")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
            activeTab === "student"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
          )}
        >
          <BookOpen className="h-4 w-4" />
          학생 콘텐츠
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs",
              activeTab === "student"
                ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-600"
            )}
          >
            {contents.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("master")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
            activeTab === "master"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
          )}
        >
          <Package className="h-4 w-4" />
          마스터 검색
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("summary")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
            activeTab === "summary"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
          )}
        >
          <ListChecks className="h-4 w-4" />
          선택 요약
          {selectedContents.length > 0 && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs",
                activeTab === "summary"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-600"
              )}
            >
              {selectedContents.length}
            </span>
          )}
        </button>
      </div>

      {/* 탭 콘텐츠 */}
      {activeTab === "student" && (
        <div
          className={cn(
            "space-y-2",
            skipContents && "pointer-events-none opacity-50"
          )}
        >
        {contents.map((item) => {
          const selected = isSelected(item.id);
          const selectedContent = getSelectedContent(item.id);
          const isExpanded = expandedId === item.id && selected;

          return (
            <div
              key={item.id}
              className={cn(
                "rounded-lg border transition",
                selected
                  ? "border-blue-300 bg-blue-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              )}
            >
              {/* 메인 행 */}
              <div className="flex items-center gap-3 p-3">
                <button
                  type="button"
                  onClick={() => handleToggle(item)}
                  disabled={!selected && selectedContents.length >= 9}
                  className={cn(
                    "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition",
                    selected
                      ? "border-blue-500 bg-blue-500 text-white"
                      : "border-gray-300 bg-white",
                    !selected &&
                      selectedContents.length >= 9 &&
                      "cursor-not-allowed opacity-50"
                  )}
                >
                  {selected && <Check className="h-3 w-3" />}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {item.type === "book" ? (
                      <BookOpen className="h-4 w-4 flex-shrink-0 text-gray-400" />
                    ) : (
                      <Video className="h-4 w-4 flex-shrink-0 text-gray-400" />
                    )}
                    <span className="truncate text-sm font-medium text-gray-900">
                      {item.title}
                    </span>
                    {selectedContent?.subjectType && (
                      <span
                        className={cn(
                          "flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium",
                          selectedContent.subjectType === "strategy"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-blue-100 text-blue-700"
                        )}
                      >
                        {selectedContent.subjectType === "strategy" ? (
                          <Zap className="h-3 w-3" />
                        ) : (
                          <Target className="h-3 w-3" />
                        )}
                        {selectedContent.subjectType === "strategy" ? "전략" : "취약"}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                    <span>{item.type === "book" ? "교재" : "강의"}</span>
                    {item.subject && (
                      <>
                        <span>·</span>
                        <span>{item.subject}</span>
                      </>
                    )}
                    <span>·</span>
                    <span>
                      {item.type === "book"
                        ? `${item.totalRange}페이지`
                        : `${item.totalRange}강`}
                    </span>
                    {selectedContent && (
                      <>
                        <span>·</span>
                        <span className="text-blue-600">
                          {selectedContent.startRange}~{selectedContent.endRange} 선택
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {selected && (
                  <button
                    type="button"
                    onClick={() => toggleExpand(item.id)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>

              {/* 범위 및 과목 타입 설정 (확장) */}
              {isExpanded && selectedContent && (
                <div className="space-y-3 border-t border-gray-200 bg-gray-50 p-3">
                  {/* 범위 설정 */}
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-gray-600">범위:</label>
                    <input
                      type="number"
                      value={selectedContent.startRange}
                      onChange={(e) =>
                        handleUpdateRange(
                          item.id,
                          Math.max(1, parseInt(e.target.value) || 1),
                          selectedContent.endRange
                        )
                      }
                      min={1}
                      max={selectedContent.endRange}
                      className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                    <span className="text-gray-500">~</span>
                    <input
                      type="number"
                      value={selectedContent.endRange}
                      onChange={(e) =>
                        handleUpdateRange(
                          item.id,
                          selectedContent.startRange,
                          Math.min(
                            item.totalRange,
                            parseInt(e.target.value) || item.totalRange
                          )
                        )
                      }
                      min={selectedContent.startRange}
                      max={item.totalRange}
                      className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                    <span className="text-xs text-gray-500">
                      / {item.totalRange}
                      {item.type === "book" ? "페이지" : "강"}
                    </span>
                  </div>

                  {/* 과목 타입 설정 */}
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-gray-600">학습 유형:</label>
                    <div className="flex gap-2">
                      {SUBJECT_TYPE_OPTIONS.map((option) => (
                        <button
                          key={option.value || "null"}
                          type="button"
                          onClick={() =>
                            handleUpdateSubjectType(item.id, option.value)
                          }
                          className={cn(
                            "flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition",
                            selectedContent.subjectType === option.value
                              ? option.value === "strategy"
                                ? "bg-orange-500 text-white"
                                : option.value === "weakness"
                                  ? "bg-blue-500 text-white"
                                  : "bg-gray-500 text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          )}
                        >
                          {option.icon === "zap" && <Zap className="h-3 w-3" />}
                          {option.icon === "target" && <Target className="h-3 w-3" />}
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 주간 배정일 설정 (전략 과목만 표시) */}
                  {selectedContent.subjectType === "strategy" && (
                    <div className="flex items-center gap-3">
                      <label className="text-xs text-gray-600">주간 배정일:</label>
                      <div className="flex gap-2">
                        {WEEKLY_DAYS_OPTIONS.map((option) => (
                          <button
                            key={option.value || "null"}
                            type="button"
                            onClick={() =>
                              handleUpdateWeeklyDays(item.id, option.value)
                            }
                            className={cn(
                              "rounded px-2 py-1 text-xs font-medium transition",
                              selectedContent.weeklyDays === option.value
                                ? "bg-orange-500 text-white"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <span className="text-xs text-gray-400">
                        (주당 학습 일수)
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        </div>
      )}

      {/* 마스터 검색 탭 */}
      {activeTab === "master" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
            <Package className="mx-auto h-10 w-10 text-gray-400" />
            <p className="mt-3 text-sm font-medium text-gray-700">
              마스터 콘텐츠 라이브러리에서 검색
            </p>
            <p className="mt-1 text-xs text-gray-500">
              공유 콘텐츠 라이브러리에서 교재와 강의를 검색하여 추가할 수 있습니다.
            </p>
            <button
              type="button"
              onClick={() => setMasterSearchModalOpen(true)}
              disabled={selectedContents.length >= 9 || skipContents}
              className={cn(
                "mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition",
                selectedContents.length >= 9 || skipContents
                  ? "cursor-not-allowed bg-gray-200 text-gray-400"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              )}
            >
              <Package className="h-4 w-4" />
              마스터 콘텐츠 검색
            </button>
          </div>
          {/* 안내 메시지 */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            <p className="font-medium">마스터 콘텐츠란?</p>
            <ul className="mt-1 list-inside list-disc space-y-1 text-blue-700">
              <li>학원에서 관리하는 공유 콘텐츠 라이브러리입니다.</li>
              <li>교재, 강의 등 다양한 학습 콘텐츠를 검색할 수 있습니다.</li>
              <li>선택한 콘텐츠는 학생의 콘텐츠로 자동 추가됩니다.</li>
            </ul>
          </div>
        </div>
      )}

      {/* 선택 요약 탭 */}
      {activeTab === "summary" && (
        <div className="space-y-4">
          {selectedContents.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
              <ListChecks className="mx-auto h-10 w-10 text-gray-400" />
              <p className="mt-3 text-sm text-gray-600">
                선택된 콘텐츠가 없습니다.
              </p>
              <p className="mt-1 text-xs text-gray-500">
                학생 콘텐츠 또는 마스터 검색 탭에서 콘텐츠를 선택하세요.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-gray-200 bg-white">
                <div className="border-b border-gray-200 px-4 py-3">
                  <h4 className="text-sm font-medium text-gray-900">
                    선택된 콘텐츠 ({selectedContents.length}/9)
                  </h4>
                </div>
                <div className="divide-y divide-gray-100">
                  {selectedContents.map((content, index) => (
                    <div
                      key={content.contentId}
                      className="flex items-center justify-between p-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded bg-gray-100 text-xs font-medium text-gray-600">
                          {index + 1}
                        </span>
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
                          {content.contentType === "book" ? (
                            <BookOpen className="h-4 w-4 text-blue-600" />
                          ) : (
                            <Video className="h-4 w-4 text-blue-600" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {content.title}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>
                              범위: {content.startRange} - {content.endRange}
                            </span>
                            {content.subjectType && (
                              <>
                                <span>·</span>
                                <span
                                  className={cn(
                                    "flex items-center gap-1",
                                    content.subjectType === "strategy"
                                      ? "text-orange-600"
                                      : "text-blue-600"
                                  )}
                                >
                                  {content.subjectType === "strategy" ? (
                                    <Zap className="h-3 w-3" />
                                  ) : (
                                    <Target className="h-3 w-3" />
                                  )}
                                  {content.subjectType === "strategy"
                                    ? "전략"
                                    : "취약"}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          updateData({
                            selectedContents: selectedContents.filter(
                              (c) => c.contentId !== content.contentId
                            ),
                          })
                        }
                        className="rounded p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-500"
                        title="선택 해제"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* 통계 요약 */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900">
                    {selectedContents.length}
                  </p>
                  <p className="text-xs text-gray-500">총 콘텐츠</p>
                </div>
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-center">
                  <p className="text-2xl font-bold text-orange-600">
                    {selectedContents.filter((c) => c.subjectType === "strategy").length}
                  </p>
                  <p className="text-xs text-orange-600">전략 학습</p>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {selectedContents.filter((c) => c.subjectType === "weakness").length}
                  </p>
                  <p className="text-xs text-blue-600">취약 보완</p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 최대 선택 경고 */}
      {selectedContents.length >= 9 && (
        <p className="text-sm text-amber-600">
          최대 9개의 콘텐츠를 선택할 수 있습니다.
        </p>
      )}

      {/* 안내 메시지 - 학생 탭에서만 표시 */}
      {activeTab === "student" && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <p className="font-medium">콘텐츠 선택 안내</p>
          <ul className="mt-1 list-inside list-disc space-y-1 text-blue-700">
            <li>콘텐츠를 클릭하여 선택/해제할 수 있습니다.</li>
            <li>선택한 콘텐츠의 범위를 조정하여 학습량을 설정하세요.</li>
            <li>&quot;전략 학습&quot;과 &quot;취약 보완&quot;으로 분류하면 AI가 더 정확한 플랜을 생성합니다.</li>
            <li>전략 학습 선택 시 주당 학습 일수(2-4일)를 지정할 수 있습니다.</li>
          </ul>
        </div>
      )}

      {/* 마스터 콘텐츠 검색 모달 */}
      <MasterContentSearchModal
        open={masterSearchModalOpen}
        onClose={() => setMasterSearchModalOpen(false)}
        onSelect={handleMasterContentSelect}
        studentId={studentId}
        tenantId={tenantId}
        existingContentIds={existingContentIds}
      />
    </div>
  );
}
