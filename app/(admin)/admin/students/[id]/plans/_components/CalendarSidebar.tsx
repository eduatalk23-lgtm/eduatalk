'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import {
  Plus,
  Wand2,
  LineChart,
  ChevronDown,
  ChevronRight,
  Trash2,
  ClipboardList,
  Settings2,
  FileText,
  Keyboard,
  MoreHorizontal,
  Filter,
  Book,
  Video,
  AlertTriangle,
  Search,
  X,
} from 'lucide-react';
import { MiniMonthCalendar } from './MiniMonthCalendar';
import { PlanGroupSelector } from './PlanGroupSelector';
import {
  useAdminPlanBasic,
  useAdminPlanFilter,
  useAdminPlanModal,
  type ContentTypeFilter,
} from './context/AdminPlanContext';
import {
  usePlanTabState,
  PLAN_TABS,
  type PlanTabKey,
} from './hooks/usePlanTabState';
import { useUnfinishedCalendarEvents } from '@/lib/hooks/useCalendarEventQueries';
import { calendarEventsToUnfinishedPlans } from '@/lib/domains/calendar/adapters';

// 필터 옵션 정의
const CONTENT_TYPE_FILTERS: {
  value: ContentTypeFilter;
  label: string;
  icon: React.ReactNode;
}[] = [
  { value: 'all', label: '전체', icon: null },
  { value: 'book', label: '교재', icon: <Book className="w-3 h-3" /> },
  { value: 'lecture', label: '강의', icon: <Video className="w-3 h-3" /> },
  { value: 'custom', label: '직접입력', icon: <FileText className="w-3 h-3" /> },
];

/**
 * Google Calendar 스타일 사이드바
 *
 * 섹션:
 * 1. 만들기 버튼 (드롭다운)
 * 2. MiniCalendar (WeeklyCalendar 재사용)
 * 3. 탭 네비게이션 (세로 리스트)
 * 4. 필터 (그룹 + 콘텐츠 유형)
 * 5. 미완료 플랜 목록 (collapsible)
 * 6. 더보기 메뉴
 */
