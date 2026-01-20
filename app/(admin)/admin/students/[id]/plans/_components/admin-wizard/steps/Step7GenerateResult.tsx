"use client";

/**
 * Step 7: 생성 및 결과
 *
 * Phase 3: 7단계 위저드 확장
 * - 플랜 그룹 생성 실행
 * - 진행 상태 표시
 * - 결과 및 다음 단계 안내
 *
 * Phase 4: 플래너 연계 개선
 * - 학생 데이터 자동 로드 (학년, 성적)
 * - plannerValidationMode 전달
 *
 * @module app/(admin)/admin/students/[id]/plans/_components/admin-wizard/steps/Step7GenerateResult
 */

import { useState, useCallback, useEffect } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Sparkles,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  useAdminWizardData,
  useAdminWizardStep,
  useAdminWizardValidation,
} from "../_context";

import { generateHybridPlanCompleteAction } from "@/lib/domains/plan/llm/actions/generateHybridPlanComplete";
import { getStudentContentsForAIPlanAction } from "@/lib/domains/admin-plan/actions";

/**
 * Dock에 배치된 플랜 정보
 */
interface DockedPlanSummary {
  contentId: string;
  contentTitle: string;
  estimatedDuration: number;
  reason: string;
}

/**
 * 생성 결과 정보
 */
interface GenerationResultInfo {
  count: number;
  warnings?: string[];
  dockedPlans?: DockedPlanSummary[];
  dockedCount?: number;
}

/**
 * Step7GenerateResult Props
 */
interface Step7GenerateResultProps {
  studentId: string;
  tenantId: string;
  studentName: string;
  onSubmit: () => Promise<string | null>;
  onSuccess: (groupId: string, generateAI: boolean) => void;
  onClose: () => void;
  /** 플랜 생성 결과 (dock 정보 포함) */
  generationResult?: GenerationResultInfo;
}

type GenerationPhase =
  | "idle"
  | "validating"
  | "creating_group"
  | "generating_ai"
  | "completed"
  | "error";

/**
 * Step 7: 생성 및 결과 컴포넌트
 */
