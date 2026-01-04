"use client";

/**
 * Step 7: 생성 및 결과
 *
 * Phase 3: 7단계 위저드 확장
 * - 플랜 그룹 생성 실행
 * - 진행 상태 표시
 * - 결과 및 다음 단계 안내
 *
 * @module app/(admin)/admin/students/[id]/plans/_components/admin-wizard/steps/Step7GenerateResult
 */

import { useState, useCallback } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Sparkles,
  ArrowRight,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  useAdminWizardData,
  useAdminWizardStep,
  useAdminWizardValidation,
} from "../_context";

/**
 * Step7GenerateResult Props
 */
interface Step7GenerateResultProps {
  studentId: string;
  tenantId: string;
  studentName: string;
  onSubmit: () => Promise<void>;
  onSuccess: (groupId: string, generateAI: boolean) => void;
  onClose: () => void;
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
}: Step7GenerateResultProps) {
  const { wizardData, isSubmitting, error, createdGroupId, setSubmitting, setError } =
    useAdminWizardData();
  const { prevStep } = useAdminWizardStep();
  const { hasErrors, validationErrors } = useAdminWizardValidation();

  const { generateAIPlan, selectedContents, skipContents } = wizardData;

  const [phase, setPhase] = useState<GenerationPhase>("idle");
  const [progress, setProgress] = useState(0);

  // 생성 실행
  const handleGenerate = useCallback(async () => {
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
      await onSubmit();

      setProgress(60);

      if (generateAIPlan) {
        setPhase("generating_ai");
        setProgress(80);

        // AI 생성은 onSubmit 내부에서 처리됨
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      setProgress(100);
      setPhase("completed");
    } catch (err) {
      console.error("[Step7] 생성 실패:", err);
      setPhase("error");
      setError(err instanceof Error ? err.message : "플랜 생성 중 오류가 발생했습니다.");
    }
  }, [hasErrors, generateAIPlan, onSubmit, setError]);

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
        <div className="space-y-4">
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
