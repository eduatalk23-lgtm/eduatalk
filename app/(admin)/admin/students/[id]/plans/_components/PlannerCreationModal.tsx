"use client";

/**
 * PlannerCreationModal
 *
 * 새 플래너 생성 모달
 *
 * @module app/(admin)/admin/students/[id]/plans/_components/PlannerCreationModal
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import { X, Loader2, Calendar, Clock, Info, Moon } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  createPlannerAction,
  updatePlannerAction,
  type Planner,
  type CreatePlannerInput,
  type UpdatePlannerInput,
  type NonStudyTimeBlock,
} from "@/lib/domains/admin-plan/actions";
import { NonStudyTimeBlocksEditor } from "./NonStudyTimeBlocksEditor";

// ============================================
// 타입 정의
// ============================================

interface PlannerCreationModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (planner: Planner) => void;
  studentId: string;
  tenantId: string;
  studentName: string;
  /** 편집 모드: 기존 플래너 데이터 전달 */
  editPlanner?: Planner;
  /** 복제 모드: 기존 플래너를 복제할 때 사용 */
  duplicateFrom?: Planner;
}

interface FormData {
  name: string;
  description: string;
  periodStart: string;
  periodEnd: string;
  targetDate: string;
  studyHoursStart: string;
  studyHoursEnd: string;
  selfStudyHoursStart: string;
  selfStudyHoursEnd: string;
  lunchTimeStart: string;
  lunchTimeEnd: string;
  schedulerType: "1730_timetable" | "custom";
  studyDays: number;
  reviewDays: number;
  adminMemo: string;
}

// ============================================
// 초기값
// ============================================

function getDefaultFormData(): FormData {
  const today = new Date();
  const nextMonth = new Date(today);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  return {
    name: "",
    description: "",
    periodStart: today.toISOString().split("T")[0],
    periodEnd: nextMonth.toISOString().split("T")[0],
    targetDate: "",
    studyHoursStart: "10:00",
    studyHoursEnd: "19:00",
    selfStudyHoursStart: "19:00",
    selfStudyHoursEnd: "22:00",
    lunchTimeStart: "12:00",
    lunchTimeEnd: "13:00",
    schedulerType: "1730_timetable",
    studyDays: 6,
    reviewDays: 1,
    adminMemo: "",
  };
}

/**
 * 플래너 데이터를 FormData로 변환
 */
function plannerToFormData(planner: Planner, isDuplicate: boolean = false): FormData {
  const schedulerOptions = planner.defaultSchedulerOptions as {
    study_days?: number;
    review_days?: number;
  } | null;

  return {
    name: isDuplicate ? `${planner.name} (복사본)` : planner.name,
    description: planner.description || "",
    periodStart: planner.periodStart,
    periodEnd: planner.periodEnd,
    targetDate: planner.targetDate || "",
    studyHoursStart: planner.studyHours?.start || "10:00",
    studyHoursEnd: planner.studyHours?.end || "19:00",
    selfStudyHoursStart: planner.selfStudyHours?.start || "19:00",
    selfStudyHoursEnd: planner.selfStudyHours?.end || "22:00",
    lunchTimeStart: planner.lunchTime?.start || "12:00",
    lunchTimeEnd: planner.lunchTime?.end || "13:00",
    schedulerType: (planner.defaultSchedulerType as "1730_timetable" | "custom") || "1730_timetable",
    studyDays: schedulerOptions?.study_days ?? 6,
    reviewDays: schedulerOptions?.review_days ?? 1,
    adminMemo: planner.adminMemo || "",
  };
}

// ============================================
// 메인 컴포넌트
// ============================================