export function CalendarSidebar() {
  const {
    studentId,
    tenantId,
    selectedPlannerId,
    allPlanGroups,
    canCreatePlans,
    isAdminMode,
    initialDockData,
  } = useAdminPlanBasic();

  const {
    selectedGroupId,
    setSelectedGroupId,
    selectedDate,
    handleDateChange,
    contentTypeFilter,
    setContentTypeFilter,
    searchQuery,
    setSearchQuery,
    handleRefresh,
  } = useAdminPlanFilter();

  const {
    openUnifiedModal,
    setShowCreateWizard,
    setShowAIPlanModal,
    setShowOptimizationPanel,
    setShowTemplateModal,
    setShowConditionalDeleteModal,
    setShowShortcutsHelp,
    setShowPlanGroupManageModal,
    setShowMarkdownExportModal,
  } = useAdminPlanModal();

  const { activeTab, handleTabChange } = usePlanTabState();

  // 만들기 드롭다운
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  // 미완료 섹션 접기/펼치기
  const [isUnfinishedOpen, setIsUnfinishedOpen] = useState(true);
  // 더보기 메뉴
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  // 필터 드롭다운
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // 검색 로컬 입력 + 디바운스
  const [localSearchInput, setLocalSearchInput] = useState(searchQuery);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchInputChange = useCallback((value: string) => {
    setLocalSearchInput(value);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setSearchQuery(value);
    }, 300);
  }, [setSearchQuery]);

  const handleSearchClear = useCallback(() => {
    setLocalSearchInput('');
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setSearchQuery('');
  }, [setSearchQuery]);

  // 클린업
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // 미완료 플랜 쿼리 (캘린더 이벤트 기반)
  const { events: unfinishedEvents, isLoading: unfinishedLoading } =
    useUnfinishedCalendarEvents(studentId, selectedPlannerId);
  const unfinishedPlans = useMemo(
    () => calendarEventsToUnfinishedPlans(unfinishedEvents),
    [unfinishedEvents],
  );

  // 그룹/콘텐츠 필터 적용된 미완료 플랜
  const filteredUnfinishedPlans = useMemo(() => {
    let filtered = unfinishedPlans ?? [];
    if (selectedGroupId) {
      filtered = filtered.filter((p) => p.plan_group_id === selectedGroupId);
    }
    if (contentTypeFilter !== 'all') {
      filtered = filtered.filter((p) => {
        if (contentTypeFilter === 'book') return p.content_type === 'book';
        if (contentTypeFilter === 'lecture') return p.content_type === 'lecture';
        if (contentTypeFilter === 'custom') return !p.content_type;
        return true;
      });
    }
    return filtered;
  }, [unfinishedPlans, selectedGroupId, contentTypeFilter]);

  const handleCreateMenuClose = useCallback(() => setShowCreateMenu(false), []);

  return (
    <div className="flex flex-col h-full py-3 w-[280px]">
      {/* 1. 만들기 버튼 */}
      <div className="px-3 mb-4">
        <div className="relative">
          <button
            onClick={() => setShowCreateMenu(!showCreateMenu)}
            disabled={!canCreatePlans}
            className={cn(
              'flex items-center gap-2 w-full rounded-2xl px-5 py-3 text-sm font-medium shadow-md transition-all',
              canCreatePlans
                ? 'bg-white border border-gray-200 text-gray-700 hover:shadow-lg hover:bg-gray-50'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            )}
          >
            <Plus className="w-5 h-5 text-blue-600" />
            만들기
          </button>
          {showCreateMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={handleCreateMenuClose} />
              <div className="absolute left-0 top-full mt-1 w-52 bg-white border rounded-lg shadow-lg z-50 py-1">
                <button
                  onClick={() => { openUnifiedModal('quick'); handleCreateMenuClose(); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50 text-left"
                >
                  <Plus className="w-4 h-4 text-gray-500" />
                  플랜 추가
                  <kbd className="ml-auto text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Q</kbd>
                </button>
                <button
                  onClick={() => { setShowCreateWizard(true); handleCreateMenuClose(); }}
                  disabled={!selectedPlannerId}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50 text-left disabled:opacity-50"
                >
                  <Plus className="w-4 h-4 text-gray-500" />
                  플랜 그룹
                  <kbd className="ml-auto text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">G</kbd>
                </button>
                <hr className="my-1" />
                <button
                  onClick={() => { setShowAIPlanModal(true); handleCreateMenuClose(); }}
                  disabled={!selectedPlannerId}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50 text-left disabled:opacity-50"
                >
                  <Wand2 className="w-4 h-4 text-info-600" />
                  AI 생성
                  <kbd className="ml-auto text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">I</kbd>
                </button>
                <button
                  onClick={() => { setShowOptimizationPanel(true); handleCreateMenuClose(); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50 text-left"
                >
                  <LineChart className="w-4 h-4 text-success-600" />
                  AI 분석
                  <kbd className="ml-auto text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">O</kbd>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 플래너 미선택 경고 */}
      {!selectedPlannerId && (
        <div className="px-3 mb-3">
          <div className="p-2 bg-warning-50 border border-warning-200 rounded-lg flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-warning-600" />
            <span className="text-xs text-warning-700">
              플래너를 선택해주세요
            </span>
          </div>
        </div>
      )}

      {/* 2. MiniCalendar (월간) */}
      <div className="px-3 mb-3">
        <MiniMonthCalendar
          selectedDate={selectedDate}
          onDateSelect={handleDateChange}
        />
      </div>

      {/* 3. 탭 네비게이션 (세로 리스트) */}
      <div className="px-1 mb-3">
        <nav className="flex flex-col gap-0.5">
          {PLAN_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors text-left',
                activeTab === tab.key
                  ? 'bg-blue-50 text-blue-700 font-medium border-l-3 border-blue-500'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <span className="text-base">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <hr className="mx-3 border-gray-200 mb-3" />

      {/* 4. 필터 */}
      <div className="px-3 mb-3 space-y-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">필터</p>

        {/* 플랜 검색 */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={localSearchInput}
            onChange={(e) => handleSearchInputChange(e.target.value)}
            placeholder="플랜 검색..."
            className={cn(
              'w-full pl-8 pr-7 py-1.5 text-sm rounded-lg border transition-colors',
              'bg-white border-gray-300 text-gray-700 placeholder-gray-400',
              'focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400',
              searchQuery && 'border-yellow-400 bg-yellow-50/50'
            )}
          />
          {localSearchInput && (
            <button
              onClick={handleSearchClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {searchQuery && (
          <p className="text-[11px] text-yellow-700">
            검색 중: &quot;{searchQuery}&quot;
          </p>
        )}

        {/* 플랜 그룹 선택 */}
        <PlanGroupSelector
          groups={allPlanGroups}
          selectedGroupId={selectedGroupId}
          onSelect={setSelectedGroupId}
          tenantId={tenantId}
          studentId={studentId}
          onRefresh={handleRefresh}
        />

        {/* 콘텐츠 유형 필터 */}
        <div className="relative">
          <button
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className={cn(
              'flex items-center gap-1.5 w-full px-3 py-1.5 text-sm rounded-lg border transition-colors',
              contentTypeFilter !== 'all'
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            )}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>
              유형: {CONTENT_TYPE_FILTERS.find((f) => f.value === contentTypeFilter)?.label}
            </span>
          </button>
          {showFilterDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowFilterDropdown(false)} />
              <div className="absolute left-0 top-full mt-1 w-36 bg-white border rounded-lg shadow-lg z-50 py-1">
                {CONTENT_TYPE_FILTERS.map((filter) => (
                  <button
                    key={filter.value}
                    onClick={() => {
                      setContentTypeFilter(filter.value);
                      setShowFilterDropdown(false);
                    }}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50',
                      contentTypeFilter === filter.value && 'bg-blue-50 text-blue-700'
                    )}
                  >
                    {filter.icon}
                    <span>{filter.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <hr className="mx-3 border-gray-200 mb-3" />

      {/* 5. 미완료 플랜 섹션 (collapsible) */}
      <div className="px-3 mb-3 flex-1 min-h-0 flex flex-col">
        <button
          onClick={() => setIsUnfinishedOpen(!isUnfinishedOpen)}
          className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider mb-1 hover:text-gray-700"
        >
          {isUnfinishedOpen ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
          미완료 ({filteredUnfinishedPlans.length})
        </button>

        {isUnfinishedOpen && (
          <div className="flex-1 overflow-y-auto min-h-0 space-y-1">
            {unfinishedLoading ? (
              <div className="space-y-1">
                {[1, 2].map((i) => (
                  <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : filteredUnfinishedPlans.length === 0 ? (
              <p className="text-xs text-gray-400 py-2">미완료 플랜 없음</p>
            ) : (
              filteredUnfinishedPlans.slice(0, 20).map((plan) => (
                <div
                  key={plan.id}
                  className="flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-gray-50 cursor-default group"
                  title={plan.content_title ?? plan.custom_title ?? '플랜'}
                >
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full flex-shrink-0',
                      plan.status === 'in_progress' ? 'bg-blue-400' : 'bg-gray-300'
                    )}
                  />
                  <span className="truncate text-gray-700">
                    {plan.content_title ?? plan.custom_title ?? '플랜'}
                  </span>
                </div>
              ))
            )}
            {filteredUnfinishedPlans.length > 20 && (
              <p className="text-xs text-gray-400 px-2">
                +{filteredUnfinishedPlans.length - 20}개 더
              </p>
            )}
          </div>
        )}
      </div>

      <hr className="mx-3 border-gray-200 mb-3" />

      {/* 6. 더보기 메뉴 */}
      <div className="px-3">
        <div className="relative">
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" />
            더보기
          </button>
          {showMoreMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
              <div className="absolute left-0 bottom-full mb-1 w-48 bg-white border rounded-lg shadow-lg z-50 py-1">
                <button
                  onClick={() => { setShowTemplateModal(true); setShowMoreMenu(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50 text-left"
                >
                  <ClipboardList className="h-4 w-4" />
                  플랜 템플릿
                </button>
                <button
                  onClick={() => { setShowPlanGroupManageModal(true); setShowMoreMenu(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50 text-left"
                >
                  <Settings2 className="h-4 w-4" />
                  플랜 그룹 관리
                </button>
                <button
                  onClick={() => { setShowMarkdownExportModal(true); setShowMoreMenu(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50 text-left"
                >
                  <FileText className="h-4 w-4" />
                  마크다운 내보내기
                </button>
                {isAdminMode && (
                  <button
                    onClick={() => { setShowConditionalDeleteModal(true); setShowMoreMenu(false); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50 text-left text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                    조건부 삭제
                  </button>
                )}
                <hr className="my-1" />
                <button
                  onClick={() => { setShowShortcutsHelp(true); setShowMoreMenu(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50 text-left"
                >
                  <Keyboard className="h-4 w-4" />
                  단축키 도움말
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
