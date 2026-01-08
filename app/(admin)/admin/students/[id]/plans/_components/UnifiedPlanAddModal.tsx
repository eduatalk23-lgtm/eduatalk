'use client';

/**
 * UnifiedPlanAddModal
 *
 * 빠른 추가와 콘텐츠 추가를 하나로 통합한 플랜 추가 모달
 *
 * @module app/(admin)/admin/students/[id]/plans/_components/UnifiedPlanAddModal
 */

import { useState, useTransition, useCallback, type ReactNode } from 'react';
import { Zap, BookOpen, Calendar, Clock, Tag, FileText, Search, X, Video } from 'lucide-react';
import { MasterContentSearchModal } from './admin-wizard/steps/_components/MasterContentSearchModal';
import type { SelectedContent } from './admin-wizard/_context/types';
import { cn } from '@/lib/cn';
import { ModalWrapper, ModalButton, type ModalTheme } from './modals/ModalWrapper';
import { usePlanToast } from './PlanToast';
import { createUnifiedPlan } from '@/lib/domains/admin-plan/actions';
import { createFlexibleContent } from '@/lib/domains/admin-plan/actions/flexibleContent';
import {
  createPlanFromContent,
  createPlanFromContentWithScheduler,
} from '@/lib/domains/admin-plan/actions/createPlanFromContent';
import type { UnifiedPlanInput } from '@/lib/domains/admin-plan/actions';

// ============================================
// 타입 정의
// ============================================

export type UnifiedPlanMode = 'quick' | 'content';
type DistributionMode = 'today' | 'period' | 'weekly';

interface UnifiedPlanAddModalProps {
  /** 모달 열림 상태 */
  isOpen: boolean;
  /** 닫기 핸들러 */
  onClose: () => void;
  /** 성공 시 콜백 */
  onSuccess: () => void;
  /** 학생 ID */
  studentId: string;
  /** 테넌트 ID */
  tenantId: string;
  /** 플래너 ID (필수) */
  plannerId: string;
  /** 기본 선택 날짜 */
  targetDate: string;
  /** 플랜 그룹 ID (선택) */
  planGroupId?: string;
  /** 초기 모드 */
  initialMode?: UnifiedPlanMode;
}

// 자유 학습 유형 (DB CHECK 제약조건과 일치해야 함)
const FREE_LEARNING_TYPES = [
  { value: 'free', label: '자유 학습' },
  { value: 'review', label: '복습' },
  { value: 'practice', label: '연습/문제풀이' },
  { value: 'reading', label: '독서' },
  { value: 'video', label: '영상 시청' },
  { value: 'assignment', label: '과제' },
] as const;

// 콘텐츠 유형
const CONTENT_TYPES = [
  { value: 'book', label: '교재', icon: BookOpen },
  { value: 'lecture', label: '강의', icon: FileText },
  { value: 'custom', label: '직접 입력', icon: Tag },
] as const;

// 범위 유형
const RANGE_TYPES = [
  { value: 'page', label: '페이지' },
  { value: 'chapter', label: '단원' },
  { value: 'lecture_num', label: '강의 번호' },
  { value: 'custom', label: '직접 입력' },
] as const;

// 시간 프리셋
const TIME_PRESETS = [15, 30, 60, 90] as const;

// 교육과정 옵션
const CURRICULUM_OPTIONS = [
  { value: '', label: '개정과정' },
  { value: '2022 개정', label: '2022 개정' },
  { value: '2015 개정', label: '2015 개정' },
] as const;

// 과목영역 옵션
const SUBJECT_AREA_OPTIONS = [
  { value: '', label: '교과' },
  { value: '국어', label: '국어' },
  { value: '수학', label: '수학' },
  { value: '영어', label: '영어' },
  { value: '과학', label: '과학' },
  { value: '사회', label: '사회' },
] as const;

// 배치 모드 옵션 (UI 라벨 참조용)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const DISTRIBUTION_MODES = [
  { value: 'today', label: '오늘만 추가', description: 'Daily Dock에 추가' },
  { value: 'period', label: '기간에 걸쳐 분배', description: '스케줄러 활용' },
  { value: 'weekly', label: 'Weekly Dock', description: '유동 학습 항목' },
] as const;

