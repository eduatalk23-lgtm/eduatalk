'use client';

import { useState, useEffect } from 'react';
import { X, Wand2, AlertCircle, Loader2, CheckCircle2, Sparkles, Lightbulb, ChevronRight, BookOpen, Search, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  getStudentPlannersAction,
  getFlexibleContents,
} from '@/lib/domains/admin-plan/actions';
import { searchMasterBooks } from '@/lib/data/contentMasters/books';
import { searchMasterLectures } from '@/lib/data/contentMasters/lectures';
import { createPlanGroupForPlanner } from '@/lib/domains/admin-plan/utils/planGroupSelector';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  type DifficultyLevel,
  type ContentType,
} from '@/lib/domains/plan/llm/actions/unifiedPlanGeneration';
import { runUnifiedPlanGenerationPipelineAction } from '../_actions/aiPlanActions';
import { generateHybridPlanCompleteAction } from '@/lib/domains/plan/llm/actions/generateHybridPlanComplete';
import type { Planner } from '@/lib/domains/admin-plan/actions/planners';
import type { AIRecommendations } from '@/lib/domains/plan/llm/types/aiFramework';

// ============================================================================
// Types
// ============================================================================

interface AdminAIPlanModalProps {
  studentId: string;
  tenantId: string;
  onClose: () => void;
  onSuccess: () => void;
}

type WizardStep = 1 | 2 | 3;
type ContentSelectionMethod = 'cold-start' | 'existing';

interface SelectableContent {
  id: string;
  title: string;
  subject: string;
  subjectCategory: string;
  contentType: 'book' | 'lecture';
  totalRange?: number;
  estimatedHours?: number;
  difficulty?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * 관리자용 AI 플랜 생성 모달 (통합 위저드 플로우)
 *
 * Step 1: 플래너 선택
 * Step 2: 콘텐츠 선택 (AI 추천 / 직접 선택)
 * Step 3: 생성 (Plan Group + Plans 자동 생성)
 */
export function AdminAIPlanModal({
  studentId,
  tenantId,
  onClose,
  onSuccess,
}: AdminAIPlanModalProps) {
  // ============================================================================
  // Wizard State
  // ============================================================================
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // Step 1: Planner Selection
  // ============================================================================
  const [planners, setPlanners] = useState<Planner[]>([]);
  const [selectedPlannerId, setSelectedPlannerId] = useState<string | null>(null);
  const [selectedPlanner, setSelectedPlanner] = useState<Planner | null>(null);

  // ============================================================================
  // Step 2: Content Selection
  // ============================================================================
  const [contentSelectionMethod, setContentSelectionMethod] = useState<ContentSelectionMethod>('cold-start');

  // Cold Start inputs
  const [subjectCategory, setSubjectCategory] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('개념');
  const [contentType, setContentType] = useState<ContentType>('book');

  // Existing content selection
  const [existingContents, setExistingContents] = useState<SelectableContent[]>([]);
  const [selectedContents, setSelectedContents] = useState<SelectableContent[]>([]);
  const [contentSearchQuery, setContentSearchQuery] = useState('');
  const [isLoadingContents, setIsLoadingContents] = useState(false);

  // Period override (optional, defaults to planner period)
  const [periodStart, setPeriodStart] = useState<string>('');
  const [periodEnd, setPeriodEnd] = useState<string>('');

  // ============================================================================
  // Step 3: Generation
  // ============================================================================
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationSuccess, setGenerationSuccess] = useState(false);
  const [generatedPlanCount, setGeneratedPlanCount] = useState(0);
  const [aiRecommendations, setAiRecommendations] = useState<AIRecommendations | null>(null);
  const [generationStats, setGenerationStats] = useState<{
    planGroupCount: number;
    totalPlans: number;
    processingTimeMs: number;
  } | null>(null);

  // ============================================================================
  // Data Loading
  // ============================================================================

