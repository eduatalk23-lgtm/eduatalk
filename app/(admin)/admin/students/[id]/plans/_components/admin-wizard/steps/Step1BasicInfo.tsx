"use client";

/**
 * Step 1: 기본 정보
 *
 * Phase 3: 7단계 위저드 확장
 * - 플래너 선택 (신규 추가 - Phase 4)
 * - 학습 기간 설정
 * - 플랜 이름
 * - 학습 목적
 * - 블록셋 선택
 *
 * @module app/(admin)/admin/students/[id]/plans/_components/admin-wizard/steps/Step1BasicInfo
 */

import { useEffect, useCallback, useState, useRef } from "react";
import { Calendar, FileText, Target, Clock, ChevronDown, Plus, FolderOpen, Lock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  useAdminWizardData,
  useAdminWizardValidation,
} from "../_context";
import type { PlanPurpose, ExclusionSchedule, AcademySchedule } from "../_context/types";
import {
  getBlockSetsForStudent,
  type BlockSetWithBlocks,
} from "@/lib/domains/admin-plan/actions/blockSets";
import {
  getStudentPlannersAction,
  getPlannerAction,
  type Planner,
} from "@/lib/domains/admin-plan/actions";
import { useAdminPlan } from "../../context/AdminPlanContext";

/**
 * Step1BasicInfo Props
 */
interface Step1BasicInfoProps {
  studentId: string;
  error?: string | null;
}

const PURPOSE_OPTIONS: { value: PlanPurpose; label: string }[] = [
  { value: "", label: "없음" },
  { value: "내신대비", label: "내신대비" },
  { value: "모의고사", label: "모의고사" },
  { value: "수능", label: "수능" },
  { value: "기타", label: "기타" },
];

/**
 * Step 1: 기본 정보 컴포넌트
 */
