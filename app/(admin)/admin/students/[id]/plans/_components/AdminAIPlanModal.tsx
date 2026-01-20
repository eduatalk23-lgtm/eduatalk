'use client';

import { useState, useEffect } from 'react';
import { X, Wand2, AlertCircle, Loader2, CheckCircle2, Sparkles, Zap, Lightbulb, Globe, Users } from 'lucide-react';
import { cn } from '@/lib/cn';
import { AIPlanGeneratorPanel } from '@/app/(student)/plan/new-group/_components/_features/ai-mode';
// 직접 경로에서 타입 import (barrel export 회피 - 서버/클라이언트 분리)
import type { LLMPlanGenerationResponse } from '@/lib/domains/plan/llm/types';
import type { AIRecommendations } from '@/lib/domains/plan/llm/types/aiFramework';
import {
  getPlanGroupDetailsForAdminAction,
  saveAIGeneratedPlansAction,
  getStudentContentsForAIPlanAction,
  getStudentPlannersAction,
} from '@/lib/domains/admin-plan/actions';
import type { Planner } from '@/lib/domains/admin-plan/actions/planners';
// Server Action 직접 import (barrel export 회피)
import { generateHybridPlanCompleteAction, type PlannerValidationMode } from '@/lib/domains/plan/llm/actions/generateHybridPlanComplete';
import { isErrorResult } from '@/lib/errors';
import { WebSearchResultsPanel } from '@/components/plan';
import type { WebSearchResult } from '@/lib/domains/plan/llm/providers/base';

interface AdminAIPlanModalProps {
  studentId: string;
  tenantId: string;
  planGroupId: string;
  onClose: () => void;
  onSuccess: () => void;
}

type GenerationMode = 'hybrid' | 'ai-only';

interface PlanGroupData {
  startDate: string;
  endDate: string;
  contentIds: string[];
  excludeDays: number[];
}

interface StudentData {
  id: string;
  name: string;
  grade: string;
}