  // Load planners on mount
  useEffect(() => {
    async function loadPlanners() {
      try {
        setIsLoading(true);
        const result = await getStudentPlannersAction(studentId);
        if (result.data && result.data.length > 0) {
          setPlanners(result.data);
          // Auto-select if only one planner
          if (result.data.length === 1) {
            setSelectedPlannerId(result.data[0].id);
            setSelectedPlanner(result.data[0]);
          }
        }
      } catch (err) {
        console.error('Failed to load planners:', err);
        setError('플래너 목록을 불러오는데 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    }
    loadPlanners();
  }, [studentId]);

  // Update period when planner is selected
  useEffect(() => {
    if (selectedPlanner) {
      setPeriodStart(selectedPlanner.periodStart);
      setPeriodEnd(selectedPlanner.periodEnd);
    }
  }, [selectedPlanner]);

  // Load existing contents when method changes to 'existing'
  useEffect(() => {
    if (contentSelectionMethod === 'existing' && existingContents.length === 0) {
      loadExistingContents();
    }
  }, [contentSelectionMethod]);

  async function loadExistingContents() {
    try {
      setIsLoadingContents(true);

      // Fetch from multiple sources in parallel
      const [flexibleResult, booksResult, lecturesResult] = await Promise.all([
        getFlexibleContents({ student_id: studentId }),
        searchMasterBooks({ tenantId, limit: 50 }),
        searchMasterLectures({ tenantId, limit: 50 }),
      ]);

      const contents: SelectableContent[] = [];

      // Add flexible contents
      if (flexibleResult.success && flexibleResult.data?.data) {
        flexibleResult.data.data.forEach((fc: {
          id: string;
          title?: string | null;
          subject?: string | null;
          subject_area?: string | null;
          content_type?: string | null;
          total_pages?: number | null;
          total_episodes?: number | null;
        }) => {
          contents.push({
            id: fc.id,
            title: fc.title || '제목 없음',
            subject: fc.subject || '',
            subjectCategory: fc.subject_area || '',
            contentType: fc.content_type === 'lecture' ? 'lecture' : 'book',
            totalRange: fc.total_pages || fc.total_episodes || undefined,
          });
        });
      }

      // Add master books
      if (booksResult.data) {
        booksResult.data.forEach((book: {
          id: string;
          title: string;
          subject?: string | null;
          subject_category?: string | null;
          total_pages?: number | null;
          estimated_hours?: number | null;
          difficulty_level?: string | null;
        }) => {
          contents.push({
            id: book.id,
            title: book.title,
            subject: book.subject || '',
            subjectCategory: book.subject_category || '',
            contentType: 'book',
            totalRange: book.total_pages || undefined,
            estimatedHours: book.estimated_hours || undefined,
            difficulty: book.difficulty_level || undefined,
          });
        });
      }

      // Add master lectures
      if (lecturesResult.data) {
        lecturesResult.data.forEach((lecture: {
          id: string;
          title: string;
          subject?: string | null;
          subject_category?: string | null;
          total_episodes?: number | null;
          estimated_hours?: number | null;
          difficulty_level?: string | null;
        }) => {
          contents.push({
            id: lecture.id,
            title: lecture.title,
            subject: lecture.subject || '',
            subjectCategory: lecture.subject_category || '',
            contentType: 'lecture',
            totalRange: lecture.total_episodes || undefined,
            estimatedHours: lecture.estimated_hours || undefined,
            difficulty: lecture.difficulty_level || undefined,
          });
        });
      }

      setExistingContents(contents);
    } catch (err) {
      console.error('Failed to load contents:', err);
      setError('콘텐츠 목록을 불러오는데 실패했습니다.');
    } finally {
      setIsLoadingContents(false);
    }
  }

  // ============================================================================
  // Handlers
  // ============================================================================

  function handlePlannerSelect(plannerId: string) {
    const planner = planners.find(p => p.id === plannerId);
    setSelectedPlannerId(plannerId);
    setSelectedPlanner(planner || null);
    setError(null);
  }

  function handleContentToggle(content: SelectableContent) {
    setSelectedContents(prev => {
      const exists = prev.find(c => c.id === content.id);
      if (exists) {
        return prev.filter(c => c.id !== content.id);
      }
      return [...prev, content];
    });
  }

  function handleNextStep() {
    if (currentStep === 1) {
      if (!selectedPlannerId) {
        setError('플래너를 선택해주세요.');
        return;
      }
      setError(null);
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (contentSelectionMethod === 'cold-start') {
        if (!subjectCategory) {
          setError('과목 카테고리를 선택해주세요.');
          return;
        }
      } else {
        if (selectedContents.length === 0) {
          setError('최소 1개의 콘텐츠를 선택해주세요.');
          return;
        }
      }
      setError(null);
      setCurrentStep(3);
      handleGenerate();
    }
  }

  function handlePrevStep() {
    if (currentStep > 1) {
      setError(null);
      setCurrentStep((currentStep - 1) as WizardStep);
    }
  }

  // ============================================================================
  // Generation Logic
  // ============================================================================

  async function handleGenerate() {
    if (!selectedPlanner || !selectedPlannerId) {
      setError('플래너 정보가 없습니다.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    const startTime = Date.now();

    try {
      if (contentSelectionMethod === 'cold-start') {
        // Cold Start → Unified Pipeline
        await generateWithColdStart();
      } else {
        // Existing Content → Create Plan Groups + Hybrid Pipeline
        await generateWithExistingContents();
      }

      setGenerationSuccess(true);
      setGenerationStats({
        planGroupCount: contentSelectionMethod === 'cold-start' ? 1 : selectedContents.length,
        totalPlans: generatedPlanCount,
        processingTimeMs: Date.now() - startTime,
      });

      // Auto close after 3 seconds
      setTimeout(() => {
        onSuccess();
      }, 3000);
    } catch (err) {
      console.error('Generation failed:', err);
      setError(err instanceof Error ? err.message : '플랜 생성에 실패했습니다.');
    } finally {
      setIsGenerating(false);
    }
  }

  async function generateWithColdStart() {
    if (!selectedPlanner) return;

    const studyHours = selectedPlanner.studyHours as { start: string; end: string } | null;
    const lunchTime = selectedPlanner.lunchTime as { start: string; end: string } | null;

    const planName = `AI 생성 플랜 (${subjectCategory}${subject ? ` - ${subject}` : ''})`;

    const result = await runUnifiedPlanGenerationPipelineAction({
      studentId,
      tenantId,
      planName,
      planPurpose: '기타',
      periodStart,
      periodEnd,
      timeSettings: {
        studyHours: studyHours ?? { start: '09:00', end: '22:00' },
        lunchTime: lunchTime ?? { start: '12:00', end: '13:00' },
      },
      contentSelection: {
        subjectCategory,
        subject: subject || undefined,
        difficulty,
        contentType,
        maxResults: 3,
      },
      timetableSettings: {
        studyDays: 6,
        reviewDays: 1,
        studentLevel: 'medium',
        subjectType: 'weakness',
      },
      generationOptions: {
        saveToDb: true,
        generateMarkdown: true,
        dryRun: false,
      },
      plannerId: selectedPlannerId!,
      creationMode: 'content_based',
      plannerValidationMode: 'auto_create',
    });

    if (!result.success) {
      throw new Error(result.error || 'Unified pipeline 실행 실패');
    }

    setGeneratedPlanCount(result.plans?.length || 0);
  }

  async function generateWithExistingContents() {
    if (!selectedPlanner || selectedContents.length === 0) return;

    let totalPlans = 0;
    const results: AIRecommendations[] = [];
    const supabase = createSupabaseBrowserClient();

    // Create Plan Group and generate plans for each content
    for (const content of selectedContents) {
      // 1. Create Plan Group (기본 생성)
      const planGroupResult = await createPlanGroupForPlanner({
        plannerId: selectedPlannerId!,
        studentId,
        tenantId,
        name: content.title,
        periodStart,
        periodEnd,
        options: {
          isSingleContent: true,
          creationMode: 'ai_generation',
        },
      });

      if (!planGroupResult.success || !planGroupResult.planGroupId) {
        console.error(`Failed to create plan group for ${content.title}`);
        continue;
      }

      // 2. Update Plan Group with content info
      const { error: updateError } = await supabase
        .from('plan_groups')
        .update({
          content_id: content.id,
          content_type: content.contentType,
          master_content_id: content.id,
        })
        .eq('id', planGroupResult.planGroupId);

      if (updateError) {
        console.error(`Failed to update plan group content: ${updateError.message}`);
      }

      // 3. Calculate period info
      const startDate = new Date(periodStart);
      const endDate = new Date(periodEnd);
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      // 4. Generate plans with Hybrid pipeline
      const hybridResult = await generateHybridPlanCompleteAction({
        planGroupId: planGroupResult.planGroupId,
        student: {
          id: studentId,
          name: '', // Will be fetched inside
          grade: '',
        },
        scores: [],
        contents: [{
          id: content.id,
          title: content.title,
          subject: content.subject,
          subjectCategory: content.subjectCategory,
          contentType: content.contentType,
          estimatedHours: content.estimatedHours || 10,
          difficulty: (content.difficulty as 'easy' | 'medium' | 'hard') || 'medium',
        }],
        period: {
          startDate: periodStart,
          endDate: periodEnd,
          totalDays,
          studyDays: Math.floor(totalDays * 6 / 7),
        },
        modelTier: 'standard',
        role: 'admin',
        plannerValidationMode: 'warn', // Plan Group already has planner
      });

      if (hybridResult.success) {
        totalPlans += hybridResult.planCount || 0;
        if (hybridResult.aiRecommendations) {
          results.push(hybridResult.aiRecommendations);
        }
      }
    }

    setGeneratedPlanCount(totalPlans);

    // Merge AI recommendations
    if (results.length > 0) {
      setAiRecommendations({
        studyTips: results.flatMap(r => r.studyTips || []),
        warnings: results.flatMap(r => r.warnings || []),
        focusAreas: results.flatMap(r => r.focusAreas || []),
        suggestedAdjustments: results.flatMap(r => r.suggestedAdjustments || []),
      });
    }
  }

  // ============================================================================
  // Filtered Contents for Search
  // ============================================================================

  const filteredContents = existingContents.filter(content => {
    if (!contentSearchQuery) return true;
    const query = contentSearchQuery.toLowerCase();
    return (
      content.title.toLowerCase().includes(query) ||
      content.subject.toLowerCase().includes(query) ||
      content.subjectCategory.toLowerCase().includes(query)
    );
  });

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
              <Wand2 className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">AI 플랜 생성</h2>
              <p className="text-sm text-gray-500">
                {currentStep === 1 && '플래너를 선택하세요'}
                {currentStep === 2 && '콘텐츠를 선택하세요'}
                {currentStep === 3 && '플랜 생성 중...'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium',
                    currentStep === step
                      ? 'bg-purple-600 text-white'
                      : currentStep > step
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-500'
                  )}
                >
                  {currentStep > step ? <CheckCircle2 className="h-4 w-4" /> : step}
                </div>
                {step < 3 && (
                  <ChevronRight className={cn(
                    'mx-1 h-4 w-4',
                    currentStep > step ? 'text-green-500' : 'text-gray-300'
                  )} />
                )}
              </div>
            ))}
            <span className="ml-2 text-sm text-gray-500">
              {currentStep === 1 && '플래너 선택'}
              {currentStep === 2 && '콘텐츠 선택'}
              {currentStep === 3 && '생성'}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Loading State */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
              <p className="mt-4 text-sm text-gray-500">데이터를 불러오는 중...</p>
            </div>
          ) : generationSuccess ? (
            /* Success State */
            <div className="space-y-6">
              <div className="flex flex-col items-center justify-center py-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">플랜 생성 완료!</h3>
                <p className="mt-2 text-sm text-gray-500">
                  {generationStats?.planGroupCount}개 플랜 그룹, {generatedPlanCount}개 플랜이 생성되었습니다.
                </p>
                {generationStats && (
                  <p className="mt-1 text-xs text-gray-400">
                    처리 시간: {(generationStats.processingTimeMs / 1000).toFixed(1)}초
                  </p>
                )}
              </div>

              {/* AI Recommendations */}
              {aiRecommendations && (
                <div className="space-y-3">
                  {aiRecommendations.studyTips && aiRecommendations.studyTips.length > 0 && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                      <div className="flex items-center gap-2 text-blue-700 font-medium mb-2">
                        <Lightbulb className="h-4 w-4" />
                        학습 팁
                      </div>
                      <ul className="space-y-1">
                        {aiRecommendations.studyTips.slice(0, 3).map((tip, idx) => (
                          <li key={idx} className="text-sm text-blue-600">• {tip}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <p className="text-center text-xs text-gray-400">
                잠시 후 자동으로 닫힙니다...
              </p>
            </div>
          ) : currentStep === 3 && isGenerating ? (
            /* Generating State */
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
              <p className="mt-4 text-sm text-gray-500">
                {contentSelectionMethod === 'cold-start'
                  ? 'AI가 콘텐츠를 추천하고 플랜을 생성하는 중...'
                  : `${selectedContents.length}개 콘텐츠에 대한 플랜을 생성하는 중...`}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Plan Group과 학습 플랜이 자동으로 생성됩니다
              </p>
            </div>
          ) : currentStep === 1 ? (
            /* Step 1: Planner Selection */
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  플래너 선택 <span className="text-red-500">*</span>
                </label>
                {planners.length > 0 ? (
                  <div className="space-y-2">
                    {planners.map((planner) => (
                      <button
                        key={planner.id}
                        onClick={() => handlePlannerSelect(planner.id)}
                        className={cn(
                          'w-full p-4 rounded-lg border-2 text-left transition-all',
                          selectedPlannerId === planner.id
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        )}
                      >
                        <div className="font-medium text-gray-900">{planner.name}</div>
                        <div className="text-sm text-gray-500 mt-1">
                          {planner.periodStart} ~ {planner.periodEnd}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {planner.status === 'active' ? '활성' : planner.status === 'draft' ? '초안' : '일시정지'}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>사용 가능한 플래너가 없습니다.</p>
                    <p className="text-sm mt-1">먼저 플래너를 생성해주세요.</p>
                  </div>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    <p className="text-sm">{error}</p>
                  </div>
                </div>
              )}

              {/* Next Button */}
              <div className="flex justify-end pt-4">
                <button
                  onClick={handleNextStep}
                  disabled={!selectedPlannerId}
                  className={cn(
                    'px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2',
                    selectedPlannerId
                      ? 'bg-purple-600 text-white hover:bg-purple-700'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  )}
                >
                  다음
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : currentStep === 2 ? (
            /* Step 2: Content Selection */
            <div className="space-y-6">
              {/* Selection Method Tabs */}
              <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                <button
                  onClick={() => setContentSelectionMethod('cold-start')}
                  className={cn(
                    'flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2',
                    contentSelectionMethod === 'cold-start'
                      ? 'bg-white text-purple-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  <Sparkles className="h-4 w-4" />
                  AI 추천
                </button>
                <button
                  onClick={() => setContentSelectionMethod('existing')}
                  className={cn(
                    'flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2',
                    contentSelectionMethod === 'existing'
                      ? 'bg-white text-purple-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  <BookOpen className="h-4 w-4" />
                  직접 선택
                </button>
              </div>

              {contentSelectionMethod === 'cold-start' ? (
                /* Cold Start Form */
                <div className="space-y-4">
                  <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                    <div className="flex items-start gap-3">
                      <Sparkles className="h-5 w-5 text-purple-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-purple-700">AI Cold Start</p>
                        <p className="text-xs text-purple-600 mt-1">
                          과목과 난이도를 입력하면 AI가 최적의 콘텐츠를 추천하고 플랜을 생성합니다.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      과목 카테고리 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={subjectCategory}
                      onChange={(e) => setSubjectCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="">선택하세요</option>
                      <option value="국어">국어</option>
                      <option value="수학">수학</option>
                      <option value="영어">영어</option>
                      <option value="과학">과학</option>
                      <option value="사회">사회</option>
                      <option value="한국사">한국사</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        세부 과목
                      </label>
                      <input
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="예: 미적분, 화학I"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        난이도
                      </label>
                      <select
                        value={difficulty}
                        onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="개념">개념</option>
                        <option value="기본">기본</option>
                        <option value="심화">심화</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      콘텐츠 유형
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          value="book"
                          checked={contentType === 'book'}
                          onChange={(e) => setContentType(e.target.value as ContentType)}
                          className="text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">교재</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          value="lecture"
                          checked={contentType === 'lecture'}
                          onChange={(e) => setContentType(e.target.value as ContentType)}
                          className="text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">강의</span>
                      </label>
                    </div>
                  </div>
                </div>
              ) : (
                /* Existing Content Selection */
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={contentSearchQuery}
                      onChange={(e) => setContentSearchQuery(e.target.value)}
                      placeholder="콘텐츠 검색..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  {isLoadingContents ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
                    </div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg divide-y">
                      {filteredContents.length > 0 ? (
                        filteredContents.map((content) => {
                          const isSelected = selectedContents.some(c => c.id === content.id);
                          return (
                            <button
                              key={content.id}
                              onClick={() => handleContentToggle(content)}
                              className={cn(
                                'w-full p-3 text-left hover:bg-gray-50 transition-colors',
                                isSelected && 'bg-purple-50'
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  'h-5 w-5 rounded border-2 flex items-center justify-center',
                                  isSelected
                                    ? 'border-purple-500 bg-purple-500'
                                    : 'border-gray-300'
                                )}>
                                  {isSelected && <CheckCircle2 className="h-3 w-3 text-white" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-gray-900 truncate">
                                    {content.title}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {content.subjectCategory} · {content.contentType === 'book' ? '교재' : '강의'}
                                    {content.totalRange && ` · ${content.totalRange}${content.contentType === 'book' ? '페이지' : '강'}`}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <div className="p-4 text-center text-gray-500">
                          검색 결과가 없습니다.
                        </div>
                      )}
                    </div>
                  )}

                  {selectedContents.length > 0 && (
                    <div className="text-sm text-purple-600">
                      {selectedContents.length}개 콘텐츠 선택됨
                      <span className="text-gray-400 ml-2">
                        (각각 별도 Plan Group으로 생성됩니다)
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Period Settings */}
              <div className="border-t border-gray-200 pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  학습 기간
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  플래너 기간: {selectedPlanner?.periodStart} ~ {selectedPlanner?.periodEnd}
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    <p className="text-sm">{error}</p>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between pt-4">
                <button
                  onClick={handlePrevStep}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900 flex items-center gap-1"
                >
                  <ArrowLeft className="h-4 w-4" />
                  이전
                </button>
                <button
                  onClick={handleNextStep}
                  disabled={
                    contentSelectionMethod === 'cold-start'
                      ? !subjectCategory
                      : selectedContents.length === 0
                  }
                  className={cn(
                    'px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2',
                    (contentSelectionMethod === 'cold-start' ? subjectCategory : selectedContents.length > 0)
                      ? 'bg-purple-600 text-white hover:bg-purple-700'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  )}
                >
                  <Wand2 className="h-4 w-4" />
                  플랜 생성
                </button>
              </div>
            </div>
          ) : (
            /* Step 3: Error State (when not generating/success) */
            <div className="flex flex-col items-center justify-center py-12">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <AlertCircle className="h-6 w-6 text-red-500" />
              </div>
              <p className="mt-4 text-sm text-red-600">{error || '오류가 발생했습니다.'}</p>
              <button
                onClick={() => {
                  setError(null);
                  setCurrentStep(2);
                }}
                className="mt-4 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                다시 시도
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
