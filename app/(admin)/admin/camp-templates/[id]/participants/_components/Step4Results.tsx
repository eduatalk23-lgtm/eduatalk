"use client";

import { useState, useEffect, useTransition } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { bulkApplyRecommendedContents, bulkAdjustPlanRanges, bulkGeneratePlans } from "@/app/(admin)/actions/campTemplateActions";
import { CheckCircle2, XCircle, AlertTriangle, Loader2 } from "lucide-react";

type Participant = {
  groupId: string;
  studentId: string;
  studentName: string;
};

type Step4ResultsProps = {
  templateId: string;
  participants: Participant[];
  step1Data: {
    subjectCounts: Record<string, Record<string, number>>;
    replaceExisting: boolean;
  };
  step2Data: {
    rangeAdjustments: Record<string, Array<{
      contentId: string;
      contentType: "book" | "lecture";
      startRange: number;
      endRange: number;
    }>>;
  };
  step3Data: {
    selectedGroupIds: Set<string>;
    previewResults?: Record<string, {
      planCount: number;
      previewData?: any[];
      error?: string;
    }>;
  };
  initialData?: {
    results: {
      contentRecommendation: {
        success: boolean;
        successCount: number;
        failureCount: number;
        errors?: Array<{ groupId: string; error: string }>;
      };
      rangeAdjustment: {
        success: boolean;
        successCount: number;
        failureCount: number;
        errors?: Array<{ groupId: string; error: string }>;
      };
      planGeneration: {
        success: boolean;
        successCount: number;
        failureCount: number;
        errors?: Array<{ groupId: string; error: string }>;
      };
    };
  } | null;
  onComplete: () => void;
  onBack: () => void;
};

export function Step4Results({
  templateId,
  participants,
  step1Data,
  step2Data,
  step3Data,
  initialData,
  onComplete,
  onBack,
}: Step4ResultsProps) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<Step4ResultsProps["initialData"]>(initialData);

  // 결과 처리 실행
  useEffect(() => {
    if (results) return; // 이미 처리됨

    const processAll = async () => {
      setProcessing(true);
      try {
        // Step 1: 콘텐츠 추천 적용 (이미 Step 2에서 적용했지만 다시 확인)
        const contentResult = await bulkApplyRecommendedContents(
          templateId,
          participants.map((p) => p.groupId),
          step1Data.subjectCounts,
          { replaceExisting: step1Data.replaceExisting }
        );

        // Step 2: 범위 조절 적용
        const rangeResult = await bulkAdjustPlanRanges(
          participants.map((p) => p.groupId),
          step2Data.rangeAdjustments
        );

        // Step 3: 플랜 생성
        const selectedGroupIdsArray = Array.from(step3Data.selectedGroupIds);
        const planResult = await bulkGeneratePlans(selectedGroupIdsArray);

        setResults({
          results: {
            contentRecommendation: contentResult,
            rangeAdjustment: rangeResult,
            planGeneration: planResult,
          },
        });

        // 전체 성공 여부 확인
        const allSuccess =
          contentResult.success &&
          rangeResult.success &&
          planResult.success;

        if (allSuccess) {
          toast.showSuccess("모든 작업이 완료되었습니다.");
        } else {
          toast.showError("일부 작업이 실패했습니다. 결과를 확인해주세요.");
        }
      } catch (error) {
        console.error("작업 처리 실패:", error);
        toast.showError("작업 처리 중 오류가 발생했습니다.");
      } finally {
        setProcessing(false);
      }
    };

    processAll();
  }, [results, templateId, participants, step1Data, step2Data, step3Data, toast]);

  if (processing || !results) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <p className="text-sm text-gray-600">작업을 처리하는 중...</p>
      </div>
    );
  }

  const { contentRecommendation, rangeAdjustment, planGeneration } = results.results;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-gray-900">Step 4: 결과</h3>
        <p className="text-sm text-gray-700">
          모든 작업이 완료되었습니다. 결과를 확인해주세요.
        </p>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-600">콘텐츠 추천</div>
          <div className="flex items-center gap-2">
            {contentRecommendation.success ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
            <span className="text-lg font-semibold text-gray-900">
              {contentRecommendation.successCount} / {participants.length}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-600">범위 조절</div>
          <div className="flex items-center gap-2">
            {rangeAdjustment.success ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
            <span className="text-lg font-semibold text-gray-900">
              {rangeAdjustment.successCount} / {participants.length}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-600">플랜 생성</div>
          <div className="flex items-center gap-2">
            {planGeneration.success ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
            <span className="text-lg font-semibold text-gray-900">
              {planGeneration.successCount} / {step3Data.selectedGroupIds.size}
            </span>
          </div>
        </div>
      </div>

      {/* 상세 결과 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse rounded-lg border border-gray-200 bg-white text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="border-b border-gray-200 px-4 py-3 text-left text-xs font-semibold text-gray-900">
                학생명
              </th>
              <th className="border-b border-gray-200 px-4 py-3 text-center text-xs font-semibold text-gray-900">
                콘텐츠 추천
              </th>
              <th className="border-b border-gray-200 px-4 py-3 text-center text-xs font-semibold text-gray-900">
                범위 조절
              </th>
              <th className="border-b border-gray-200 px-4 py-3 text-center text-xs font-semibold text-gray-900">
                플랜 생성
              </th>
            </tr>
          </thead>
          <tbody>
            {participants.map((participant) => {
              const contentError = contentRecommendation.errors?.find(
                (e) => e.groupId === participant.groupId
              );
              const rangeError = rangeAdjustment.errors?.find(
                (e) => e.groupId === participant.groupId
              );
              const planError = planGeneration.errors?.find(
                (e) => e.groupId === participant.groupId
              );
              const wasSelected = step3Data.selectedGroupIds.has(participant.groupId);

              const contentSuccess = !contentError;
              const rangeSuccess = !rangeError;
              const planSuccess = !wasSelected || !planError;

              return (
                <tr key={participant.groupId} className="border-b border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {participant.studentName}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {contentSuccess ? (
                      <CheckCircle2 className="mx-auto h-5 w-5 text-green-600" />
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <XCircle className="h-5 w-5 text-red-600" />
                        <span className="text-xs text-red-600">{contentError?.error}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {rangeSuccess ? (
                      <CheckCircle2 className="mx-auto h-5 w-5 text-green-600" />
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <XCircle className="h-5 w-5 text-red-600" />
                        <span className="text-xs text-red-600">{rangeError?.error}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {!wasSelected ? (
                      <span className="text-xs text-gray-400">선택 안 함</span>
                    ) : planSuccess ? (
                      <CheckCircle2 className="mx-auto h-5 w-5 text-green-600" />
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <XCircle className="h-5 w-5 text-red-600" />
                        <span className="text-xs text-red-600">{planError?.error}</span>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 액션 버튼 */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          이전
        </button>
        <button
          type="button"
          onClick={onComplete}
          className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          완료
        </button>
      </div>
    </div>
  );
}