interface ContentData {
  id: string;
  title: string;
  subject: string;
  subjectCategory: string;
  contentType: 'book' | 'lecture' | 'custom';
  estimatedHours: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface ScoreData {
  subject: string;
  subjectCategory: string;
  score: number;
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
  // 기본 상태
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [planGroupData, setPlanGroupData] = useState<PlanGroupData | null>(null);

  // 생성 모드 선택
  const [generationMode, setGenerationMode] = useState<GenerationMode | null>(null);
  const [isGeneratingHybrid, setIsGeneratingHybrid] = useState(false);

  // 하이브리드 모드용 추가 데이터
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [contentsData, setContentsData] = useState<ContentData[]>([]);
  const [scoresData, setScoresData] = useState<ScoreData[]>([]);

  // AI 추천사항 (하이브리드 결과)
  const [aiRecommendations, setAiRecommendations] = useState<AIRecommendations | null>(null);
  const [hybridStats, setHybridStats] = useState<{
    planCount: number;
    aiProcessingTimeMs: number;
    totalProcessingTimeMs: number;
    tokensUsed: { input: number; output: number };
  } | null>(null);

  // 웹 검색 옵션 (하이브리드 모드)
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  const [saveWebResults, setSaveWebResults] = useState(true);
  const [webSearchResults, setWebSearchResults] = useState<WebSearchResult[] | null>(null);
  const [webSearchQueries, setWebSearchQueries] = useState<string[]>([]);

  // Phase 4: 플래너 연결 상태
  const [planners, setPlanners] = useState<Planner[]>([]);
  const [selectedPlannerId, setSelectedPlannerId] = useState<string | null>(null);
  const [selectedPlanner, setSelectedPlanner] = useState<Planner | null>(null);
  const [existingPlannerId, setExistingPlannerId] = useState<string | null>(null);
  const [plannerValidationMode, setPlannerValidationMode] = useState<PlannerValidationMode>('auto_create');

  // 플랜 그룹 및 학생/콘텐츠 데이터 로드
  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        setError(null);

        // 플랜 그룹 데이터 로드
        const result = await getPlanGroupDetailsForAdminAction(planGroupId, tenantId);

        // 에러 확인
        if ('success' in result && result.success === false) {
          setError(result.error?.message || '플랜 그룹 데이터를 불러오는데 실패했습니다.');
          return;
        }

        // 성공 시 결과 처리
        const data = result as {
          group: { period_start: string; period_end: string; planner_id?: string | null } | null;
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

        // 하이브리드 모드용 추가 데이터 로드
        const studentContentsResult = await getStudentContentsForAIPlanAction({
          studentId,
          tenantId,
          contentIds: data.contents.map((c) => c.content_id),
        });

        if (isErrorResult(studentContentsResult)) {
          console.warn('학생/콘텐츠 데이터 로드 실패 (하이브리드 모드 비활성화):', studentContentsResult.error);
          // 하이브리드 모드를 위한 데이터 없으면 AI-only 모드만 사용 가능
        } else {
          setStudentData(studentContentsResult.student);
          setContentsData(studentContentsResult.contents);
          setScoresData(studentContentsResult.scores);
        }

        // Phase 4: 플래너 목록 로드
        const plannersResult = await getStudentPlannersAction(studentId, {
          status: ['draft', 'active', 'paused'],
          includeArchived: false,
        });

        if (plannersResult?.data) {
          setPlanners(plannersResult.data);

          // Plan Group에 이미 플래너가 연결되어 있는지 확인
          const planGroupPlannerId = data.group?.planner_id;
          if (planGroupPlannerId) {
            setExistingPlannerId(planGroupPlannerId);
            const connected = plannersResult.data.find(p => p.id === planGroupPlannerId);
            if (connected) {
              setSelectedPlannerId(planGroupPlannerId);
              setSelectedPlanner(connected);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load data:', err);
        setError('데이터를 불러오는데 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [planGroupId, tenantId, studentId]);

  // AI-only 생성 완료 처리 - 플랜 저장
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

  // 하이브리드 생성 처리
  const handleHybridGenerate = async () => {
    if (!studentData || !planGroupData) {
      setError('학생 또는 플랜 그룹 데이터가 없습니다.');
      return;
    }

    // 디버깅 로그: 하이브리드 생성 시작 시 상태 확인
    console.log("[AdminAIPlanModal] 하이브리드 생성 시작", {
      planGroupId,
      existingPlannerId,
      plannerValidationMode,
      enableWebSearch,
      contentCount: contentsData.length,
    });

    try {
      setIsGeneratingHybrid(true);
      setError(null);

      // 기간 계산
      const startDate = new Date(planGroupData.startDate);
      const endDate = new Date(planGroupData.endDate);
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const studyDays = totalDays - planGroupData.excludeDays.length * Math.ceil(totalDays / 7);

      const result = await generateHybridPlanCompleteAction({
        planGroupId,
        student: studentData,
        scores: scoresData,
        contents: contentsData,
        period: {
          startDate: planGroupData.startDate,
          endDate: planGroupData.endDate,
          totalDays,
          studyDays,
        },
        modelTier: 'standard',
        role: 'admin',
        enableWebSearch,
        webSearchConfig: enableWebSearch ? {
          mode: 'dynamic',
          saveResults: saveWebResults,
        } : undefined,
        // Phase 4: 플래너 검증 모드
        plannerValidationMode,
      });

      if (!result.success) {
        const errorMsg = typeof result.error === 'string'
          ? result.error
          : result.error?.message || '하이브리드 플랜 생성에 실패했습니다.';
        setError(errorMsg);
        return;
      }

      // 성공
      setSavedCount(result.planCount || 0);
      setAiRecommendations(result.aiRecommendations || null);
      setHybridStats({
        planCount: result.planCount || 0,
        aiProcessingTimeMs: result.aiProcessingTimeMs || 0,
        totalProcessingTimeMs: result.totalProcessingTimeMs || 0,
        tokensUsed: result.tokensUsed || { input: 0, output: 0 },
      });

      // 웹 검색 결과 저장
      if (result.webSearchResults?.results) {
        setWebSearchResults(result.webSearchResults.results);
        setWebSearchQueries(result.webSearchResults.searchQueries || []);
      }

      setSaveSuccess(true);

      // 3초 후 모달 닫기 (AI 추천사항 확인 시간)
      setTimeout(() => {
        onSuccess();
      }, 3000);
    } catch (err) {
      console.error('Failed to generate hybrid plan:', err);
      setError('하이브리드 플랜 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGeneratingHybrid(false);
    }
  };

  // 하이브리드 모드 사용 가능 여부
  const canUseHybrid = Boolean(studentData && contentsData.length > 0);

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
            <div className="space-y-6">
              <div className="flex flex-col items-center justify-center py-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">
                  플랜 저장 완료!
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  {savedCount}개의 플랜이 성공적으로 저장되었습니다.
                </p>
                {hybridStats && (
                  <p className="mt-1 text-xs text-gray-400">
                    AI 처리: {(hybridStats.aiProcessingTimeMs / 1000).toFixed(1)}초 ·
                    총 처리: {(hybridStats.totalProcessingTimeMs / 1000).toFixed(1)}초 ·
                    토큰: {hybridStats.tokensUsed.input + hybridStats.tokensUsed.output}
                  </p>
                )}
              </div>

              {/* AI 추천사항 표시 (하이브리드 모드) */}
              {aiRecommendations && (
                <div className="space-y-3">
                  {aiRecommendations.studyTips && aiRecommendations.studyTips.length > 0 && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                      <div className="flex items-center gap-2 text-blue-700 font-medium mb-2">
                        <Lightbulb className="h-4 w-4" />
                        학습 팁
                      </div>
                      <ul className="space-y-1">
                        {aiRecommendations.studyTips.map((tip, idx) => (
                          <li key={idx} className="text-sm text-blue-600">• {tip}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {aiRecommendations.warnings && aiRecommendations.warnings.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                      <div className="flex items-center gap-2 text-amber-700 font-medium mb-2">
                        <AlertCircle className="h-4 w-4" />
                        주의사항
                      </div>
                      <ul className="space-y-1">
                        {aiRecommendations.warnings.map((warn, idx) => (
                          <li key={idx} className="text-sm text-amber-600">• {warn}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {aiRecommendations.focusAreas && aiRecommendations.focusAreas.length > 0 && (
                    <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                      <div className="flex items-center gap-2 text-purple-700 font-medium mb-2">
                        <Sparkles className="h-4 w-4" />
                        집중 영역
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {aiRecommendations.focusAreas.map((area, idx) => (
                          <span key={idx} className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full">
                            {area}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 웹 검색 결과 표시 */}
              {webSearchResults && webSearchResults.length > 0 && (
                <WebSearchResultsPanel
                  results={webSearchResults}
                  searchQueries={webSearchQueries}
                  className="mt-4"
                />
              )}

              <p className="text-center text-xs text-gray-400">
                잠시 후 자동으로 닫힙니다...
              </p>
            </div>
          ) : /* 하이브리드 생성 중 상태 */
          isGeneratingHybrid ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
              <p className="mt-4 text-sm text-gray-500">
                AI 프레임워크 생성 + 플랜 배치 중...
              </p>
              <p className="mt-1 text-xs text-gray-400">
                토큰 최적화된 하이브리드 방식으로 생성 중
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
                onClick={() => {
                  setError(null);
                  setGenerationMode(null);
                }}
                className="mt-4 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                다시 시도
              </button>
            </div>
          ) : /* 모드 선택 */
          !generationMode && planGroupData ? (
            <div className="space-y-4">
              <p className="text-center text-sm text-gray-600 mb-6">
                AI 플랜 생성 방식을 선택하세요
              </p>

              {/* 하이브리드 모드 (권장) */}
              <button
                onClick={() => canUseHybrid ? setGenerationMode('hybrid') : undefined}
                disabled={!canUseHybrid}
                className={cn(
                  'w-full p-4 rounded-lg border-2 text-left transition-all',
                  canUseHybrid
                    ? 'border-purple-300 bg-purple-50 hover:border-purple-500 hover:shadow-md cursor-pointer'
                    : 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                    <Zap className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">하이브리드 모드</span>
                      <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">권장</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      AI 전략 분석 + 코드 기반 정확한 시간 배치
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      토큰 ~50% 절감 · 시간 충돌 0% · AI 추천사항 포함
                    </p>
                  </div>
                </div>
              </button>

              {/* AI-only 모드 */}
              <button
                onClick={() => setGenerationMode('ai-only')}
                className="w-full p-4 rounded-lg border-2 border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm text-left transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                    <Sparkles className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <span className="font-semibold text-gray-900">AI 전체 생성</span>
                    <p className="mt-1 text-sm text-gray-600">
                      AI가 전체 플랜을 직접 생성
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      세부 설정 가능 · 스트리밍 미리보기
                    </p>
                  </div>
                </div>
              </button>

              {!canUseHybrid && (
                <p className="text-center text-xs text-amber-600">
                  하이브리드 모드를 사용하려면 학생/콘텐츠 정보가 필요합니다
                </p>
              )}
            </div>
          ) : /* 하이브리드 모드 선택됨 */
          generationMode === 'hybrid' && planGroupData ? (
            <div className="space-y-6">
              <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 text-purple-600" />
                  <span className="font-medium text-purple-900">하이브리드 모드</span>
                </div>
                <p className="text-sm text-purple-700">
                  AI가 학습 전략을 분석하고, 코드 기반 스케줄러가 정확한 시간 배치를 수행합니다.
                </p>
              </div>

              {/* 요약 정보 */}
              <div className="p-4 rounded-lg bg-gray-50 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">학생</span>
                  <span className="font-medium text-gray-900">{studentData?.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">기간</span>
                  <span className="font-medium text-gray-900">
                    {planGroupData.startDate} ~ {planGroupData.endDate}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">콘텐츠</span>
                  <span className="font-medium text-gray-900">{contentsData.length}개</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">성적 데이터</span>
                  <span className="font-medium text-gray-900">{scoresData.length}개 과목</span>
                </div>
              </div>

              {/* 웹 검색 옵션 */}
              <div className="p-4 rounded-lg border border-gray-200 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium text-gray-700">웹 검색 활용</span>
                    <span className="px-1.5 py-0.5 text-[10px] bg-blue-100 text-blue-600 rounded">Gemini</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnableWebSearch(!enableWebSearch)}
                    className={cn(
                      'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                      enableWebSearch ? 'bg-blue-500' : 'bg-gray-300'
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                        enableWebSearch ? 'translate-x-4' : 'translate-x-1'
                      )}
                    />
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  AI가 최신 학습 트렌드와 콘텐츠 정보를 검색하여 플랜에 반영합니다.
                </p>
                {enableWebSearch && (
                  <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                    <input
                      type="checkbox"
                      id="saveWebResults"
                      checked={saveWebResults}
                      onChange={(e) => setSaveWebResults(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                    />
                    <label htmlFor="saveWebResults" className="text-xs text-gray-500">
                      검색 결과를 콘텐츠로 저장
                    </label>
                  </div>
                )}
              </div>

              {/* Phase 4: 플래너 연결 - 기존 플래너 없을 때만 표시 */}
              {!existingPlannerId && (
                <div className="p-4 rounded-lg border border-gray-200 bg-white space-y-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">플래너 연결</span>
                  </div>

                  <select
                    value={selectedPlannerId || ''}
                    onChange={(e) => {
                      const id = e.target.value || null;
                      setSelectedPlannerId(id);
                      setSelectedPlanner(planners.find(p => p.id === id) || null);
                    }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="">플래너 선택 (선택사항)</option>
                    {planners.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.periodStart} ~ {p.periodEnd})
                      </option>
                    ))}
                  </select>

                  {/* Validation Mode 선택 */}
                  <div className="flex gap-2">
                    {[
                      { value: 'auto_create' as const, label: '자동 생성', desc: '플래너 미연결 시 자동 생성' },
                      { value: 'warn' as const, label: '경고만', desc: '경고 로깅 후 진행' },
                      { value: 'strict' as const, label: '엄격', desc: '플래너 필수' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPlannerValidationMode(opt.value)}
                        title={opt.desc}
                        className={cn(
                          'flex-1 px-2 py-1.5 text-xs rounded border transition-colors',
                          plannerValidationMode === opt.value
                            ? 'border-purple-500 bg-purple-50 text-purple-700'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400">
                    플래너가 없으면 &apos;자동 생성&apos; 모드에서 기본 플래너를 생성합니다.
                  </p>
                </div>
              )}

              {/* 기존 플래너 연결 정보 */}
              {existingPlannerId && selectedPlanner && (
                <div className="p-4 rounded-lg border border-green-200 bg-green-50">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm font-medium">연결된 플래너: {selectedPlanner.name}</span>
                  </div>
                  <p className="mt-1 text-xs text-green-600">
                    {selectedPlanner.periodStart} ~ {selectedPlanner.periodEnd}
                  </p>
                </div>
              )}

              {/* 버튼 */}
              <div className="flex gap-3">
                <button
                  onClick={() => setGenerationMode(null)}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  뒤로
                </button>
                <button
                  onClick={handleHybridGenerate}
                  className="flex-1 rounded-lg bg-purple-600 px-4 py-3 text-sm font-semibold text-white hover:bg-purple-700 flex items-center justify-center gap-2"
                >
                  <Zap className="h-4 w-4" />
                  하이브리드 생성
                </button>
              </div>
            </div>
          ) : /* AI-only 모드 선택됨 */
          generationMode === 'ai-only' && planGroupData ? (
            <div className="space-y-4">
              <button
                onClick={() => setGenerationMode(null)}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                ← 모드 선택으로 돌아가기
              </button>
              <AIPlanGeneratorPanel
                contentIds={planGroupData.contentIds}
                startDate={planGroupData.startDate}
                endDate={planGroupData.endDate}
                dailyStudyMinutes={180}
                excludeDays={planGroupData.excludeDays}
                onGenerated={handleGenerated}
                onCancel={onClose}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
