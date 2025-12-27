"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Settings, Zap, ChevronRight, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";

type Template = {
  id: string;
  name: string | null;
};

type ContentAddHubProps = {
  templates: Template[];
  contentCount: {
    current: number;
    max: number;
    canAdd: boolean;
    remaining: number;
  };
  studentId: string;
  tenantId: string;
};

export function ContentAddHub({
  templates,
  contentCount,
  studentId,
  tenantId,
}: ContentAddHubProps) {
  const router = useRouter();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [showAdHocModal, setShowAdHocModal] = useState(false);

  const hasTemplates = templates.length > 0;
  const isNearLimit = contentCount.remaining <= 2 && contentCount.remaining > 0;
  const isAtLimit = !contentCount.canAdd;

  const handleTemplateSelect = () => {
    if (selectedTemplateId) {
      router.push(`/plan/content-add/${selectedTemplateId}`);
    }
  };

  const handleDirectSetup = () => {
    // 직접 설정: 7단계 위저드의 간소화 버전으로 이동
    // 기존 템플릿 없이 기간/요일/콘텐츠를 직접 설정
    router.push("/plan/new-group?mode=quick");
  };

  const handleAdHocAdd = () => {
    // 단발성 추가: Today 페이지의 플랜 추가 모달 열기
    // URL 파라미터로 모달 트리거
    router.push("/today?addPlan=true");
  };

  return (
    <div className="space-y-6">
      {/* 현재 사용량 표시 */}
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border p-4",
          isAtLimit
            ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
            : isNearLimit
              ? "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20"
              : "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
        )}
      >
        {isAtLimit ? (
          <AlertTriangle className="h-5 w-5 text-red-500" />
        ) : (
          <Info className="h-5 w-5 text-gray-400" />
        )}
        <div className="flex-1">
          <p
            className={cn(
              "text-sm font-medium",
              isAtLimit
                ? "text-red-700 dark:text-red-300"
                : "text-gray-700 dark:text-gray-300"
            )}
          >
            현재 플랜그룹: {contentCount.current}/{contentCount.max}개 사용 중
          </p>
          {isAtLimit && (
            <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
              더 이상 플랜그룹을 추가할 수 없습니다. 단발성 플랜을 이용하세요.
            </p>
          )}
          {isNearLimit && !isAtLimit && (
            <p className="mt-0.5 text-xs text-yellow-600 dark:text-yellow-400">
              {contentCount.remaining}개 슬롯이 남았습니다.
            </p>
          )}
        </div>
      </div>

      {/* 옵션 카드들 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* 옵션 1: 템플릿 사용 */}
        <div
          className={cn(
            "rounded-xl border-2 p-5 transition-all",
            hasTemplates && !isAtLimit
              ? "cursor-pointer border-gray-200 hover:border-blue-400 hover:shadow-md dark:border-gray-700 dark:hover:border-blue-500"
              : "cursor-not-allowed border-gray-100 opacity-50 dark:border-gray-800"
          )}
        >
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
              <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                템플릿 사용
              </h3>
              {hasTemplates && (
                <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  권장
                </span>
              )}
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                기존 플랜 설정(기간, 요일, 시간)을 상속받아 빠르게 콘텐츠 추가
              </p>
            </div>
          </div>

          {hasTemplates && !isAtLimit ? (
            <div className="mt-4 space-y-3">
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
              >
                <option value="">플랜 선택...</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name || "이름 없음"}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleTemplateSelect}
                disabled={!selectedTemplateId}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500"
              >
                콘텐츠 추가하기
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="mt-4 text-sm text-gray-400 dark:text-gray-500">
              {isAtLimit
                ? "플랜그룹 한도 도달"
                : "사용 가능한 템플릿이 없습니다"}
            </div>
          )}
        </div>

        {/* 옵션 2: 직접 설정 */}
        <div
          onClick={!isAtLimit ? handleDirectSetup : undefined}
          className={cn(
            "rounded-xl border-2 p-5 transition-all",
            !isAtLimit
              ? "cursor-pointer border-gray-200 hover:border-green-400 hover:shadow-md dark:border-gray-700 dark:hover:border-green-500"
              : "cursor-not-allowed border-gray-100 opacity-50 dark:border-gray-800"
          )}
        >
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900/30">
              <Settings className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                직접 설정
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                기간, 요일, 시간을 직접 입력하여 새 플랜그룹 생성
              </p>
            </div>
          </div>

          <div className="mt-4">
            {!isAtLimit ? (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <span>설정하기</span>
                <ChevronRight className="h-4 w-4" />
              </div>
            ) : (
              <div className="text-sm text-gray-400 dark:text-gray-500">
                플랜그룹 한도 도달
              </div>
            )}
          </div>
        </div>

        {/* 옵션 3: 단발성 추가 */}
        <div
          onClick={handleAdHocAdd}
          className={cn(
            "cursor-pointer rounded-xl border-2 p-5 transition-all hover:shadow-md",
            isAtLimit || isNearLimit
              ? "border-purple-400 bg-purple-50 hover:border-purple-500 dark:border-purple-600 dark:bg-purple-900/20"
              : "border-gray-200 hover:border-purple-400 dark:border-gray-700 dark:hover:border-purple-500"
          )}
        >
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-purple-100 p-2 dark:bg-purple-900/30">
              <Zap className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                단발성 추가
              </h3>
              {(isAtLimit || isNearLimit) && (
                <span className="ml-2 rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                  추천
                </span>
              )}
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                플랜그룹 제한 없이 오늘/이번 주에 바로 추가
              </p>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400">
              <span>바로 추가하기</span>
              <ChevronRight className="h-4 w-4" />
            </div>
          </div>

          {/* 단발성 플랜 특징 */}
          <div className="mt-3 rounded-lg bg-purple-100/50 p-2 text-xs text-purple-700 dark:bg-purple-900/20 dark:text-purple-300">
            <ul className="space-y-1">
              <li>• 플랜그룹 개수 제한 없음</li>
              <li>• 반복 설정 가능 (매일/매주)</li>
              <li>• 콘텐츠 연결 가능</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 도움말 */}
      <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-400">
        <h4 className="font-medium text-gray-700 dark:text-gray-300">
          어떤 방식을 선택해야 할까요?
        </h4>
        <ul className="mt-2 space-y-1.5">
          <li>
            <strong className="text-blue-600 dark:text-blue-400">템플릿 사용:</strong>{" "}
            이미 설정된 플랜에 같은 조건으로 콘텐츠를 추가할 때
          </li>
          <li>
            <strong className="text-green-600 dark:text-green-400">직접 설정:</strong>{" "}
            새로운 기간/요일로 장기 학습 계획을 세울 때
          </li>
          <li>
            <strong className="text-purple-600 dark:text-purple-400">단발성 추가:</strong>{" "}
            임시 학습, 테스트, 또는 9개 제한에 도달했을 때
          </li>
        </ul>
      </div>
    </div>
  );
}
