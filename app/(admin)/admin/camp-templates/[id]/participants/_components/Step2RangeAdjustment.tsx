"use client";

import { useState, useEffect, useTransition } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { getPlanGroupContentsForRangeAdjustment } from "@/app/(admin)/actions/campTemplateActions";
import type { ScheduleSummary } from "@/lib/plan/rangeRecommendation";
import { Minus, Plus, AlertTriangle, Loader2 } from "lucide-react";

type Participant = {
  groupId: string;
  studentId: string;
  studentName: string;
};

type Step2RangeAdjustmentProps = {
  templateId: string;
  participants: Participant[];
  step1Data: {
    subjectCounts: Record<string, Record<string, number>>;
    replaceExisting: boolean;
  };
  initialData?: {
    rangeAdjustments: Record<string, Array<{
      contentId: string;
      contentType: "book" | "lecture";
      startRange: number;
      endRange: number;
    }>>;
  } | null;
  onComplete: (data: {
    rangeAdjustments: Record<string, Array<{
      contentId: string;
      contentType: "book" | "lecture";
      startRange: number;
      endRange: number;
    }>>;
  }) => void;
  onBack: () => void;
};

type ContentInfo = {
  contentId: string;
  contentType: "book" | "lecture";
  title: string;
  totalAmount: number;
  currentStartRange: number;
  currentEndRange: number;
  recommendedStartRange?: number;
  recommendedEndRange?: number;
  unavailableReason?: string;
};

type StudentContentData = {
  groupId: string;
  studentName: string;
  contents: ContentInfo[];
  scheduleSummary: ScheduleSummary | null;
  loading: boolean;
  error?: string;
};