export function Step1BasicInfo({ studentId, error }: Step1BasicInfoProps) {
  const { wizardData, updateData } = useAdminWizardData();
  const { fieldErrors, setFieldError, clearFieldError } = useAdminWizardValidation();
  const { setShowBlockSetCreateModal, showBlockSetCreateModal } = useAdminPlan();

  // 플래너 관련 상태
  const [planners, setPlanners] = useState<Planner[]>([]);
  const [isLoadingPlanners, setIsLoadingPlanners] = useState(false);
  const [showPlannerDropdown, setShowPlannerDropdown] = useState(false);

  // 블록셋 관련 상태
  const [blockSets, setBlockSets] = useState<BlockSetWithBlocks[]>([]);
  const [isLoadingBlockSets, setIsLoadingBlockSets] = useState(false);
  const [showBlockSetDropdown, setShowBlockSetDropdown] = useState(false);

  // 블록셋 새로고침 (모달에서 생성 후)
  const [blockSetRefreshKey, setBlockSetRefreshKey] = useState(0);

  const { periodStart, periodEnd, name, planPurpose, blockSetId, plannerId } = wizardData;

  // 플래너 로드
  useEffect(() => {
    async function loadPlanners() {
      if (!studentId) return;

      setIsLoadingPlanners(true);
      try {
        const result = await getStudentPlannersAction(studentId, {
          status: ["active", "draft"],
          includeArchived: false,
        });
        if (result && "data" in result) {
          setPlanners(result.data);
        }
      } catch (err) {
        console.error("[Step1] 플래너 로드 실패:", err);
      } finally {
        setIsLoadingPlanners(false);
      }
    }
    loadPlanners();
  }, [studentId]);

  // 블록셋 로드 (Server Action 사용)
  // blockSetRefreshKey가 변경되면 블록셋을 다시 로드함 (모달에서 생성 후 새로고침용)
  useEffect(() => {
    async function loadBlockSets() {
      if (!studentId) return;

      setIsLoadingBlockSets(true);
      try {
        const data = await getBlockSetsForStudent(studentId);
        setBlockSets(data);
      } catch (err) {
        console.error("[Step1] 블록셋 로드 실패:", err);
      } finally {
        setIsLoadingBlockSets(false);
      }
    }
    loadBlockSets();
  }, [studentId, blockSetRefreshKey]);

  // 블록셋 생성 모달이 닫히면 블록셋 목록 새로고침
  const prevShowBlockSetCreateModal = useRef(showBlockSetCreateModal);
  useEffect(() => {
    // 모달이 true → false로 변경되면 (닫힘) 블록셋 새로고침
    if (prevShowBlockSetCreateModal.current && !showBlockSetCreateModal) {
      setBlockSetRefreshKey((prev) => prev + 1);
    }
    prevShowBlockSetCreateModal.current = showBlockSetCreateModal;
  }, [showBlockSetCreateModal]);

  // 기본값 설정: 오늘부터 30일
  useEffect(() => {
    if (!periodStart || !periodEnd) {
      const today = new Date();
      const thirtyDaysLater = new Date(today);
      thirtyDaysLater.setDate(today.getDate() + 30);

      const formatDate = (d: Date) => d.toISOString().split("T")[0];
      updateData({
        periodStart: formatDate(today),
        periodEnd: formatDate(thirtyDaysLater),
      });
    }
  }, [periodStart, periodEnd, updateData]);

  // 기간 변경 핸들러
  const handleStartChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateData({ periodStart: e.target.value });

      // 검증
      if (e.target.value && periodEnd) {
        const start = new Date(e.target.value);
        const end = new Date(periodEnd);
        if (start >= end) {
          setFieldError("periodStart", "시작일은 종료일보다 이전이어야 합니다.");
        } else {
          clearFieldError("periodStart");
        }
      }
    },
    [periodEnd, updateData, setFieldError, clearFieldError]
  );

  const handleEndChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateData({ periodEnd: e.target.value });

      // 검증
      if (periodStart && e.target.value) {
        const start = new Date(periodStart);
        const end = new Date(e.target.value);
        if (start >= end) {
          setFieldError("periodEnd", "종료일은 시작일보다 이후여야 합니다.");
        } else {
          clearFieldError("periodEnd");
          clearFieldError("periodStart");
        }
      }
    },
    [periodStart, updateData, setFieldError, clearFieldError]
  );

  // 이름 변경 핸들러
  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateData({ name: e.target.value });
    },
    [updateData]
  );

  // 목적 변경 핸들러
  const handlePurposeChange = useCallback(
    (purpose: PlanPurpose) => {
      updateData({ planPurpose: purpose });
    },
    [updateData]
  );

  // 블록셋 선택 핸들러
  const handleBlockSetSelect = useCallback(
    (id: string | undefined) => {
      updateData({ blockSetId: id });
      setShowBlockSetDropdown(false);
    },
    [updateData]
  );

  // 플래너 선택 핸들러 (플래너 설정을 위자드에 자동 채우기)
  const handlePlannerSelect = useCallback(
    async (id: string | undefined) => {
      setShowPlannerDropdown(false);

      // 플래너 선택 해제 시: 상속 설정 정리
      if (!id) {
        updateData({
          plannerId: undefined,
          // 시간 설정 초기화
          studyHours: null,
          selfStudyHours: null,
          lunchTime: null,
          nonStudyTimeBlocks: [],
          // is_locked 항목만 제거 (수동 추가 항목 유지)
          exclusions: wizardData.exclusions.filter(e => !e.is_locked),
          academySchedules: wizardData.academySchedules.filter(s => !s.is_locked),
        });
        return;
      }

      updateData({ plannerId: id });

      // 플래너 상세 정보 로드 후 자동 채우기
      try {
        const planner = await getPlannerAction(id, true);
        if (!planner) return;

        // 기본 정보 자동 채우기
        const autoFillData: Partial<typeof wizardData> = {
          plannerId: id,
          periodStart: planner.periodStart,
          periodEnd: planner.periodEnd,
          blockSetId: planner.blockSetId ?? undefined,
        };

        // NEW: 시간 설정 자동 채우기 (플래너와 완전 호환)
        autoFillData.studyHours = planner.studyHours ?? null;
        autoFillData.selfStudyHours = planner.selfStudyHours ?? null;
        autoFillData.lunchTime = planner.lunchTime ?? null;
        autoFillData.nonStudyTimeBlocks = planner.nonStudyTimeBlocks ?? [];

        // NEW: 스케줄러 타입 자동 채우기
        if (planner.defaultSchedulerType) {
          autoFillData.schedulerType = planner.defaultSchedulerType as "1730_timetable" | "custom" | "";
        }

        // 제외일 매핑 (플래너 exclusionType → 위자드 exclusion_type)
        // 플래너에서 가져온 제외일은 is_locked: true로 설정하여 삭제 방지
        // 기존 수동 추가 항목 유지
        const manualExclusions = wizardData.exclusions.filter(e => !e.is_locked);
        if (planner.exclusions && planner.exclusions.length > 0) {
          const mapExclusionType = (type: string): "holiday" | "event" | "personal" => {
            switch (type) {
              case "휴일지정":
              case "지정휴일": return "holiday";
              case "휴가": return "event"; // 휴가는 일반 이벤트로 매핑
              case "개인사정":
              case "개인일정": return "personal";
              default: return "event";
            }
          };
          const plannerExclusions: ExclusionSchedule[] = planner.exclusions.map((e) => ({
            exclusion_date: e.exclusionDate,
            exclusion_type: mapExclusionType(e.exclusionType),
            reason: e.reason ?? undefined,
            source: "planner",
            is_locked: true, // 플래너에서 가져온 제외일은 삭제 방지
          }));
          autoFillData.exclusions = [...plannerExclusions, ...manualExclusions];
        } else {
          autoFillData.exclusions = manualExclusions;
        }

        // 학원 일정 매핑
        // 플래너에서 가져온 학원일정은 is_locked: true로 설정하여 삭제 방지
        // 기존 수동 추가 항목 유지
        const manualAcademySchedules = wizardData.academySchedules.filter(s => !s.is_locked);
        if (planner.academySchedules && planner.academySchedules.length > 0) {
          const plannerAcademySchedules: AcademySchedule[] = planner.academySchedules.map((s) => ({
            academy_name: s.academyName ?? "학원",
            day_of_week: s.dayOfWeek,
            start_time: s.startTime,
            end_time: s.endTime,
            subject: s.subject ?? undefined,
            travel_time: s.travelTime ?? 60,
            source: "planner",
            is_locked: true, // 플래너에서 가져온 학원일정은 삭제 방지
          }));
          autoFillData.academySchedules = [...plannerAcademySchedules, ...manualAcademySchedules];
        } else {
          autoFillData.academySchedules = manualAcademySchedules;
        }

        // 스케줄러 옵션
        if (planner.defaultSchedulerOptions) {
          const opts = planner.defaultSchedulerOptions as Record<string, number>;
          autoFillData.schedulerOptions = {
            study_days: opts.study_days ?? 6,
            review_days: opts.review_days ?? 1,
          };
        }

        updateData(autoFillData);
      } catch (err) {
        console.error("[Step1] 플래너 설정 로드 실패:", err);
      }
    },
    [updateData, wizardData]
  );

  // 기간 계산
  const getDaysDiff = () => {
    if (!periodStart || !periodEnd) return 0;
    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    const diff = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
    return diff > 0 ? diff : 0;
  };

  const daysDiff = getDaysDiff();
  const isValidPeriod = daysDiff > 0 && daysDiff <= 365;
  const selectedBlockSet = blockSets.find((bs) => bs.id === blockSetId);
  const selectedPlanner = planners.find((p) => p.id === plannerId);

  // 날짜 포맷팅 헬퍼
  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* 플래너 선택 (강화된 UI - Phase 5) */}
      <div className="rounded-xl border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500 text-white">
              <FolderOpen className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">플래너 선택</h3>
              <p className="text-xs text-gray-500">시간 설정, 제외일, 학원일정이 자동 상속됩니다</p>
            </div>
          </div>
          {selectedPlanner && (
            <div className="flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              선택됨
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowPlannerDropdown(!showPlannerDropdown)}
            disabled={isLoadingPlanners}
            data-testid="planner-select"
            className={cn(
              "flex w-full items-center justify-between rounded-lg border-2 px-4 py-3 text-sm font-medium transition",
              selectedPlanner
                ? "border-blue-500 bg-white text-blue-700 shadow-sm"
                : "border-gray-300 bg-white text-gray-600 hover:border-blue-400"
            )}
          >
            <span>
              {isLoadingPlanners
                ? "불러오는 중..."
                : selectedPlanner
                  ? selectedPlanner.name
                  : "플래너를 선택하세요"}
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                showPlannerDropdown && "rotate-180"
              )}
            />
          </button>

          {showPlannerDropdown && (
            <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
              {/* 선택 안 함 옵션 */}
              <button
                type="button"
                onClick={() => handlePlannerSelect(undefined)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-gray-50",
                  !plannerId && "bg-blue-50 text-blue-700"
                )}
              >
                선택 안 함 (새로 설정)
              </button>

              {planners.length === 0 && !isLoadingPlanners ? (
                <div className="px-3 py-4 text-center text-sm text-gray-500">
                  <p>활성 플래너가 없습니다.</p>
                </div>
              ) : (
                planners.map((planner) => (
                  <button
                    key={planner.id}
                    type="button"
                    onClick={() => handlePlannerSelect(planner.id)}
                    className={cn(
                      "flex w-full flex-col items-start px-3 py-2.5 text-left text-sm hover:bg-gray-50",
                      plannerId === planner.id && "bg-blue-50 text-blue-700"
                    )}
                  >
                    <span className="font-medium">{planner.name}</span>
                    <span className="text-xs text-gray-500">
                      {formatDateDisplay(planner.periodStart)} ~ {formatDateDisplay(planner.periodEnd)}
                      {planner.planGroupCount !== undefined && planner.planGroupCount > 0 && (
                        <> · 플랜그룹 {planner.planGroupCount}개</>
                      )}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* 상속 미리보기 */}
        {selectedPlanner && (
          <div className="mt-4 rounded-lg border border-blue-100 bg-white p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-700">
              <Lock className="h-3.5 w-3.5 text-blue-500" />
              상속될 설정
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* 시간 설정 */}
              <div className="flex items-center gap-2 rounded-md bg-gray-50 px-2.5 py-1.5">
                <Clock className="h-3.5 w-3.5 text-gray-500" />
                <span className="text-gray-600">
                  시간 설정: {selectedPlanner.studyHours ? "설정됨" : "없음"}
                </span>
              </div>

              {/* 비학습 시간 블록 */}
              <div className="flex items-center gap-2 rounded-md bg-gray-50 px-2.5 py-1.5">
                <Calendar className="h-3.5 w-3.5 text-gray-500" />
                <span className="text-gray-600">
                  비학습 블록: {selectedPlanner.nonStudyTimeBlocks?.length ?? 0}개
                </span>
              </div>

              {/* 제외일 */}
              <div className="flex items-center gap-2 rounded-md bg-orange-50 px-2.5 py-1.5">
                <Lock className="h-3.5 w-3.5 text-orange-500" />
                <span className="text-orange-700">
                  제외일: {selectedPlanner.exclusions?.length ?? 0}개 (잠금)
                </span>
              </div>

              {/* 학원일정 */}
              <div className="flex items-center gap-2 rounded-md bg-purple-50 px-2.5 py-1.5">
                <Lock className="h-3.5 w-3.5 text-purple-500" />
                <span className="text-purple-700">
                  학원일정: {selectedPlanner.academySchedules?.length ?? 0}개 (잠금)
                </span>
              </div>
            </div>

            {/* 기간 정보 */}
            <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
              기간: {formatDateDisplay(selectedPlanner.periodStart)} ~ {formatDateDisplay(selectedPlanner.periodEnd)}
            </div>
          </div>
        )}
      </div>

      {/* 기간 설정 */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Calendar className="h-4 w-4" />
          학습 기간 <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={periodStart}
            onChange={handleStartChange}
            data-testid="period-start"
            className={cn(
              "flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2",
              fieldErrors.get("periodStart")
                ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                : isValidPeriod
                  ? "border-gray-300 focus:border-blue-500 focus:ring-blue-200"
                  : "border-red-300 focus:border-red-500 focus:ring-red-200"
            )}
          />
          <span className="text-gray-500">~</span>
          <input
            type="date"
            value={periodEnd}
            onChange={handleEndChange}
            min={periodStart}
            data-testid="period-end"
            className={cn(
              "flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2",
              fieldErrors.get("periodEnd")
                ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                : isValidPeriod
                  ? "border-gray-300 focus:border-blue-500 focus:ring-blue-200"
                  : "border-red-300 focus:border-red-500 focus:ring-red-200"
            )}
          />
        </div>
        {daysDiff > 0 && (
          <p
            className={cn(
              "text-sm",
              isValidPeriod ? "text-gray-500" : "text-red-500"
            )}
          >
            {daysDiff}일간의 학습 계획
            {daysDiff > 365 && " (최대 365일까지 설정 가능)"}
          </p>
        )}
        {daysDiff <= 0 && periodStart && periodEnd && (
          <p className="text-sm text-red-500">
            종료일은 시작일보다 이후여야 합니다.
          </p>
        )}
        {fieldErrors.get("periodStart") && (
          <p className="text-sm text-red-500" data-testid="error-periodStart">{fieldErrors.get("periodStart")}</p>
        )}
        {fieldErrors.get("periodEnd") && (
          <p className="text-sm text-red-500" data-testid="error-periodEnd">{fieldErrors.get("periodEnd")}</p>
        )}
      </div>

      {/* 플랜 이름 */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <FileText className="h-4 w-4" />
          플랜 이름 <span className="text-xs text-gray-400">(선택)</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={handleNameChange}
          placeholder="예: 겨울방학 학습 계획"
          data-testid="plan-name-input"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          maxLength={100}
        />
      </div>

      {/* 학습 목적 */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Target className="h-4 w-4" />
          학습 목적 <span className="text-xs text-gray-400">(선택)</span>
        </label>
        <div className="grid grid-cols-5 gap-2">
          {PURPOSE_OPTIONS.map((option) => (
            <button
              key={option.value || "none"}
              type="button"
              onClick={() => handlePurposeChange(option.value)}
              data-testid={`plan-purpose-${option.value || "none"}`}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-sm font-medium transition",
                planPurpose === option.value
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* 블록셋 선택 (신규) */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Clock className="h-4 w-4" />
          학습 시간표 (블록셋) <span className="text-xs text-gray-400">(선택)</span>
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowBlockSetDropdown(!showBlockSetDropdown)}
            disabled={isLoadingBlockSets}
            data-testid="block-set-select"
            className={cn(
              "flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition",
              selectedBlockSet
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
            )}
          >
            <span>
              {isLoadingBlockSets
                ? "불러오는 중..."
                : selectedBlockSet
                  ? selectedBlockSet.name
                  : "시간표를 선택하세요 (선택 안 함 가능)"}
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                showBlockSetDropdown && "rotate-180"
              )}
            />
          </button>

          {showBlockSetDropdown && (
            <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
              {/* 선택 안 함 옵션 */}
              <button
                type="button"
                onClick={() => handleBlockSetSelect(undefined)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-gray-50",
                  !blockSetId && "bg-blue-50 text-blue-700"
                )}
              >
                선택 안 함
              </button>

              {blockSets.length === 0 && !isLoadingBlockSets ? (
                <div className="px-3 py-4 text-center text-sm text-gray-500">
                  <p>등록된 시간표가 없습니다.</p>
                  <button
                    type="button"
                    className="mt-2 inline-flex items-center gap-1 text-blue-600 hover:underline"
                    onClick={() => {
                      setShowBlockSetDropdown(false);
                      setShowBlockSetCreateModal(true);
                    }}
                  >
                    <Plus className="h-3 w-3" />
                    새 시간표 만들기
                  </button>
                </div>
              ) : (
                blockSets.map((bs) => (
                  <button
                    key={bs.id}
                    type="button"
                    onClick={() => handleBlockSetSelect(bs.id)}
                    className={cn(
                      "flex w-full flex-col items-start px-3 py-2.5 text-left text-sm hover:bg-gray-50",
                      blockSetId === bs.id && "bg-blue-50 text-blue-700"
                    )}
                  >
                    <span className="font-medium">{bs.name}</span>
                    {bs.blocks && bs.blocks.length > 0 && (
                      <span className="text-xs text-gray-500">
                        {bs.blocks.length}개 블록
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {selectedBlockSet && selectedBlockSet.blocks && selectedBlockSet.blocks.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="mb-2 text-xs font-medium text-gray-600">블록 미리보기</p>
            <div className="flex flex-wrap gap-1">
              {selectedBlockSet.blocks.slice(0, 5).map((block) => (
                <span
                  key={block.id}
                  className="inline-flex items-center rounded bg-white px-2 py-1 text-xs text-gray-700 shadow-sm"
                >
                  {["일", "월", "화", "수", "목", "금", "토"][block.day_of_week]}요일{" "}
                  {block.start_time.slice(0, 5)}-{block.end_time.slice(0, 5)}
                </span>
              ))}
              {selectedBlockSet.blocks.length > 5 && (
                <span className="inline-flex items-center rounded bg-gray-100 px-2 py-1 text-xs text-gray-500">
                  +{selectedBlockSet.blocks.length - 5}개 더
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600" data-testid="error-general">
          {error}
        </div>
      )}
    </div>
  );
}