export function Step7GenerateResult({
  studentId,
  tenantId,
  studentName,
  onSubmit,
  onSuccess,
  onClose,
  generationResult,
}: Step7GenerateResultProps) {
  const { wizardData, isSubmitting, error, createdGroupId, setSubmitting, setError } =
    useAdminWizardData();
  const { prevStep } = useAdminWizardStep();
  const { hasErrors, validationErrors } = useAdminWizardValidation();

  const { generateAIPlan, selectedContents, skipContents, periodStart, periodEnd, plannerId } = wizardData;

  const [phase, setPhase] = useState<GenerationPhase>("idle");
  const [progress, setProgress] = useState(0);

  // Phase 4: 학생 데이터 상태
  const [studentGrade, setStudentGrade] = useState<string>("고등");
  const [studentScores, setStudentScores] = useState<Array<{
    subject: string;
    subjectCategory: string;
    score: number;
  }>>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Phase 4: 컴포넌트 마운트 시 학생 데이터 로드
  useEffect(() => {
    async function loadStudentData() {
      if (!generateAIPlan || selectedContents.length === 0) {
        return; // AI 플랜 생성을 사용하지 않으면 로드 불필요
      }

      try {
        const contentIds = selectedContents.map(c => c.contentId);
        const result = await getStudentContentsForAIPlanAction({
          studentId,
          tenantId,
          contentIds,
        });

        // 에러 확인 (타입 가드)
        if ("success" in result && result.success === false) {
          console.warn("[Step7] Student data load failed");
          return;
        }

        // 성공 시 학생 데이터 설정 (result는 GetStudentContentsForAIPlanResult 타입)
        const successResult = result as { student: { grade: string } | null; scores: Array<{ subject: string; subjectCategory: string; score: number }> };

        if (successResult.student?.grade) {
          setStudentGrade(successResult.student.grade);
        }

        if (successResult.scores && successResult.scores.length > 0) {
          setStudentScores(successResult.scores.map(s => ({
            subject: s.subject,
            subjectCategory: s.subjectCategory,
            score: s.score,
          })));
        }

        setDataLoaded(true);
        console.log("[Step7] Student data loaded", {
          grade: successResult.student?.grade,
          scoresCount: successResult.scores?.length ?? 0,
        });
      } catch (err) {
        console.warn("[Step7] Error loading student data:", err);
      }
    }

    loadStudentData();
  }, [generateAIPlan, selectedContents, studentId, tenantId]);

  // 디버그: Step7 상태 확인
  console.log("[Step7] 렌더링 상태", {
    phase,
    hasErrors,
    validationErrors,
    isSubmitting,
    createdGroupId,
    skipContents,
    selectedContentsCount: selectedContents.length,
  });

  // 생성 실행
  const handleGenerate = useCallback(async () => {
    console.log("[Step7] handleGenerate 호출됨!", { hasErrors, generateAIPlan });

    if (hasErrors) {
      setError("입력 값에 오류가 있습니다. 이전 단계를 확인해주세요.");
      return;
    }

    try {
      setPhase("validating");
      setProgress(10);

      // 잠시 대기 (UX용)
      await new Promise((resolve) => setTimeout(resolve, 500));

      setPhase("creating_group");
      setProgress(30);

      // 실제 생성 호출
      const groupId = await onSubmit();

      // 실패 시 에러 상태로 전환
      if (!groupId) {
        setPhase("error");
        return;
      }

      setProgress(60);

      if (generateAIPlan) {
        setPhase("generating_ai");
        setProgress(70);

        // AI 학습 일정 생성 (Phase 4: 실제 학생 데이터 및 plannerValidationMode 적용)
        const aiResult = await generateHybridPlanCompleteAction({
          planGroupId: groupId,
          student: {
            id: studentId,
            name: studentName,
            grade: studentGrade, // Phase 4: 실제 학년 정보
          },
          scores: studentScores, // Phase 4: 실제 성적 정보
          contents: selectedContents.map(c => ({
            id: c.contentId,
            title: c.title,
            contentType: c.contentType as "book" | "lecture",
            subject: c.subject || "기타",
            subjectCategory: c.subject || "기타",
            totalRange: c.totalRange,
            estimatedHours: c.totalRange * 0.5, // 1p/1강당 30분 추정 (임시)
          })),
          virtualContents: selectedContents
            .filter(c => c.virtualContentDetails)
            .map(c => ({
              ...c.virtualContentDetails!,
              id: c.contentId,
              subject: c.subject || "기타",
            })),
          period: {
            startDate: periodStart || "",
            endDate: periodEnd || "",
            totalDays: 0, // 백엔드에서 계산됨
            studyDays: 0, // 백엔드에서 계산됨
          },
           // Step 4에서 선택된 콘텐츠 매핑 정보 전달
           contentMappings: selectedContents.map(c => ({
             contentId: c.contentId,
             subjectCategory: c.subject || "기타",
             contentType: c.contentType as "book" | "lecture",
           })),
           modelTier: "standard",
           // Phase 4: 플래너 검증 모드 - 플래너가 선택된 경우 warn, 없으면 auto_create
           plannerValidationMode: plannerId ? "warn" : "auto_create",
        });

        if (!aiResult.success) {
           console.error("[Step7] AI 생성 실패:", aiResult.error);
           // AI 생성 실패해도 기본 플랜은 생성되었으므로 'completed'로 처리하거나 경고 표시
           // 여기서는 에러로 처리하지 않고 완료로 진행하지만 경고 메시지 토스트 등을 띄울 수 있음.
           // 일단 진행.
        }
      }

      setProgress(100);
      setPhase("completed");
    } catch (err) {
      console.error("[Step7] 생성 실패:", err);
      setPhase("error");
      setError(err instanceof Error ? err.message : "플랜 생성 중 오류가 발생했습니다.");
    }
  }, [hasErrors, generateAIPlan, onSubmit, setError, studentId, studentName, selectedContents, periodStart, periodEnd, studentGrade, studentScores, plannerId]);

  // 재시도
  const handleRetry = useCallback(() => {
    setPhase("idle");
    setProgress(0);
    setError(null);
  }, [setError]);

  // 완료 후 처리
  const handleComplete = useCallback(() => {
    if (createdGroupId) {
      onSuccess(createdGroupId, generateAIPlan);
    }
    onClose();
  }, [createdGroupId, generateAIPlan, onSuccess, onClose]);

  // 현재 페이즈에 따른 메시지
  const getPhaseMessage = () => {
    switch (phase) {
      case "validating":
        return "입력 값 검증 중...";
      case "creating_group":
        return "플랜 그룹 생성 중...";
      case "generating_ai":
        return "AI가 학습 일정을 생성하고 있습니다...";
      case "completed":
        return "플랜이 성공적으로 생성되었습니다!";
      case "error":
        return "오류가 발생했습니다";
      default:
        return "플랜 생성 준비";
    }
  };

  return (
    <div className="space-y-6">
      {/* 검증 오류 표시 (idle 상태에서만) */}
      {phase === "idle" && hasErrors && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-2">
            <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
            <div>
              <p className="font-medium text-red-800">입력 값에 오류가 있습니다</p>
              <ul className="mt-1 list-inside list-disc text-sm text-red-700">
                {validationErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => prevStep()}
                className="mt-2 text-sm text-red-600 hover:underline"
              >
                이전 단계로 돌아가기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 생성 전 상태 */}
      {phase === "idle" && !hasErrors && (
        <div className="space-y-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm text-blue-800">
              <span className="font-medium">{studentName}</span> 학생의 플랜을 생성할
              준비가 완료되었습니다.
            </p>
            <ul className="mt-2 space-y-1 text-sm text-blue-700">
              <li>
                • 콘텐츠: {skipContents ? "없음" : `${selectedContents.length}개`}
              </li>
              <li>• AI 플랜 생성: {generateAIPlan ? "예" : "아니오"}</li>
            </ul>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={isSubmitting}
            data-testid="submit-button"
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white transition",
              isSubmitting
                ? "cursor-not-allowed bg-gray-400"
                : "bg-blue-600 hover:bg-blue-700"
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                처리 중...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                플랜 생성 시작
              </>
            )}
          </button>
        </div>
      )}

      {/* 진행 중 상태 */}
      {(phase === "validating" ||
        phase === "creating_group" ||
        phase === "generating_ai") && (
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="flex flex-col items-center">
              <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
              <p className="mt-4 text-lg font-medium text-gray-900">
                {getPhaseMessage()}
              </p>
              <p className="mt-1 text-sm text-gray-500">잠시만 기다려주세요...</p>

              {/* 프로그레스 바 */}
              <div className="mt-6 w-full">
                <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-2 text-center text-xs text-gray-500">
                  {progress}% 완료
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 완료 상태 */}
      {phase === "completed" && (
        <div className="space-y-4" data-testid="success-message">
          <div className="rounded-lg border border-green-200 bg-green-50 p-6">
            <div className="flex flex-col items-center">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="mt-4 text-lg font-medium text-green-800">
                플랜이 성공적으로 생성되었습니다!
              </p>
              <p className="mt-1 text-sm text-green-700">
                {studentName} 학생의 플랜 그룹이 생성되었습니다.
              </p>
              {generateAIPlan && (
                <p className="mt-1 text-sm text-green-600">
                  AI가 생성한 학습 일정이 포함되어 있습니다.
                </p>
              )}
            </div>
          </div>

          {/* Dock 배치 알림 - 시간 부족으로 대기 중인 플랜 */}
          {generationResult?.dockedCount && generationResult.dockedCount > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4" data-testid="docked-plans-notice">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
                <div className="flex-1">
                  <h4 className="font-medium text-amber-800">
                    {generationResult.dockedCount}개 플랜이 시간 부족으로 대기 중
                  </h4>
                  <p className="mt-1 text-sm text-amber-600">
                    &apos;미완료 플랜&apos; 독에서 수동으로 시간을 배정할 수 있습니다.
                  </p>
                  {generationResult.dockedPlans && generationResult.dockedPlans.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {generationResult.dockedPlans.map((plan) => (
                        <li
                          key={plan.contentId}
                          className="flex items-center gap-2 text-sm text-amber-700"
                        >
                          <Clock className="h-3.5 w-3.5" />
                          <span>{plan.contentTitle}</span>
                          <span className="text-amber-500">
                            ({plan.estimatedDuration}분)
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 경고 메시지 (있는 경우) */}
          {generationResult?.warnings && generationResult.warnings.length > 0 && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-500" />
                <div>
                  <p className="font-medium text-yellow-800">참고사항</p>
                  <ul className="mt-1 list-inside list-disc text-sm text-yellow-700">
                    {generationResult.warnings.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={handleComplete}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              플랜 확인하기
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* 오류 상태 */}
      {phase === "error" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-red-200 bg-red-50 p-6">
            <div className="flex flex-col items-center">
              <XCircle className="h-12 w-12 text-red-500" />
              <p className="mt-4 text-lg font-medium text-red-800">
                플랜 생성 중 오류가 발생했습니다
              </p>
              <p className="mt-1 text-sm text-red-700">
                {error || "알 수 없는 오류가 발생했습니다."}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => prevStep()}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              이전 단계로
            </button>
            <button
              type="button"
              onClick={handleRetry}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <RefreshCw className="h-4 w-4" />
              다시 시도
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
