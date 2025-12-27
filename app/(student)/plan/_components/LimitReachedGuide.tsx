"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Zap, CheckCircle, Trash2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";

type PlanGroupSummary = {
  id: string;
  name: string;
  progressPercent: number;
  canComplete: boolean; // 95% 이상이면 완료 가능
};

type LimitReachedGuideProps = {
  current: number;
  max: number;
  nearCompletionGroups?: PlanGroupSummary[];
  selectedContent?: {
    id: string;
    title: string;
    type: "book" | "lecture" | "custom";
  };
};

export function LimitReachedGuide({
  current,
  max,
  nearCompletionGroups = [],
  selectedContent,
}: LimitReachedGuideProps) {
  const router = useRouter();

  const handleAdHocRedirect = () => {
    // 선택된 콘텐츠 정보를 URL 파라미터로 전달
    const params = new URLSearchParams();
    params.set("addPlan", "true");
    if (selectedContent) {
      params.set("contentId", selectedContent.id);
      params.set("contentTitle", selectedContent.title);
      params.set("contentType", selectedContent.type);
    }
    router.push(`/today?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      {/* 경고 헤더 */}
      <div className="rounded-xl border-2 border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-red-100 p-2 dark:bg-red-900/40">
            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-red-800 dark:text-red-200">
              플랜그룹 한도에 도달했습니다
            </h2>
            <p className="mt-0.5 text-sm text-red-600 dark:text-red-400">
              현재 {current}/{max}개 사용 중
            </p>
          </div>
        </div>

        {selectedContent && (
          <div className="mt-4 rounded-lg bg-white/50 p-3 dark:bg-gray-800/50">
            <p className="text-sm text-red-700 dark:text-red-300">
              선택한 콘텐츠: <strong>{selectedContent.title}</strong>
            </p>
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              아래 방법을 통해 이 콘텐츠를 학습 계획에 추가할 수 있습니다.
            </p>
          </div>
        )}
      </div>

      {/* 옵션들 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* 옵션 1: 단발성 플랜으로 추가 (권장) */}
        <div
          onClick={handleAdHocRedirect}
          className="cursor-pointer rounded-xl border-2 border-purple-300 bg-purple-50 p-5 transition-all hover:border-purple-400 hover:shadow-lg dark:border-purple-700 dark:bg-purple-900/20 dark:hover:border-purple-600"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-purple-200 p-2 dark:bg-purple-800">
              <Zap className="h-5 w-5 text-purple-700 dark:text-purple-300" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-purple-900 dark:text-purple-100">
                  단발성 플랜으로 추가
                </h3>
                <span className="rounded bg-purple-200 px-1.5 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-800 dark:text-purple-200">
                  권장
                </span>
              </div>
              <p className="mt-1 text-sm text-purple-700 dark:text-purple-300">
                플랜그룹 제한 없이 오늘/이번 주에 바로 추가
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
              바로 추가하기
            </span>
            <ArrowRight className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
        </div>

        {/* 옵션 2: 기존 플랜 완료하기 */}
        <div className="rounded-xl border-2 border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900/30">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                기존 플랜 완료하기
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                완료된 플랜그룹은 자동으로 제한에서 제외
              </p>
            </div>
          </div>

          {nearCompletionGroups.length > 0 ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                완료 가능한 플랜그룹:
              </p>
              {nearCompletionGroups.slice(0, 3).map((group) => (
                <Link
                  key={group.id}
                  href={`/plan/group/${group.id}`}
                  className="flex items-center justify-between rounded-lg bg-green-50 px-3 py-2 text-sm hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/40"
                >
                  <span className="text-gray-700 dark:text-gray-300">
                    {group.name}
                  </span>
                  <span className="text-green-600 dark:text-green-400">
                    {group.progressPercent}%
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-sm text-gray-400 dark:text-gray-500">
                완료 가능한 플랜그룹이 없습니다
              </p>
              <Link
                href="/plan"
                className="mt-2 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline dark:text-blue-400"
              >
                플랜 목록 보기
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          )}
        </div>

        {/* 옵션 3: 불필요한 플랜 삭제 */}
        <div className="rounded-xl border-2 border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-gray-100 p-2 dark:bg-gray-700">
              <Trash2 className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                불필요한 플랜 삭제
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                더 이상 필요 없는 플랜그룹 정리
              </p>
            </div>
          </div>

          <div className="mt-4">
            <Link
              href="/plan"
              className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
            >
              플랜 목록으로
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* 추가 안내 */}
      <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-400">
        <h4 className="font-medium text-gray-700 dark:text-gray-300">
          왜 9개 제한이 있나요?
        </h4>
        <p className="mt-1">
          플랜그룹은 장기 학습 계획을 위한 기능입니다. 너무 많은 플랜그룹은
          관리와 집중을 어렵게 합니다. 임시 학습이나 추가 과제는 단발성 플랜을
          활용하세요.
        </p>
      </div>
    </div>
  );
}
