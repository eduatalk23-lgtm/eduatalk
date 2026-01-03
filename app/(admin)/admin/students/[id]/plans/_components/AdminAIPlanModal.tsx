'use client';

import { useState, useEffect } from 'react';
import { X, Wand2, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { AIPlanGeneratorPanel } from '@/app/(student)/plan/new-group/_components/_features/ai-mode';
import type { LLMPlanGenerationResponse } from '@/lib/domains/plan/llm';
import {
  getPlanGroupDetailsForAdminAction,
  saveAIGeneratedPlansAction,
} from '@/lib/domains/admin-plan/actions';
import { isErrorResult } from '@/lib/errors';

interface AdminAIPlanModalProps {
  studentId: string;
  tenantId: string;
  planGroupId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface PlanGroupData {
  startDate: string;
  endDate: string;
  contentIds: string[];
  excludeDays: number[];
}

/**
 * 관리자용 AI 플랜 생성 모달
 *
 * 학생의 활성 플랜 그룹을 기반으로 AI 플랜을 생성합니다.
 */
export function AdminAIPlanModal({
  studentId,
  tenantId,
  planGroupId,
  onClose,
  onSuccess,
}: AdminAIPlanModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [planGroupData, setPlanGroupData] = useState<PlanGroupData | null>(null);

  // 플랜 그룹 데이터 로드
  useEffect(() => {
    async function loadPlanGroupData() {
      try {
        setIsLoading(true);
        setError(null);

        const result = await getPlanGroupDetailsForAdminAction(planGroupId, tenantId);

        // 에러 확인
        if ('success' in result && result.success === false) {
          setError(result.error?.message || '플랜 그룹 데이터를 불러오는데 실패했습니다.');
          return;
        }

        // 성공 시 결과 처리
        const data = result as {
          group: { period_start: string; period_end: string } | null;
          contents: { content_id: string }[];
          exclusions: { exclusion_type: string; exclusion_date: string }[];
        };

        if (!data.group) {
          setError('플랜 그룹을 찾을 수 없습니다.');
          return;
        }

        if (data.contents.length === 0) {
          setError('플랜 그룹에 콘텐츠가 없습니다. 먼저 콘텐츠를 추가해주세요.');
          return;
        }

        // 제외 요일 계산 (휴일지정 타입만)
        const excludeDays = data.exclusions
          .filter((e) => e.exclusion_type === '휴일지정')
          .map((e) => new Date(e.exclusion_date).getDay());

        // 중복 제거
        const uniqueExcludeDays = [...new Set(excludeDays)];

        setPlanGroupData({
          startDate: data.group.period_start,
          endDate: data.group.period_end,
          contentIds: data.contents.map((c) => c.content_id),
          excludeDays: uniqueExcludeDays,
        });
      } catch (err) {
        console.error('Failed to load plan group data:', err);
        setError('플랜 그룹 데이터를 불러오는데 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    }

    loadPlanGroupData();
  }, [planGroupId, tenantId]);

  // AI 생성 완료 처리 - 플랜 저장
  const handleGenerated = async (response: LLMPlanGenerationResponse) => {
    try {
      setIsSaving(true);
      setError(null);

      const result = await saveAIGeneratedPlansAction({
        planGroupId,
        studentId,
        response,
        deleteExisting: true, // 기존 플랜 삭제 후 저장
      });

      // 에러 확인 (타입 가드 사용)
      if (isErrorResult(result)) {
        setError(result.error.message || '플랜 저장에 실패했습니다.');
        return;
      }

      // 성공
      setSavedCount(result.savedCount);
      setSaveSuccess(true);

      // 2초 후 모달 닫기 및 새로고침
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err) {
      console.error('Failed to save AI generated plans:', err);
      setError('플랜 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-2xl">
        {/* 헤더 */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
              <Wand2 className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">AI 플랜 생성</h2>
              <p className="text-sm text-gray-500">AI가 최적의 학습 플랜을 생성합니다</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 콘텐츠 */}
        <div className="p-6">
          {/* 저장 성공 상태 */}
          {saveSuccess ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">
                플랜 저장 완료!
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                {savedCount}개의 플랜이 성공적으로 저장되었습니다.
              </p>
              <p className="mt-1 text-xs text-gray-400">
                잠시 후 자동으로 닫힙니다...
              </p>
            </div>
          ) : /* 저장 중 상태 */
          isSaving ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
              <p className="mt-4 text-sm text-gray-500">
                AI 생성 플랜을 저장하는 중...
              </p>
            </div>
          ) : /* 로딩 상태 */
          isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
              <p className="mt-4 text-sm text-gray-500">
                플랜 그룹 데이터를 불러오는 중...
              </p>
            </div>
          ) : /* 에러 상태 */
          error ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <AlertCircle className="h-6 w-6 text-red-500" />
              </div>
              <p className="mt-4 text-sm text-red-600">{error}</p>
              <button
                onClick={onClose}
                className="mt-4 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                닫기
              </button>
            </div>
          ) : /* AI 생성 패널 */
          planGroupData ? (
            <AIPlanGeneratorPanel
              contentIds={planGroupData.contentIds}
              startDate={planGroupData.startDate}
              endDate={planGroupData.endDate}
              dailyStudyMinutes={180}
              excludeDays={planGroupData.excludeDays}
              onGenerated={handleGenerated}
              onCancel={onClose}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