// ============================================
// 컴포넌트
// ============================================

export function UnifiedPlanAddModal({
  isOpen,
  onClose,
  onSuccess,
  studentId,
  tenantId,
  plannerId,
  targetDate,
  planGroupId,
  initialMode = 'quick',
}: UnifiedPlanAddModalProps) {
  const { showToast } = usePlanToast();
  const [isPending, startTransition] = useTransition();

  // 모드 상태
  const [mode, setMode] = useState<UnifiedPlanMode>(initialMode);

  // 공통 필드
  const [title, setTitle] = useState('');
  const [planDate, setPlanDate] = useState(targetDate);
  const [estimatedMinutes, setEstimatedMinutes] = useState('30');
  const [description, setDescription] = useState('');

  // 빠른 추가 필드
  const [freeLearningType, setFreeLearningType] = useState<string>('free');

  // 콘텐츠 추가 필드
  const [contentType, setContentType] = useState<'book' | 'lecture' | 'custom'>('book');
  const [rangeType, setRangeType] = useState<'page' | 'chapter' | 'lecture_num' | 'custom'>('page');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [customRange, setCustomRange] = useState('');

  // 교과 정보 (콘텐츠 모드)
  const [curriculum, setCurriculum] = useState('');
  const [subjectArea, setSubjectArea] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [totalVolume, setTotalVolume] = useState('');

  // 마스터 콘텐츠 검색 관련 상태
  const [showMasterSearchModal, setShowMasterSearchModal] = useState(false);
  const [selectedMasterContent, setSelectedMasterContent] = useState<{
    contentId: string;
    contentType: 'book' | 'lecture';
    title: string;
    subject?: string;
    startRange: number;
    endRange: number;
    totalRange: number;
  } | null>(null);

  // 배치 모드
  const [distributionMode, setDistributionMode] = useState<DistributionMode>('today');
  const [periodStart, setPeriodStart] = useState(targetDate);
  const [periodEnd, setPeriodEnd] = useState('');
  const [useScheduler, setUseScheduler] = useState(false);

  // 유효성 검사 에러
  const [validationError, setValidationError] = useState<string | null>(null);

  // 모드 변경 시 상태 초기화
  const handleModeChange = useCallback((newMode: UnifiedPlanMode) => {
    setMode(newMode);
    setValidationError(null);
    // 공통 필드는 유지, 모드별 필드만 초기화
    if (newMode === 'quick') {
      setFreeLearningType('free');
    } else {
      setContentType('book');
      setRangeType('page');
      setRangeStart('');
      setRangeEnd('');
      setCustomRange('');
      // 교과 정보 초기화
      setCurriculum('');
      setSubjectArea('');
      setSubjectName('');
      setTotalVolume('');
      // 마스터 콘텐츠 초기화
      setSelectedMasterContent(null);
      setShowMasterSearchModal(false);
      // 배치 모드 초기화
      setDistributionMode('today');
      setPeriodStart(targetDate);
      setPeriodEnd('');
      setUseScheduler(false);
    }
  }, [targetDate]);

  // 모달 닫기 시 상태 초기화
  const handleClose = useCallback(() => {
    setTitle('');
    setPlanDate(targetDate);
    setEstimatedMinutes('30');
    setDescription('');
    setFreeLearningType('free');
    setContentType('book');
    setRangeType('page');
    setRangeStart('');
    setRangeEnd('');
    setCustomRange('');
    // 교과 정보 초기화
    setCurriculum('');
    setSubjectArea('');
    setSubjectName('');
    setTotalVolume('');
    // 마스터 콘텐츠 초기화
    setSelectedMasterContent(null);
    setShowMasterSearchModal(false);
    // 배치 모드 초기화
    setDistributionMode('today');
    setPeriodStart(targetDate);
    setPeriodEnd('');
    setUseScheduler(false);
    setValidationError(null);
    setMode(initialMode);
    onClose();
  }, [targetDate, initialMode, onClose]);

  // 마스터 콘텐츠 선택 핸들러
  const handleMasterContentSelect = useCallback((content: SelectedContent) => {
    // 마스터 콘텐츠는 book 또는 lecture만 가능
    const masterContentType = content.contentType as 'book' | 'lecture';
    setSelectedMasterContent({
      contentId: content.contentId,
      contentType: masterContentType,
      title: content.title,
      subject: content.subject,
      startRange: content.startRange,
      endRange: content.endRange,
      totalRange: content.totalRange,
    });

    // 폼 필드 자동 채우기
    setTitle(content.title);
    if (content.subject) setSubjectName(content.subject);
    setContentType(content.contentType as 'book' | 'lecture' | 'custom');
    setRangeStart(String(content.startRange));
    setRangeEnd(String(content.endRange));
    setTotalVolume(String(content.totalRange));

    setShowMasterSearchModal(false);
  }, []);

  // 마스터 콘텐츠 선택 해제 핸들러
  const handleClearMasterContent = useCallback(() => {
    setSelectedMasterContent(null);
  }, []);

  // 제출 처리
  const handleSubmit = useCallback(() => {
    // 유효성 검사
    if (!title.trim()) {
      setValidationError('제목을 입력해주세요.');
      return;
    }

    if (!planDate) {
      setValidationError('날짜를 선택해주세요.');
      return;
    }

    // 콘텐츠 모드에서 기간 배치 시 종료일 필수
    if (mode === 'content' && distributionMode === 'period' && !periodEnd) {
      setValidationError('종료 날짜를 선택해주세요.');
      return;
    }

    setValidationError(null);

    startTransition(async () => {
      try {
        if (mode === 'quick') {
          // ============================================
          // 빠른 추가 모드: createUnifiedPlan 사용
          // ============================================
          const input: UnifiedPlanInput = {
            studentId,
            tenantId,
            plannerId,
            planGroupId,
            planDate,
            title: title.trim(),
            description: description.trim() || undefined,
            estimatedMinutes: estimatedMinutes ? parseInt(estimatedMinutes, 10) : 30,
            containerType: 'daily',
            isAdhoc: true,
            isFreeLearning: true,
            freeLearningType,
            contentType: 'free',
          };

          const result = await createUnifiedPlan(input);

          if (!result.success) {
            showToast(result.error || '플랜 생성에 실패했습니다.', 'error');
            return;
          }

          showToast('빠른 플랜이 추가되었습니다.', 'success');
        } else if (distributionMode === 'period') {
          // ============================================
          // 콘텐츠 모드 + 기간 배치: createFlexibleContent + createPlanFromContentWithScheduler
          // ============================================

          // 1. 유연한 콘텐츠 생성
          const contentResult = await createFlexibleContent({
            tenant_id: tenantId,
            content_type: contentType,
            title: title.trim(),
            curriculum: curriculum || null,
            subject_area: subjectArea || null,
            subject: subjectName || null,
            range_type: rangeType,
            range_start: rangeType === 'custom' ? customRange : rangeStart || null,
            range_end: rangeType === 'custom' ? null : rangeEnd || null,
            total_volume: totalVolume ? Number(totalVolume) : null,
            student_id: studentId,
          });

          if (!contentResult.success || !contentResult.data) {
            showToast('콘텐츠 생성 실패: ' + contentResult.error, 'error');
            return;
          }

          // 2. 기간 배치 플랜 생성 (스케줄러 활용)
          const planResult = await createPlanFromContentWithScheduler({
            flexibleContentId: contentResult.data.id,
            contentTitle: title.trim(),
            contentSubject: subjectName || subjectArea || null,
            rangeStart: rangeType !== 'custom' && rangeStart ? Number(rangeStart) : null,
            rangeEnd: rangeType !== 'custom' && rangeEnd ? Number(rangeEnd) : null,
            customRangeDisplay: rangeType === 'custom' ? customRange : null,
            totalVolume: totalVolume ? Number(totalVolume) : null,
            distributionMode: 'period',
            targetDate: periodStart,
            periodEndDate: periodEnd,
            studentId,
            tenantId,
            plannerId,
            useScheduler: false, // 기간 배치에서는 자체 스케줄링
          });

          if (!planResult.success) {
            showToast('플랜 생성 실패: ' + planResult.error, 'error');
            return;
          }

          showToast(`기간에 ${planResult.data?.createdCount || 1}개 플랜 추가됨`, 'success');
        } else {
          // ============================================
          // 콘텐츠 모드 + 오늘/주간: createFlexibleContent + createPlanFromContent
          // ============================================

          // 1. 유연한 콘텐츠 생성
          const contentResult = await createFlexibleContent({
            tenant_id: tenantId,
            content_type: contentType,
            title: title.trim(),
            curriculum: curriculum || null,
            subject_area: subjectArea || null,
            subject: subjectName || null,
            range_type: rangeType,
            range_start: rangeType === 'custom' ? customRange : rangeStart || null,
            range_end: rangeType === 'custom' ? null : rangeEnd || null,
            total_volume: totalVolume ? Number(totalVolume) : null,
            student_id: studentId,
          });

          if (!contentResult.success || !contentResult.data) {
            showToast('콘텐츠 생성 실패: ' + contentResult.error, 'error');
            return;
          }

          // 2. 플랜 생성
          const planResult = await createPlanFromContent({
            flexibleContentId: contentResult.data.id,
            contentTitle: title.trim(),
            contentSubject: subjectName || subjectArea || null,
            rangeStart: rangeType !== 'custom' && rangeStart ? Number(rangeStart) : null,
            rangeEnd: rangeType !== 'custom' && rangeEnd ? Number(rangeEnd) : null,
            customRangeDisplay: rangeType === 'custom' ? customRange : null,
            totalVolume: totalVolume ? Number(totalVolume) : null,
            distributionMode,
            targetDate: planDate,
            studentId,
            tenantId,
            plannerId,
            useScheduler: distributionMode === 'today' ? useScheduler : false,
          });

          if (!planResult.success) {
            showToast('플랜 생성 실패: ' + planResult.error, 'error');
            return;
          }

          const modeLabel = distributionMode === 'today' ? 'Daily' : 'Weekly';
          showToast(`${modeLabel}에 플랜이 추가되었습니다.`, 'success');
        }

        handleClose();
        onSuccess();
      } catch (error) {
        console.error('플랜 생성 오류:', error);
        showToast('플랜 생성 중 오류가 발생했습니다.', 'error');
      }
    });
  }, [
    mode,
    title,
    planDate,
    description,
    estimatedMinutes,
    freeLearningType,
    contentType,
    rangeType,
    rangeStart,
    rangeEnd,
    customRange,
    curriculum,
    subjectArea,
    subjectName,
    totalVolume,
    distributionMode,
    periodStart,
    periodEnd,
    useScheduler,
    studentId,
    tenantId,
    plannerId,
    planGroupId,
    showToast,
    handleClose,
    onSuccess,
  ]);

  // 테마 색상
  const theme: ModalTheme = mode === 'quick' ? 'amber' : 'blue';

  // 모달 아이콘
  const modalIcon = mode === 'quick' ? <Zap className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />;

  return (
    <ModalWrapper
      open={isOpen}
      onClose={handleClose}
      title="플랜 추가"
      subtitle={mode === 'quick' ? '빠른 추가' : '콘텐츠 추가'}
      icon={modalIcon}
      theme={theme}
      size="lg"
      loading={isPending}
      footer={
        <>
          <ModalButton variant="secondary" onClick={handleClose} disabled={isPending}>
            취소
          </ModalButton>
          <ModalButton
            variant="primary"
            theme={theme}
            onClick={handleSubmit}
            loading={isPending}
          >
            추가
          </ModalButton>
        </>
      }
    >
      <div className="p-4 space-y-4">
        {/* 모드 탭 */}
        <div className="flex border-b border-gray-200">
          <TabButton
            active={mode === 'quick'}
            onClick={() => handleModeChange('quick')}
            icon={<Zap className="h-4 w-4" />}
            label="빠른 추가"
            shortcut="Q"
          />
          <TabButton
            active={mode === 'content'}
            onClick={() => handleModeChange('content')}
            icon={<BookOpen className="h-4 w-4" />}
            label="콘텐츠 추가"
            shortcut="N"
          />
        </div>

        {/* 유효성 검사 에러 */}
        {validationError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
            {validationError}
          </div>
        )}

        {/* 공통: 제목 */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            제목 <span className="text-red-500">*</span>
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={mode === 'quick' ? '자유 학습 제목' : '콘텐츠 제목'}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            autoFocus
          />
        </div>

        {/* 모드별 콘텐츠 */}
        {mode === 'quick' ? (
          <QuickAddFields
            freeLearningType={freeLearningType}
            onFreeLearningTypeChange={setFreeLearningType}
          />
        ) : (
          <ContentAddFields
            contentType={contentType}
            onContentTypeChange={setContentType}
            rangeType={rangeType}
            onRangeTypeChange={setRangeType}
            rangeStart={rangeStart}
            onRangeStartChange={setRangeStart}
            rangeEnd={rangeEnd}
            onRangeEndChange={setRangeEnd}
            customRange={customRange}
            onCustomRangeChange={setCustomRange}
            // 교과 정보
            curriculum={curriculum}
            onCurriculumChange={setCurriculum}
            subjectArea={subjectArea}
            onSubjectAreaChange={setSubjectArea}
            subjectName={subjectName}
            onSubjectNameChange={setSubjectName}
            totalVolume={totalVolume}
            onTotalVolumeChange={setTotalVolume}
            // 마스터 콘텐츠 검색
            selectedMasterContent={selectedMasterContent}
            onOpenMasterSearch={() => setShowMasterSearchModal(true)}
            onClearMasterContent={handleClearMasterContent}
            // 배치 모드
            distributionMode={distributionMode}
            onDistributionModeChange={setDistributionMode}
            periodStart={periodStart}
            onPeriodStartChange={setPeriodStart}
            periodEnd={periodEnd}
            onPeriodEndChange={setPeriodEnd}
            useScheduler={useScheduler}
            onUseSchedulerChange={setUseScheduler}
          />
        )}

        {/* 공통: 날짜 */}
        <div>
          <label htmlFor="planDate" className="block text-sm font-medium text-gray-700 mb-1">
            <Calendar className="inline-block h-4 w-4 mr-1" />
            날짜
          </label>
          <input
            id="planDate"
            type="date"
            value={planDate}
            onChange={(e) => setPlanDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* 공통: 예상 시간 */}
        <div>
          <label htmlFor="estimatedMinutes" className="block text-sm font-medium text-gray-700 mb-1">
            <Clock className="inline-block h-4 w-4 mr-1" />
            예상 소요시간 (분)
          </label>
          <div className="flex gap-2">
            <input
              id="estimatedMinutes"
              type="number"
              min="1"
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="flex gap-1">
              {TIME_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setEstimatedMinutes(preset.toString())}
                  className={cn(
                    'px-3 py-2 text-sm rounded-lg border transition-colors',
                    estimatedMinutes === preset.toString()
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 공통: 메모 (선택) */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            메모 <span className="text-gray-400">(선택)</span>
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="추가 메모..."
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          />
        </div>
      </div>

      {/* 마스터 콘텐츠 검색 모달 */}
      {showMasterSearchModal && (
        <MasterContentSearchModal
          open={showMasterSearchModal}
          onClose={() => setShowMasterSearchModal(false)}
          onSelect={handleMasterContentSelect}
          studentId={studentId}
          tenantId={tenantId}
          existingContentIds={new Set()}
        />
      )}
    </ModalWrapper>
  );
}

// ============================================
// 탭 버튼 컴포넌트
// ============================================

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  shortcut: string;
}

function TabButton({ active, onClick, icon, label, shortcut }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
        active
          ? 'border-gray-900 text-gray-900'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      )}
    >
      {icon}
      {label}
      <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-xs bg-gray-100 text-gray-500 rounded">
        {shortcut}
      </kbd>
    </button>
  );
}