export function PlannerCreationModal({
  open,
  onClose,
  onSuccess,
  studentId,
  tenantId,
  studentName,
  editPlanner,
  duplicateFrom,
}: PlannerCreationModalProps) {
  const [formData, setFormData] = useState<FormData>(getDefaultFormData);
  const [nonStudyBlocks, setNonStudyBlocks] = useState<NonStudyTimeBlock[]>([]);
  const [showSelfStudy, setShowSelfStudy] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 모드 판별
  const mode = useMemo(() => {
    if (editPlanner) return "edit";
    if (duplicateFrom) return "duplicate";
    return "create";
  }, [editPlanner, duplicateFrom]);

  const modalTitle = useMemo(() => {
    switch (mode) {
      case "edit":
        return "플래너 수정";
      case "duplicate":
        return "플래너 복제";
      default:
        return "새 플래너 만들기";
    }
  }, [mode]);

  const submitButtonText = useMemo(() => {
    if (isSubmitting) {
      switch (mode) {
        case "edit":
          return "수정 중...";
        case "duplicate":
          return "복제 중...";
        default:
          return "생성 중...";
      }
    }
    switch (mode) {
      case "edit":
        return "플래너 수정";
      case "duplicate":
        return "플래너 복제";
      default:
        return "플래너 생성";
    }
  }, [mode, isSubmitting]);

  // 모달 열릴 때 폼 데이터 초기화
  useEffect(() => {
    if (open) {
      if (editPlanner) {
        setFormData(plannerToFormData(editPlanner, false));
        setNonStudyBlocks(editPlanner.nonStudyTimeBlocks || []);
        setShowSelfStudy(!!editPlanner.selfStudyHours);
      } else if (duplicateFrom) {
        setFormData(plannerToFormData(duplicateFrom, true));
        setNonStudyBlocks(duplicateFrom.nonStudyTimeBlocks || []);
        setShowSelfStudy(!!duplicateFrom.selfStudyHours);
      } else {
        setFormData(getDefaultFormData());
        setNonStudyBlocks([]);
        setShowSelfStudy(false);
      }
      setError(null);
    }
  }, [open, editPlanner, duplicateFrom]);

  // 폼 필드 변경 핸들러
  const handleChange = useCallback(
    (field: keyof FormData, value: string | number) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      setError(null);
    },
    []
  );

  // 폼 유효성 검사
  const validateForm = (): string | null => {
    if (!formData.name.trim()) {
      return "플래너 이름을 입력해주세요.";
    }
    if (!formData.periodStart || !formData.periodEnd) {
      return "기간을 설정해주세요.";
    }
    if (new Date(formData.periodStart) > new Date(formData.periodEnd)) {
      return "종료일은 시작일보다 뒤여야 합니다.";
    }
    if (formData.targetDate && new Date(formData.targetDate) < new Date(formData.periodEnd)) {
      return "목표일은 종료일 이후여야 합니다.";
    }
    return null;
  };

  // 폼 제출
  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let result: Planner | null = null;

      if (mode === "edit" && editPlanner) {
        // 수정 모드
        const updateInput: UpdatePlannerInput = {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          periodStart: formData.periodStart,
          periodEnd: formData.periodEnd,
          targetDate: formData.targetDate || null,
          studyHours: {
            start: formData.studyHoursStart,
            end: formData.studyHoursEnd,
          },
          selfStudyHours: showSelfStudy
            ? {
                start: formData.selfStudyHoursStart,
                end: formData.selfStudyHoursEnd,
              }
            : undefined,
          lunchTime: {
            start: formData.lunchTimeStart,
            end: formData.lunchTimeEnd,
          },
          nonStudyTimeBlocks: nonStudyBlocks.length > 0 ? nonStudyBlocks : [],
          defaultSchedulerType: formData.schedulerType,
          defaultSchedulerOptions: {
            study_days: formData.studyDays,
            review_days: formData.reviewDays,
          },
          adminMemo: formData.adminMemo.trim() || null,
        };

        result = await updatePlannerAction(editPlanner.id, updateInput);
      } else {
        // 생성 또는 복제 모드
        const createInput: CreatePlannerInput = {
          studentId,
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          periodStart: formData.periodStart,
          periodEnd: formData.periodEnd,
          targetDate: formData.targetDate || undefined,
          studyHours: {
            start: formData.studyHoursStart,
            end: formData.studyHoursEnd,
          },
          selfStudyHours: showSelfStudy
            ? {
                start: formData.selfStudyHoursStart,
                end: formData.selfStudyHoursEnd,
              }
            : undefined,
          lunchTime: {
            start: formData.lunchTimeStart,
            end: formData.lunchTimeEnd,
          },
          nonStudyTimeBlocks: nonStudyBlocks.length > 0 ? nonStudyBlocks : undefined,
          defaultSchedulerType: formData.schedulerType,
          defaultSchedulerOptions: {
            study_days: formData.studyDays,
            review_days: formData.reviewDays,
          },
          adminMemo: formData.adminMemo.trim() || undefined,
        };

        result = await createPlannerAction(createInput);
      }

      if (result) {
        onSuccess(result);
        setFormData(getDefaultFormData());
        setNonStudyBlocks([]);
        setShowSelfStudy(false);
      }
    } catch (err) {
      console.error(`[PlannerCreationModal] ${mode} 실패:`, err);
      const errorMessages = {
        create: "플래너 생성에 실패했습니다.",
        edit: "플래너 수정에 실패했습니다.",
        duplicate: "플래너 복제에 실패했습니다.",
      };
      setError(err instanceof Error ? err.message : errorMessages[mode]);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 모달 닫기
  const handleClose = () => {
    if (isSubmitting) return;
    setFormData(getDefaultFormData());
    setNonStudyBlocks([]);
    setShowSelfStudy(false);
    setError(null);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />

      {/* 모달 컨텐츠 */}
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-xl shadow-xl overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{modalTitle}</h2>
            <p className="text-sm text-gray-500">{studentName}</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
            disabled={isSubmitting}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex flex-col gap-6">
            {/* 기본 정보 */}
            <section>
              <h3 className="text-sm font-medium text-gray-700 mb-3">기본 정보</h3>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    플래너 이름 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    placeholder="예: 겨울방학 수능 대비"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">설명</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleChange("description", e.target.value)}
                    placeholder="플래너에 대한 간단한 설명"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </section>

            {/* 기간 설정 */}
            <section>
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                기간 설정
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    시작일 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.periodStart}
                    onChange={(e) => handleChange("periodStart", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    종료일 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.periodEnd}
                    onChange={(e) => handleChange("periodEnd", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isSubmitting}
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm text-gray-600 mb-1">
                  목표일 (선택)
                </label>
                <input
                  type="date"
                  value={formData.targetDate}
                  onChange={(e) => handleChange("targetDate", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isSubmitting}
                  placeholder="예: 수능일"
                />
                <p className="text-xs text-gray-500 mt-1">
                  수능, 모의고사 등 최종 목표 날짜
                </p>
              </div>
            </section>

            {/* 시간 설정 */}
            <section>
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                학습 시간 설정
              </h3>
              <div className="flex flex-col gap-4">
                {/* 학습 시간 */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">기본 학습 시간</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        시작
                      </label>
                      <input
                        type="time"
                        value={formData.studyHoursStart}
                        onChange={(e) => handleChange("studyHoursStart", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        종료
                      </label>
                      <input
                        type="time"
                        value={formData.studyHoursEnd}
                        onChange={(e) => handleChange("studyHoursEnd", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </div>

                {/* 점심 시간 */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">점심 시간</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        시작
                      </label>
                      <input
                        type="time"
                        value={formData.lunchTimeStart}
                        onChange={(e) => handleChange("lunchTimeStart", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        종료
                      </label>
                      <input
                        type="time"
                        value={formData.lunchTimeEnd}
                        onChange={(e) => handleChange("lunchTimeEnd", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </div>

                {/* 자율학습 시간 토글 */}
                <div className="border-t pt-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showSelfStudy}
                      onChange={(e) => setShowSelfStudy(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                      disabled={isSubmitting}
                    />
                    <Moon className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-700">자율학습 시간 설정</span>
                  </label>
                  {showSelfStudy && (
                    <div className="mt-3 grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          시작
                        </label>
                        <input
                          type="time"
                          value={formData.selfStudyHoursStart}
                          onChange={(e) => handleChange("selfStudyHoursStart", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={isSubmitting}
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          종료
                        </label>
                        <input
                          type="time"
                          value={formData.selfStudyHoursEnd}
                          onChange={(e) => handleChange("selfStudyHoursEnd", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={isSubmitting}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* 비학습 시간 설정 */}
            <section className="border-t pt-6">
              <NonStudyTimeBlocksEditor
                blocks={nonStudyBlocks}
                onChange={setNonStudyBlocks}
                disabled={isSubmitting}
              />
            </section>

            {/* 스케줄러 설정 */}
            <section>
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <Info className="w-4 h-4" />
                스케줄러 설정
              </h3>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-4 mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="schedulerType"
                      value="1730_timetable"
                      checked={formData.schedulerType === "1730_timetable"}
                      onChange={(e) => handleChange("schedulerType", e.target.value)}
                      className="text-blue-600"
                      disabled={isSubmitting}
                    />
                    <span className="text-sm">1730 타임테이블</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="schedulerType"
                      value="custom"
                      checked={formData.schedulerType === "custom"}
                      onChange={(e) => handleChange("schedulerType", e.target.value)}
                      className="text-blue-600"
                      disabled={isSubmitting}
                    />
                    <span className="text-sm">커스텀</span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      주간 학습일 수
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={7}
                      value={formData.studyDays}
                      onChange={(e) => handleChange("studyDays", parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      주간 복습일 수
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={7}
                      value={formData.reviewDays}
                      onChange={(e) => handleChange("reviewDays", parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* 관리자 메모 */}
            <section>
              <label className="block text-sm text-gray-600 mb-1">
                관리자 메모
              </label>
              <textarea
                value={formData.adminMemo}
                onChange={(e) => handleChange("adminMemo", e.target.value)}
                placeholder="관리자용 메모 (학생에게 표시되지 않음)"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                disabled={isSubmitting}
              />
            </section>
          </div>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="px-6 py-3 bg-red-50 border-t border-red-100">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* 푸터 */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
            disabled={isSubmitting}
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg",
              isSubmitting
                ? "bg-blue-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            )}
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitButtonText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PlannerCreationModal;
