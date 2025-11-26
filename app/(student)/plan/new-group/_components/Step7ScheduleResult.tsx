"use client";

import { useState, useEffect } from "react";
import { 
  getScheduleResultDataAction,
  generatePlansFromGroupAction,
  checkPlansExistAction,
} from "@/app/(student)/actions/planGroupActions";
import { ScheduleTableView } from "./Step7ScheduleResult/ScheduleTableView";
import { transformPlansToScheduleTable } from "./utils/scheduleTransform";
import { PlanPreviewDialog } from "@/app/(student)/plan/group/[id]/_components/PlanPreviewDialog";
import type {
  PlanData,
  ContentData,
  BlockData,
} from "./utils/scheduleTransform";

type Step7ScheduleResultProps = {
  groupId: string;
  onComplete: () => void;
};

export function Step7ScheduleResult({
  groupId,
  onComplete,
}: Step7ScheduleResultProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dailySchedule, setDailySchedule] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [contents, setContents] = useState<Map<string, ContentData>>(new Map());
  const [blocks, setBlocks] = useState<BlockData[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // 플랜 존재 여부 확인
        const checkResult = await checkPlansExistAction(groupId);
        
        // 플랜이 없으면 자동으로 생성
        if (!checkResult.hasPlans) {
          setGenerating(true);
          try {
            await generatePlansFromGroupAction(groupId);
          } catch (genError) {
            setError(
              genError instanceof Error 
                ? `플랜 생성 실패: ${genError.message}` 
                : "플랜 생성 중 오류가 발생했습니다."
            );
            setLoading(false);
            setGenerating(false);
            return;
          }
          setGenerating(false);
        }

        // 모든 데이터를 한 번에 조회
        const result = await getScheduleResultDataAction(groupId);

        if (result.plans.length === 0) {
          setError("생성된 플랜이 없습니다.");
          setLoading(false);
          return;
        }

        // contents 배열을 Map으로 변환
        const contentsMap = new Map(
          result.contents.map((c) => [c.id, c])
        );

        setDailySchedule(result.dailySchedule || []);
        setPlans(result.plans || []);
        setContents(contentsMap);
        setBlocks(result.blocks || []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "데이터를 불러오는 중 오류가 발생했습니다."
        );
      } finally {
        setLoading(false);
        setGenerating(false);
      }
    };

    fetchData();
  }, [groupId]);

  if (loading || generating) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">스케줄 결과</h2>
          <p className="mt-1 text-sm text-gray-500">
            {generating ? "플랜을 생성하는 중입니다..." : "생성된 학습 플랜을 확인할 수 있습니다."}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-gray-900"></div>
          <p className="mt-4 text-sm text-gray-500">
            {generating ? "플랜 생성 중..." : "데이터를 불러오는 중..."}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">스케줄 결과</h2>
          <p className="mt-1 text-sm text-gray-500">
            생성된 학습 플랜을 확인할 수 있습니다.
          </p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h3 className="mb-2 text-sm font-semibold text-red-800">오류</h3>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">스케줄 결과</h2>
            <p className="mt-1 text-sm text-gray-500">
              생성된 학습 플랜을 확인할 수 있습니다. 총 {plans.length}개의 플랜이 생성되었습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            플랜 미리보기 및 재생성
          </button>
        </div>

        <ScheduleTableView
          dailySchedule={dailySchedule}
          plans={plans}
          contents={contents}
          blocks={blocks}
        />

        {/* 완료 버튼 */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onComplete}
            className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-6 py-3 text-sm font-semibold text-white hover:bg-gray-800"
          >
            완료
          </button>
        </div>
      </div>
      <PlanPreviewDialog
        groupId={groupId}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        onPlansGenerated={() => {
          // 플랜 재생성 후 데이터 새로고침
          const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
              const result = await getScheduleResultDataAction(groupId);
              if (result.plans.length === 0) {
                setError("생성된 플랜이 없습니다.");
                setLoading(false);
                return;
              }
              const contentsMap = new Map(
                result.contents.map((c) => [c.id, c])
              );
              setDailySchedule(result.dailySchedule || []);
              setPlans(result.plans || []);
              setContents(contentsMap);
              setBlocks(result.blocks || []);
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "데이터를 불러오는 중 오류가 발생했습니다."
              );
            } finally {
              setLoading(false);
            }
          };
          fetchData();
        }}
      />
    </>
  );
}