// ============================================
// 빠른 추가 필드
// ============================================

interface QuickAddFieldsProps {
  freeLearningType: string;
  onFreeLearningTypeChange: (value: string) => void;
}

function QuickAddFields({ freeLearningType, onFreeLearningTypeChange }: QuickAddFieldsProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">학습 유형</label>
      <div className="grid grid-cols-4 gap-2">
        {FREE_LEARNING_TYPES.map((type) => (
          <button
            key={type.value}
            type="button"
            onClick={() => onFreeLearningTypeChange(type.value)}
            className={cn(
              'px-3 py-2 text-sm rounded-lg border transition-colors',
              freeLearningType === type.value
                ? 'bg-amber-100 text-amber-800 border-amber-300'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            )}
          >
            {type.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================
// 콘텐츠 추가 필드
// ============================================

interface ContentAddFieldsProps {
  contentType: 'book' | 'lecture' | 'custom';
  onContentTypeChange: (value: 'book' | 'lecture' | 'custom') => void;
  rangeType: 'page' | 'chapter' | 'lecture_num' | 'custom';
  onRangeTypeChange: (value: 'page' | 'chapter' | 'lecture_num' | 'custom') => void;
  rangeStart: string;
  onRangeStartChange: (value: string) => void;
  rangeEnd: string;
  onRangeEndChange: (value: string) => void;
  customRange: string;
  onCustomRangeChange: (value: string) => void;
  // 교과 정보
  curriculum: string;
  onCurriculumChange: (value: string) => void;
  subjectArea: string;
  onSubjectAreaChange: (value: string) => void;
  subjectName: string;
  onSubjectNameChange: (value: string) => void;
  totalVolume: string;
  onTotalVolumeChange: (value: string) => void;
  // 마스터 콘텐츠 검색
  selectedMasterContent: {
    contentId: string;
    contentType: 'book' | 'lecture';
    title: string;
    subject?: string;
    startRange: number;
    endRange: number;
    totalRange: number;
  } | null;
  onOpenMasterSearch: () => void;
  onClearMasterContent: () => void;
  // 배치 모드
  distributionMode: DistributionMode;
  onDistributionModeChange: (value: DistributionMode) => void;
  periodStart: string;
  onPeriodStartChange: (value: string) => void;
  periodEnd: string;
  onPeriodEndChange: (value: string) => void;
  useScheduler: boolean;
  onUseSchedulerChange: (value: boolean) => void;
}

function ContentAddFields({
  contentType,
  onContentTypeChange,
  rangeType,
  onRangeTypeChange,
  rangeStart,
  onRangeStartChange,
  rangeEnd,
  onRangeEndChange,
  customRange,
  onCustomRangeChange,
  curriculum,
  onCurriculumChange,
  subjectArea,
  onSubjectAreaChange,
  subjectName,
  onSubjectNameChange,
  totalVolume,
  onTotalVolumeChange,
  selectedMasterContent,
  onOpenMasterSearch,
  onClearMasterContent,
  distributionMode,
  onDistributionModeChange,
  periodStart,
  onPeriodStartChange,
  periodEnd,
  onPeriodEndChange,
  useScheduler,
  onUseSchedulerChange,
}: ContentAddFieldsProps) {
  return (
    <>
      {/* 콘텐츠 유형 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">콘텐츠 유형</label>
        <div className="flex gap-2">
          {CONTENT_TYPES.map((type) => {
            const Icon = type.icon;
            return (
              <button
                key={type.value}
                type="button"
                onClick={() => onContentTypeChange(type.value)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 text-sm rounded-lg border transition-colors',
                  contentType === type.value
                    ? 'bg-blue-100 text-blue-800 border-blue-300'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                )}
              >
                <Icon className="h-4 w-4" />
                {type.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 과목 정보 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">과목 정보</label>
        <div className="grid grid-cols-3 gap-2">
          <select
            value={curriculum}
            onChange={(e) => onCurriculumChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {CURRICULUM_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={subjectArea}
            onChange={(e) => onSubjectAreaChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {SUBJECT_AREA_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="과목명"
            value={subjectName}
            onChange={(e) => onSubjectNameChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* 마스터 콘텐츠 연결 */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          마스터 콘텐츠 연결 <span className="text-gray-400 font-normal">(선택)</span>
        </label>

        {selectedMasterContent ? (
          <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                {selectedMasterContent.contentType === 'book' ? (
                  <BookOpen className="h-4 w-4 text-blue-600" />
                ) : (
                  <Video className="h-4 w-4 text-blue-600" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{selectedMasterContent.title}</p>
                <p className="text-xs text-gray-500">
                  범위: {selectedMasterContent.startRange} - {selectedMasterContent.endRange}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClearMasterContent}
              className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenMasterSearch}
            className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors"
          >
            <Search className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-600">마스터 콘텐츠에서 검색</span>
          </button>
        )}
      </div>

      {/* 범위 지정 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">범위 지정</label>
        <div className="flex gap-1 mb-2">
          {RANGE_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => onRangeTypeChange(type.value)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-lg border transition-colors',
                rangeType === type.value
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              )}
            >
              {type.label}
            </button>
          ))}
        </div>

        {/* 범위 입력 */}
        {rangeType === 'custom' ? (
          <input
            type="text"
            value={customRange}
            onChange={(e) => onCustomRangeChange(e.target.value)}
            placeholder="예: 1단원 ~ 3단원, p.10-50"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              value={rangeStart}
              onChange={(e) => onRangeStartChange(e.target.value)}
              placeholder="시작"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <span className="text-gray-500">~</span>
            <input
              type="number"
              min="1"
              value={rangeEnd}
              onChange={(e) => onRangeEndChange(e.target.value)}
              placeholder="끝"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        )}

        {/* 예상 볼륨 */}
        <div className="flex items-center gap-2 mt-3">
          <span className="text-gray-500 text-sm">예상 분량:</span>
          <input
            type="number"
            placeholder="50"
            value={totalVolume}
            onChange={(e) => onTotalVolumeChange(e.target.value)}
            className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <span className="text-gray-400 text-sm">(일일 학습량 계산용)</span>
        </div>
      </div>

      {/* 배치 방식 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">배치 방식</label>
        <div className="space-y-2">
          {/* 오늘만 추가 */}
          <label
            className={cn(
              'flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors',
              distributionMode === 'today' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
            )}
          >
            <input
              type="radio"
              checked={distributionMode === 'today'}
              onChange={() => onDistributionModeChange('today')}
              className="mt-0.5"
            />
            <div className="flex-1">
              <div className="font-medium text-sm">오늘만 추가 (Daily Dock)</div>
              {distributionMode === 'today' && (
                <label
                  className="flex items-center gap-2 mt-2 text-sm text-gray-600"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={useScheduler}
                    onChange={(e) => onUseSchedulerChange(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  자동 시간 배정 (기존 플랜 고려)
                </label>
              )}
            </div>
          </label>

          {/* 기간에 걸쳐 분배 */}
          <label
            className={cn(
              'flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors',
              distributionMode === 'period' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
            )}
          >
            <input
              type="radio"
              checked={distributionMode === 'period'}
              onChange={() => onDistributionModeChange('period')}
              className="mt-0.5"
            />
            <div className="flex-1">
              <div className="font-medium text-sm">기간에 걸쳐 분배</div>
              {distributionMode === 'period' && (
                <div
                  className="flex items-center gap-2 mt-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="date"
                    value={periodStart}
                    onChange={(e) => onPeriodStartChange(e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="text-gray-500">~</span>
                  <input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => onPeriodEndChange(e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}
            </div>
          </label>

          {/* Weekly Dock */}
          <label
            className={cn(
              'flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors',
              distributionMode === 'weekly' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
            )}
          >
            <input
              type="radio"
              checked={distributionMode === 'weekly'}
              onChange={() => onDistributionModeChange('weekly')}
              className="mt-0.5"
            />
            <div>
              <div className="font-medium text-sm">Weekly Dock에 추가 (유동)</div>
              <div className="text-xs text-gray-500 mt-0.5">특정 날짜에 배정되지 않는 유동 학습</div>
            </div>
          </label>
        </div>
      </div>
    </>
  );
}

export default UnifiedPlanAddModal;