export function Step2RangeAdjustment({
  templateId,
  participants,
  step1Data,
  initialData,
  onComplete,
  onBack,
}: Step2RangeAdjustmentProps) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [studentData, setStudentData] = useState<Map<string, StudentContentData>>(new Map());
  const [rangeAdjustments, setRangeAdjustments] = useState<Record<string, Array<{
    contentId: string;
    contentType: "book" | "lecture";
    startRange: number;
    endRange: number;
  }>>>(initialData?.rangeAdjustments || {});

  // Step 1에서 설정한 콘텐츠에 대한 범위 추천 계산
  useEffect(() => {
    const loadData = async () => {
      const newStudentData = new Map<string, StudentContentData>();

      // 각 학생의 콘텐츠 및 스케줄 정보 조회
      for (const participant of participants) {
        try {
          // 서버 액션을 통해 콘텐츠 및 스케줄 정보 조회
          const result = await getPlanGroupContentsForRangeAdjustment(participant.groupId);

          if (!result.success || !result.contents) {
            newStudentData.set(participant.groupId, {
              groupId: participant.groupId,
              studentName: participant.studentName,
              contents: [],
              scheduleSummary: null,
              loading: false,
              error: result.error || "데이터 조회에 실패했습니다.",
            });
            continue;
          }

          // 콘텐츠 정보 변환
          const contentInfos: ContentInfo[] = result.contents.map((content) => ({
            contentId: content.contentId,
            contentType: content.contentType,
            title: content.title,
            totalAmount: content.totalAmount,
            currentStartRange: content.currentStartRange,
            currentEndRange: content.currentEndRange,
          }));

          // 스케줄 요약 정보
          const scheduleSummary: ScheduleSummary | null = result.scheduleSummary || null;

          // 서버에서 계산된 범위 추천 정보 사용
          const recommendedRanges = result.recommendedRanges || {};
          const unavailableReasons = result.unavailableReasons || {};

          // 추천 범위 적용
          const contentsWithRecommendation = contentInfos.map((content) => {
            const recommended = recommendedRanges[content.contentId];
            const unavailableReason = unavailableReasons[content.contentId];

            return {
              ...content,
              recommendedStartRange: recommended?.start,
              recommendedEndRange: recommended?.end,
              unavailableReason,
            };
          });

          newStudentData.set(participant.groupId, {
            groupId: participant.groupId,
            studentName: participant.studentName,
            contents: contentsWithRecommendation,
            scheduleSummary,
            loading: false,
          });
        } catch (error) {
          console.error(`학생 ${participant.studentName} 데이터 로드 실패:`, error);
          newStudentData.set(participant.groupId, {
            groupId: participant.groupId,
            studentName: participant.studentName,
            contents: [],
            scheduleSummary: null,
            loading: false,
            error: error instanceof Error ? error.message : "데이터 로드 실패",
          });
        }
      }

      setStudentData(newStudentData);

      // 초기 범위 조절 데이터 설정 (추천 범위 사용)
      const initialAdjustments: Record<string, Array<{
        contentId: string;
        contentType: "book" | "lecture";
        startRange: number;
        endRange: number;
      }>> = {};

      newStudentData.forEach((data, groupId) => {
        if (data.contents.length > 0) {
          initialAdjustments[groupId] = data.contents.map((content) => ({
            contentId: content.contentId,
            contentType: content.contentType,
            startRange: content.recommendedStartRange ?? content.currentStartRange,
            endRange: content.recommendedEndRange ?? content.currentEndRange,
          }));
        }
      });

      setRangeAdjustments(initialAdjustments);
    };

    loadData();
  }, [templateId, participants, step1Data, toast]);

  const updateRange = (groupId: string, contentId: string, field: "startRange" | "endRange", value: number) => {
    setRangeAdjustments((prev) => {
      const adjustments = prev[groupId] || [];
      const updated = adjustments.map((adj) =>
        adj.contentId === contentId ? { ...adj, [field]: value } : adj
      );
      return { ...prev, [groupId]: updated };
    });
  };

  const applyRecommendedRange = (groupId: string, contentId: string) => {
    const studentDataItem = studentData.get(groupId);
    if (!studentDataItem) return;

    const content = studentDataItem.contents.find((c) => c.contentId === contentId);
    if (!content || !content.recommendedStartRange || !content.recommendedEndRange) return;

    updateRange(groupId, contentId, "startRange", content.recommendedStartRange);
    updateRange(groupId, contentId, "endRange", content.recommendedEndRange);
  };

  const handleNext = () => {
    // 범위 유효성 검증
    const errors: string[] = [];
    Object.entries(rangeAdjustments).forEach(([groupId, adjustments]) => {
      const studentName = studentData.get(groupId)?.studentName || "알 수 없음";
      adjustments.forEach((adj) => {
        if (adj.startRange >= adj.endRange) {
          errors.push(`${studentName}: 콘텐츠 ${adj.contentId}의 범위가 유효하지 않습니다.`);
        }
      });
    });

    if (errors.length > 0) {
      toast.showError(errors[0]);
      return;
    }

    onComplete({ rangeAdjustments });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-gray-900">Step 2: 범위 조절</h3>
        <p className="text-sm text-gray-700">
          각 콘텐츠의 학습 범위를 조절합니다. 자동 추천된 범위를 사용하거나 수동으로 조절할 수 있습니다.
        </p>
      </div>

      {/* 학생별 콘텐츠 범위 테이블 */}
      <div className="flex flex-col gap-6">
        {Array.from(studentData.values()).map((data) => (
          <div key={data.groupId} className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4">
            <h4 className="text-sm font-semibold text-gray-900">
              {data.studentName}
            </h4>
            {data.loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                <span className="text-sm text-gray-600">로딩 중...</span>
              </div>
            ) : data.error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-800">{data.error}</p>
              </div>
            ) : data.contents.length === 0 ? (
              <p className="text-sm text-gray-500">콘텐츠가 없습니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-900">
                        콘텐츠
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-semibold text-gray-900">
                        총량
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-semibold text-gray-900">
                        시작 범위
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-semibold text-gray-900">
                        종료 범위
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-semibold text-gray-900">
                        작업
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.contents.map((content) => {
                      const adjustments = rangeAdjustments[data.groupId] || [];
                      const adjustment = adjustments.find((a) => a.contentId === content.contentId);
                      const startRange = adjustment?.startRange ?? content.currentStartRange;
                      const endRange = adjustment?.endRange ?? content.currentEndRange;
                      const hasRecommendation = content.recommendedStartRange !== undefined && content.recommendedEndRange !== undefined;

                      return (
                        <tr key={content.contentId} className="border-b border-gray-100">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{content.title}</div>
                            <div className="text-xs text-gray-500">{content.contentType === "book" ? "교재" : "강의"}</div>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-600">
                            {content.totalAmount > 0 ? content.totalAmount : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => updateRange(data.groupId, content.contentId, "startRange", Math.max(1, startRange - 1))}
                                className="flex h-7 w-7 items-center justify-center rounded border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <input
                                type="number"
                                value={startRange}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value) || 1;
                                  updateRange(data.groupId, content.contentId, "startRange", Math.max(1, Math.min(value, endRange - 1)));
                                }}
                                className="w-20 rounded border border-gray-300 px-2 py-1 text-center text-sm"
                                min={1}
                                max={endRange - 1}
                              />
                              <button
                                type="button"
                                onClick={() => updateRange(data.groupId, content.contentId, "startRange", Math.min(startRange + 1, endRange - 1))}
                                className="flex h-7 w-7 items-center justify-center rounded border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => updateRange(data.groupId, content.contentId, "endRange", Math.max(startRange + 1, endRange - 1))}
                                className="flex h-7 w-7 items-center justify-center rounded border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <input
                                type="number"
                                value={endRange}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value) || 1;
                                  updateRange(data.groupId, content.contentId, "endRange", Math.max(startRange + 1, Math.min(value, content.totalAmount || 9999)));
                                }}
                                className="w-20 rounded border border-gray-300 px-2 py-1 text-center text-sm"
                                min={startRange + 1}
                                max={content.totalAmount || 9999}
                              />
                              <button
                                type="button"
                                onClick={() => updateRange(data.groupId, content.contentId, "endRange", Math.min(endRange + 1, content.totalAmount || 9999))}
                                className="flex h-7 w-7 items-center justify-center rounded border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {hasRecommendation && (
                              <button
                                type="button"
                                onClick={() => applyRecommendedRange(data.groupId, content.contentId)}
                                className="rounded border border-indigo-300 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100"
                              >
                                추천 적용
                              </button>
                            )}
                            {content.unavailableReason && (
                              <div className="flex items-center gap-1 text-xs text-red-600">
                                <AlertTriangle className="h-3 w-3" />
                                <span>{content.unavailableReason}</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
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
          onClick={handleNext}
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          다음 단계
        </button>
      </div>
    </div>
  );
}

