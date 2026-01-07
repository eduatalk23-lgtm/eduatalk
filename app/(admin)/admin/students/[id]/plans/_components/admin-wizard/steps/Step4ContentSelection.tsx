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
 * @module app/(admin)/admin/students/[id]/plans/_components/admin-wizard/steps/Step4ContentSelection
 */

import { useState, useEffect, useCallback, useMemo } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  getStudentContentsForAdmin,
  type StudentContentItem,
} from "@/lib/domains/admin-plan/actions";
import {
  useAdminWizardData,
  useAdminWizardValidation,
} from "../_context";
import type { SelectedContent, SubjectType } from "../_context/types";
import { MasterContentSearchModal } from "./_components/MasterContentSearchModal";

/**
 * Step4ContentSelection Props
 */
interface Step4ContentSelectionProps {
  studentId: string;
  tenantId: string;
}

const SUBJECT_TYPE_OPTIONS: { value: SubjectType; label: string; icon: React.ReactNode }[] = [
  { value: null, label: "미분류", icon: null },
  { value: "strategy", label: "전략 과목", icon: <Zap className="h-3 w-3" /> },
  { value: "weakness", label: "취약 과목", icon: <Target className="h-3 w-3" /> },
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

  const [contents, setContents] = useState<StudentContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [masterSearchModalOpen, setMasterSearchModalOpen] = useState(false);

  // 이미 선택된 콘텐츠 ID 집합 (중복 방지용)
  const existingContentIds = useMemo(() => {
    return new Set(selectedContents.map((c) => c.contentId));
  }, [selectedContents]);

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
          c.contentId === contentId ? { ...c, subjectType } : c
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
            콘텐츠 없이 플랜 그룹을 생성하고, 나중에 콘텐츠를 추가할 수 있습니다.
          </p>
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
    );
  }

  return (
    <div className="space-y-4">
      {/* 선택 현황 및 액션 */}
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
        <div className="flex items-center gap-3">
          {/* 마스터 콘텐츠에서 추가 버튼 */}
          <button
            type="button"
            onClick={() => setMasterSearchModalOpen(true)}
            disabled={selectedContents.length >= 9 || skipContents}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition",
              selectedContents.length >= 9 || skipContents
                ? "cursor-not-allowed bg-gray-100 text-gray-400"
                : "bg-blue-50 text-blue-600 hover:bg-blue-100"
            )}
          >
            <Package className="h-4 w-4" />
            마스터에서 추가
          </button>
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
      </div>

      {/* 콘텐츠 목록 */}
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
                    <label className="text-xs text-gray-600">과목 분류:</label>
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
                          {option.icon}
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedContents.length >= 9 && (
        <p className="text-sm text-amber-600">
          최대 9개의 콘텐츠를 선택할 수 있습니다.
        </p>
      )}

      {/* 안내 메시지 */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <p className="font-medium">콘텐츠 선택 안내</p>
        <ul className="mt-1 list-inside list-disc space-y-1 text-blue-700">
          <li>콘텐츠를 클릭하여 선택/해제할 수 있습니다.</li>
          <li>선택한 콘텐츠의 범위를 조정하여 학습량을 설정하세요.</li>
          <li>&quot;전략 과목&quot;과 &quot;취약 과목&quot;으로 분류하면 AI가 더 정확한 플랜을 생성합니다.</li>
          <li>&quot;마스터에서 추가&quot; 버튼으로 마스터 콘텐츠 라이브러리에서 검색하여 추가할 수 있습니다.</li>
        </ul>
      </div>

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
