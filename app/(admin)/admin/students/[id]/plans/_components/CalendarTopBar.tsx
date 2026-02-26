'use client';

import { memo, useCallback, useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/cn';
import {
  ChevronLeft,
  ChevronRight,
  Menu,
  ChevronDown,
  Check,
  Search,
  X,
  Settings2,
  MoreVertical,
  FileText,
  Trash2,
  ClipboardList,
  Keyboard,
  ExternalLink,
  BarChart3,
  ListChecks,
  History,
} from 'lucide-react';
import type { CalendarView } from './CalendarNavHeader';
import {
  shiftDay,
  shiftWeek,
  shiftMonth,
  shiftYear,
  shiftCustomDays,
  formatMonthYear,
  formatDayHeader,
  getTodayString,
} from './utils/weekDateUtils';
interface CalendarTopBarProps {
  activeView: CalendarView;
  onViewChange: (v: CalendarView) => void;
  selectedDate: string;
  onNavigate: (date: string) => void;
  onToggleSidebar: () => void;
  totalCount?: number;
  completedCount?: number;
  /** 'topbar': Global TopBar 내 portal 렌더링용 (contents로 부모 flex 참여)
   *  'standalone': 독립 사용 시 기존 스타일 유지 */
  variant?: 'standalone' | 'topbar';
  /** 날짜로 이동 다이얼로그 열기 콜백 */
  onGoToDate?: () => void;
  /** 학생 전환 드롭다운 (관리자 캘린더 전용, 뷰 드롭다운 앞에 배치) */
  studentSwitcher?: React.ReactNode;
  /** 검색 (사이드바에서 이동) */
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  /** 설정 모달 (사이드바 탭에서 이동) */
  onOpenSettings?: () => void;
  /** 더보기 메뉴 액션들 (사이드바에서 이동) */
  onOpenAnalytics?: () => void;
  onOpenProgress?: () => void;
  onOpenHistory?: () => void;
  onOpenTemplate?: () => void;
  onOpenPlanGroupManage?: () => void;
  onOpenMarkdownExport?: () => void;
  onOpenConditionalDelete?: () => void;
  onOpenShortcutsHelp?: () => void;
  isAdminMode?: boolean;
  /** 주간 뷰 커스텀 일수 (2~7, 기본 7) */
  customDayCount?: number;
  onCustomDayCountChange?: (count: number) => void;
}

const VIEW_OPTIONS: { key: CalendarView; label: string; shortLabel: string; shortcut: string }[] = [
  { key: 'daily', label: '일간', shortLabel: '일', shortcut: 'D' },
  { key: 'weekly', label: '주간', shortLabel: '주', shortcut: 'W' },
  { key: 'month', label: '월간', shortLabel: '월', shortcut: 'M' },
  { key: 'year', label: '연간', shortLabel: '연', shortcut: 'Y' },
  { key: 'agenda', label: '일정 목록', shortLabel: '목록', shortcut: 'L' },
];

/**
 * Google Calendar 스타일 상단 바
 *
 * TopBar portal(variant='topbar')시 contents로 렌더링되어
 * 부모 flex에 직접 참여 → order로 [☰][로고][컨트롤][뷰▼] 배치
 */
export const CalendarTopBar = memo(function CalendarTopBar({
  activeView,
  onViewChange,
  selectedDate,
  onNavigate,
  onToggleSidebar,
  totalCount,
  completedCount,
  variant = 'topbar',
  onGoToDate,
  studentSwitcher,
  searchQuery = '',
  onSearchChange,
  onOpenSettings,
  onOpenAnalytics,
  onOpenProgress,
  onOpenHistory,
  onOpenTemplate,
  onOpenPlanGroupManage,
  onOpenMarkdownExport,
  onOpenConditionalDelete,
  onOpenShortcutsHelp,
  isAdminMode = false,
  customDayCount = 7,
  onCustomDayCountChange,
}: CalendarTopBarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileDropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // 검색 디바운스: 로컬 입력 상태 → 300ms 후 onSearchChange 호출
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // 외부에서 searchQuery가 초기화되면 (예: 날짜 클릭 시 setSearchQuery('')) 로컬도 동기화
  useEffect(() => {
    if (searchQuery === '' && localSearch !== '') {
      setLocalSearch('');
    }
  }, [searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  // 디바운스 타이머 unmount 시 정리
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleSearchInput = useCallback((value: string) => {
    setLocalSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      // 빈 값은 즉시 반영 (검색 해제)
      onSearchChange?.(value);
      return;
    }
    debounceRef.current = setTimeout(() => {
      onSearchChange?.(value);
    }, 300);
  }, [onSearchChange]);

  const handleSearchClear = useCallback(() => {
    setLocalSearch('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onSearchChange?.('');
  }, [onSearchChange]);

  // 드롭다운 외부 클릭 감지
  useEffect(() => {
    const anyOpen = dropdownOpen || moreMenuOpen;
    if (!anyOpen) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (dropdownOpen) {
        const isInsideDesktop = dropdownRef.current?.contains(target);
        const isInsideMobile = mobileDropdownRef.current?.contains(target);
        if (!isInsideDesktop && !isInsideMobile) setDropdownOpen(false);
      }
      if (moreMenuOpen && !moreMenuRef.current?.contains(target)) setMoreMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen, moreMenuOpen]);

  // 검색 열릴 때 포커스
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const baseOption = VIEW_OPTIONS.find((v) => v.key === activeView) ?? VIEW_OPTIONS[1];
  const activeOption = activeView === 'weekly' && customDayCount < 7
    ? { ...baseOption, shortLabel: `${customDayCount}일` }
    : baseOption;

  const handlePrev = useCallback(() => {
    if (activeView === 'daily') onNavigate(shiftDay(selectedDate, -1));
    else if (activeView === 'weekly') {
      if (customDayCount < 7) onNavigate(shiftCustomDays(selectedDate, -1, customDayCount));
      else onNavigate(shiftWeek(selectedDate, -1));
    }
    else if (activeView === 'year') onNavigate(shiftYear(selectedDate, -1));
    else onNavigate(shiftMonth(selectedDate, -1));
  }, [activeView, selectedDate, onNavigate, customDayCount]);

  const handleNext = useCallback(() => {
    if (activeView === 'daily') onNavigate(shiftDay(selectedDate, 1));
    else if (activeView === 'weekly') {
      if (customDayCount < 7) onNavigate(shiftCustomDays(selectedDate, 1, customDayCount));
      else onNavigate(shiftWeek(selectedDate, 1));
    }
    else if (activeView === 'year') onNavigate(shiftYear(selectedDate, 1));
    else onNavigate(shiftMonth(selectedDate, 1));
  }, [activeView, selectedDate, onNavigate, customDayCount]);

  const handleToday = useCallback(() => {
    onNavigate(getTodayString());
  }, [onNavigate]);

  const monthYearText = activeView === 'year'
    ? `${selectedDate.substring(0, 4)}년`
    : formatMonthYear(selectedDate);

  const isTopbar = variant === 'topbar';

  const hoverBg = 'hover:bg-[rgb(var(--color-secondary-200))]';
  const iconColor = 'text-[var(--text-secondary)]';

  // topbar variant: contents로 부모 flex에 참여, order로 배치
  if (isTopbar) {
    return (
      <div className="contents">
        {/* ☰ 사이드바 토글 — order-0 (로고 order-1 앞, 데스크톱 only) */}
        <button
          onClick={onToggleSidebar}
          className={cn('hidden md:flex order-0 p-2 rounded-full transition-colors shrink-0', hoverBg)}
          title="사이드바 토글"
        >
          <Menu className={cn('w-5 h-5', iconColor)} />
        </button>

        {/* 캘린더 컨트롤 — order-2 (로고 order-1 뒤, 데스크톱 only) */}
        <div className="hidden md:flex order-2 items-center flex-1 min-w-0 ml-4">
          {/* 오늘 버튼 */}
          <button
            onClick={handleToday}
            className={cn(
              'shrink-0 px-4 py-1.5 text-sm font-medium rounded-full transition-colors',
              'text-[var(--text-secondary)] border border-[rgb(var(--color-secondary-300))] hover:bg-[rgb(var(--color-secondary-100))]'
            )}
          >
            오늘
          </button>

          {/* < > 네비게이션 (밀착) */}
          <div className="flex items-center ml-2">
            <button
              onClick={handlePrev}
              className={cn('p-1.5 rounded-full transition-colors', hoverBg)}
            >
              <ChevronLeft className={cn('w-5 h-5', iconColor)} />
            </button>
            <button
              onClick={handleNext}
              className={cn('p-1.5 rounded-full transition-colors', hoverBg)}
            >
              <ChevronRight className={cn('w-5 h-5', iconColor)} />
            </button>
          </div>

          {/* 월/년 텍스트 */}
          <h2
            className={cn(
              "ml-2 text-[22px] font-normal truncate flex items-center gap-2 leading-none text-[var(--text-primary)]",
              onGoToDate && "cursor-pointer hover:bg-[rgb(var(--color-secondary-100))] rounded-lg px-2 -mx-2 py-1 -my-1 transition-colors"
            )}
            onClick={onGoToDate}
            title={onGoToDate ? "날짜로 이동 (G)" : undefined}
          >
            {monthYearText}
            {activeView === 'daily' && (() => {
              const dayInfo = formatDayHeader(selectedDate);
              return (
                <>
                  <span
                    className={cn(
                      'w-9 h-9 flex items-center justify-center rounded-full text-base font-medium',
                      dayInfo.isToday
                        ? 'bg-blue-500 text-white'
                        : 'text-[var(--text-primary)]',
                    )}
                  >
                    {dayInfo.dateNum}
                  </span>
                  <span
                    className={cn(
                      'text-sm font-normal',
                      dayInfo.isToday ? 'text-blue-600' : 'text-[var(--text-tertiary)]',
                    )}
                  >
                    {dayInfo.dayName}
                  </span>
                </>
              );
            })()}
          </h2>

          {totalCount !== undefined && totalCount > 0 && (
            <span className="ml-3 text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full whitespace-nowrap">
              {completedCount ?? 0}/{totalCount}
            </span>
          )}
        </div>

        {/* 이벤트 검색 pill — order-3 (데스크톱 only, 항상 표시, StudentSwitcher pill과 동일 토큰) */}
        {onSearchChange && (
          <div className="hidden md:flex order-3 items-center shrink-0 ml-2">
            <div className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-colors min-w-[200px]',
              'bg-[rgb(var(--color-secondary-100))]',
              'hover:bg-[rgb(var(--color-secondary-200))]',
            )}>
              <Search className="w-4 h-4 shrink-0 text-[var(--text-tertiary)]" />
              <input
                ref={searchInputRef}
                type="text"
                value={localSearch}
                onChange={(e) => handleSearchInput(e.target.value)}
                placeholder="이벤트 검색..."
                className="bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] flex-1 min-w-0 focus:outline-none"
                data-search-input
              />
              {localSearch && (
                <button onClick={handleSearchClear} className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* 학생 전환 pill — order-4 (데스크톱 only) */}
        {studentSwitcher && (
          <div className="hidden md:block order-4 shrink-0 ml-1">
            {studentSwitcher}
          </div>
        )}

        {/* 뷰 드롭다운 — order-5 (데스크톱 only) */}
        <div className="hidden md:block order-5 relative shrink-0 ml-2" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((prev) => !prev)}
            className={cn(
              'flex items-center gap-1 px-4 py-1.5 text-sm font-medium rounded-full transition-colors',
              'text-[var(--text-secondary)] border border-[rgb(var(--color-secondary-300))] hover:bg-[rgb(var(--color-secondary-100))]'
            )}
          >
            {activeOption.shortLabel}
            <ChevronDown className={cn(
              'w-4 h-4 transition-transform',
              dropdownOpen && 'rotate-180'
            )} />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] rounded-lg shadow-lg border py-1.5 bg-[rgb(var(--color-secondary-50))] border-[rgb(var(--color-secondary-200))]">
              {VIEW_OPTIONS.map((view) => (
                <button
                  key={view.key}
                  onClick={() => {
                    onViewChange(view.key);
                    if (view.key === 'weekly') onCustomDayCountChange?.(7);
                    setDropdownOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center px-3 py-2 text-sm transition-colors',
                    activeView === view.key && (view.key !== 'weekly' || customDayCount === 7)
                      ? 'bg-[rgb(var(--color-info-50))] text-[rgb(var(--color-info-600))]'
                      : 'text-[var(--text-secondary)] hover:bg-[rgb(var(--color-secondary-100))]'
                  )}
                >
                  <span className="w-5 shrink-0">
                    {activeView === view.key && (view.key !== 'weekly' || customDayCount === 7) && <Check className="w-4 h-4" />}
                  </span>
                  <span className="flex-1 text-left">{view.label}</span>
                  <span className={cn(
                    'text-xs ml-4',
                    activeView === view.key
                      ? 'text-blue-400'
                      : 'text-[var(--text-tertiary)]'
                  )}>{view.shortcut}</span>
                </button>
              ))}

              {/* 커스텀 일수 옵션 */}
              {onCustomDayCountChange && (
                <>
                  <div className="border-t border-[rgb(var(--color-secondary-200))] my-1" />
                  <div className="px-3 py-1.5 text-xs text-[var(--text-tertiary)] font-medium">커스텀 뷰</div>
                  {[2, 3, 4, 5, 6].map((n) => (
                    <button
                      key={`custom-${n}`}
                      onClick={() => {
                        onViewChange('weekly');
                        onCustomDayCountChange(n);
                        setDropdownOpen(false);
                      }}
                      className={cn(
                        'w-full flex items-center px-3 py-2 text-sm transition-colors',
                        activeView === 'weekly' && customDayCount === n
                          ? 'bg-[rgb(var(--color-info-50))] text-[rgb(var(--color-info-600))]'
                          : 'text-[var(--text-secondary)] hover:bg-[rgb(var(--color-secondary-100))]'
                      )}
                    >
                      <span className="w-5 shrink-0">
                        {activeView === 'weekly' && customDayCount === n && <Check className="w-4 h-4" />}
                      </span>
                      <span className="flex-1 text-left">{n}일</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* ⚙️ 설정 아이콘 — order-6 (데스크톱 only) */}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className={cn('hidden md:flex order-6 p-2 rounded-full transition-colors shrink-0 ml-1', hoverBg)}
            title="캘린더 설정 (S)"
          >
            <Settings2 className={cn('w-5 h-5', iconColor)} />
          </button>
        )}

        {/* ⋮ 더보기 메뉴 — order-7 (데스크톱 only) */}
        <div className="hidden md:block order-7 relative shrink-0 ml-1" ref={moreMenuRef}>
          <button
            onClick={() => setMoreMenuOpen((prev) => !prev)}
            className={cn('p-2 rounded-full transition-colors', hoverBg)}
            title="더보기"
          >
            <MoreVertical className={cn('w-5 h-5', iconColor)} />
          </button>
          {moreMenuOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 min-w-[200px] rounded-lg shadow-lg border py-1 bg-[rgb(var(--color-secondary-50))] border-[rgb(var(--color-secondary-200))]">
              {onOpenAnalytics && (
                <button
                  onClick={() => { onOpenAnalytics(); setMoreMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[rgb(var(--color-secondary-100))] transition-colors text-left"
                >
                  <BarChart3 className="w-4 h-4" />
                  분석 대시보드
                </button>
              )}
              {onOpenProgress && (
                <button
                  onClick={() => { onOpenProgress(); setMoreMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[rgb(var(--color-secondary-100))] transition-colors text-left"
                >
                  <ListChecks className="w-4 h-4" />
                  진도관리
                </button>
              )}
              {onOpenHistory && (
                <button
                  onClick={() => { onOpenHistory(); setMoreMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[rgb(var(--color-secondary-100))] transition-colors text-left"
                >
                  <History className="w-4 h-4" />
                  히스토리
                </button>
              )}
              <hr className="my-1 border-[rgb(var(--color-secondary-200))]" />
              {onOpenTemplate && (
                <button
                  onClick={() => { onOpenTemplate(); setMoreMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[rgb(var(--color-secondary-100))] transition-colors text-left"
                >
                  <ClipboardList className="w-4 h-4" />
                  플랜 템플릿
                </button>
              )}
              {onOpenPlanGroupManage && (
                <button
                  onClick={() => { onOpenPlanGroupManage(); setMoreMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[rgb(var(--color-secondary-100))] transition-colors text-left"
                >
                  <Settings2 className="w-4 h-4" />
                  플랜 그룹 관리
                </button>
              )}
              {onOpenMarkdownExport && (
                <button
                  onClick={() => { onOpenMarkdownExport(); setMoreMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[rgb(var(--color-secondary-100))] transition-colors text-left"
                >
                  <FileText className="w-4 h-4" />
                  마크다운 내보내기
                </button>
              )}
              {isAdminMode && onOpenConditionalDelete && (
                <button
                  onClick={() => { onOpenConditionalDelete(); setMoreMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-[rgb(var(--color-error-50))] transition-colors text-left"
                >
                  <Trash2 className="w-4 h-4" />
                  조건부 삭제
                </button>
              )}
              <a
                href="/admin/settings"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMoreMenuOpen(false)}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[rgb(var(--color-secondary-100))] transition-colors text-left"
              >
                <ExternalLink className="w-4 h-4" />
                Google Calendar 연결
              </a>
              <hr className="my-1 border-[rgb(var(--color-secondary-200))]" />
              {onOpenShortcutsHelp && (
                <button
                  onClick={() => { onOpenShortcutsHelp(); setMoreMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[rgb(var(--color-secondary-100))] transition-colors text-left"
                >
                  <Keyboard className="w-4 h-4" />
                  단축키 도움말
                </button>
              )}
            </div>
          )}
        </div>

        {/* 모바일 네비게이션 바 — fixed, TopBar(h-16) 바로 아래 */}
        <div className="md:hidden fixed top-16 left-0 right-0 z-30 flex items-center gap-1 px-2 py-1.5 bg-[rgb(var(--color-secondary-50))] border-b border-[rgb(var(--color-secondary-200))]">
          {/* 모바일 검색 모드 (데스크톱 pill과 동일 토큰) */}
          {searchOpen && onSearchChange ? (
            <div className="flex items-center gap-1 flex-1">
              <button
                onClick={() => { setSearchOpen(false); handleSearchClear(); }}
                className="p-1.5 rounded-full transition-colors hover:bg-[rgb(var(--color-secondary-200))]"
              >
                <ChevronLeft className="w-4 h-4 text-[var(--text-secondary)]" />
              </button>
              <div className="flex-1 flex items-center gap-2 bg-[rgb(var(--color-secondary-100))] rounded-full px-4 py-2">
                <Search className="w-4 h-4 text-[var(--text-tertiary)] shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={localSearch}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  placeholder="이벤트 검색..."
                  className="bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] flex-1 min-w-0 focus:outline-none"
                  autoFocus
                />
                {localSearch && (
                  <button onClick={handleSearchClear} className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* 사이드바 토글 */}
              <button
                onClick={onToggleSidebar}
                className="p-1.5 rounded-full transition-colors hover:bg-[rgb(var(--color-secondary-200))]"
              >
                <Menu className="w-4.5 h-4.5 text-[var(--text-secondary)]" />
              </button>

              {/* 오늘 */}
              <button
                onClick={handleToday}
                className="shrink-0 px-2.5 py-1 text-xs font-medium rounded-full transition-colors text-[var(--text-secondary)] border border-[rgb(var(--color-secondary-300))] hover:bg-[rgb(var(--color-secondary-100))]"
              >
                오늘
              </button>

              {/* < > */}
              <button
                onClick={handlePrev}
                className="p-1 rounded-full transition-colors hover:bg-[rgb(var(--color-secondary-200))]"
              >
                <ChevronLeft className="w-4 h-4 text-[var(--text-secondary)]" />
              </button>
              <button
                onClick={handleNext}
                className="p-1 rounded-full transition-colors hover:bg-[rgb(var(--color-secondary-200))]"
              >
                <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
              </button>

              {/* 날짜 텍스트 */}
              <h2
                className="flex-1 min-w-0 text-sm font-medium truncate text-[var(--text-primary)] leading-none"
                onClick={onGoToDate}
              >
                {monthYearText}
                {activeView === 'daily' && (() => {
                  const dayInfo = formatDayHeader(selectedDate);
                  return (
                    <span className={cn('ml-1', dayInfo.isToday ? 'text-blue-600' : 'text-[var(--text-tertiary)]')}>
                      {dayInfo.dateNum}일 {dayInfo.dayName}
                    </span>
                  );
                })()}
              </h2>

              {/* 이벤트 검색 (모바일) */}
              {onSearchChange && (
                <button
                  onClick={() => setSearchOpen(true)}
                  className="p-1.5 shrink-0 rounded-full transition-colors hover:bg-[rgb(var(--color-secondary-200))]"
                  title="이벤트 검색"
                >
                  <Search className="w-4 h-4 text-[var(--text-secondary)]" />
                </button>
              )}

              {/* 학생 전환기 (모바일) */}
              {studentSwitcher && (
                <div className="shrink-0">
                  {studentSwitcher}
                </div>
              )}

              {/* 뷰 전환 */}
              <div className="relative shrink-0" ref={mobileDropdownRef}>
                <button
                  onClick={() => setDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-0.5 px-2.5 py-1 text-xs font-medium rounded-full transition-colors text-[var(--text-secondary)] border border-[rgb(var(--color-secondary-300))] hover:bg-[rgb(var(--color-secondary-100))]"
                >
                  {activeOption.shortLabel}
                  <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', dropdownOpen && 'rotate-180')} />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 top-full mt-1 z-50 min-w-[140px] rounded-lg shadow-lg border py-1 bg-[rgb(var(--color-secondary-50))] border-[rgb(var(--color-secondary-200))]">
                    {VIEW_OPTIONS.map((view) => (
                      <button
                        key={view.key}
                        onClick={() => {
                          onViewChange(view.key);
                          if (view.key === 'weekly') onCustomDayCountChange?.(7);
                          setDropdownOpen(false);
                        }}
                        className={cn(
                          'w-full flex items-center px-3 py-1.5 text-xs transition-colors',
                          activeView === view.key && (view.key !== 'weekly' || customDayCount === 7)
                            ? 'bg-[rgb(var(--color-info-50))] text-[rgb(var(--color-info-600))]'
                            : 'text-[var(--text-secondary)] hover:bg-[rgb(var(--color-secondary-100))]'
                        )}
                      >
                        <span className="w-4 shrink-0">
                          {activeView === view.key && (view.key !== 'weekly' || customDayCount === 7) && <Check className="w-3 h-3" />}
                        </span>
                        <span className="flex-1 text-left">{view.label}</span>
                      </button>
                    ))}

                    {/* 커스텀 일수 (모바일) */}
                    {onCustomDayCountChange && (
                      <>
                        <div className="border-t border-[rgb(var(--color-secondary-200))] my-1" />
                        {[2, 3, 4, 5, 6].map((n) => (
                          <button
                            key={`mobile-custom-${n}`}
                            onClick={() => {
                              onViewChange('weekly');
                              onCustomDayCountChange(n);
                              setDropdownOpen(false);
                            }}
                            className={cn(
                              'w-full flex items-center px-3 py-1.5 text-xs transition-colors',
                              activeView === 'weekly' && customDayCount === n
                                ? 'bg-[rgb(var(--color-info-50))] text-[rgb(var(--color-info-600))]'
                                : 'text-[var(--text-secondary)] hover:bg-[rgb(var(--color-secondary-100))]'
                            )}
                          >
                            <span className="w-4 shrink-0">
                              {activeView === 'weekly' && customDayCount === n && <Check className="w-3 h-3" />}
                            </span>
                            <span className="flex-1 text-left">{n}일</span>
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // standalone variant: 기존 독립형 레이아웃
  return (
    <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-[rgb(var(--color-secondary-200))] bg-[var(--background)]">
      <div className="flex items-center min-w-0">
        <button
          onClick={onToggleSidebar}
          className={cn('p-2 rounded-full transition-colors', hoverBg)}
          title="사이드바 토글"
        >
          <Menu className={cn('w-5 h-5', iconColor)} />
        </button>

        <button
          onClick={handleToday}
          className="shrink-0 px-4 py-1.5 ml-2 text-sm font-medium text-[var(--text-secondary)] bg-[rgb(var(--color-secondary-50))] border border-[rgb(var(--color-secondary-300))] rounded-full hover:bg-[rgb(var(--color-secondary-100))] transition-colors"
        >
          오늘
        </button>

        <div className="flex items-center ml-2">
          <button onClick={handlePrev} className="p-1.5 rounded-full hover:bg-[rgb(var(--color-secondary-100))] transition-colors">
            <ChevronLeft className="w-5 h-5 text-[var(--text-tertiary)]" />
          </button>
          <button onClick={handleNext} className="p-1.5 rounded-full hover:bg-[rgb(var(--color-secondary-100))] transition-colors">
            <ChevronRight className="w-5 h-5 text-[var(--text-tertiary)]" />
          </button>
        </div>

        <h2
          className={cn(
            "ml-2 text-[22px] font-normal truncate flex items-center gap-2 leading-none text-[var(--text-primary)]",
            onGoToDate && "cursor-pointer hover:bg-[rgb(var(--color-secondary-100))] rounded-lg px-2 -mx-2 py-1 -my-1 transition-colors"
          )}
          onClick={onGoToDate}
          title={onGoToDate ? "날짜로 이동 (G)" : undefined}
        >
          {monthYearText}
          {activeView === 'daily' && (() => {
            const dayInfo = formatDayHeader(selectedDate);
            return (
              <>
                <span
                  className={cn(
                    'w-9 h-9 flex items-center justify-center rounded-full text-base font-medium',
                    dayInfo.isToday ? 'bg-blue-500 text-white' : 'text-[var(--text-primary)]',
                  )}
                >
                  {dayInfo.dateNum}
                </span>
                <span className={cn('text-sm font-normal', dayInfo.isToday ? 'text-blue-600' : 'text-[var(--text-tertiary)]')}>
                  {dayInfo.dayName}
                </span>
              </>
            );
          })()}
        </h2>

        {totalCount !== undefined && totalCount > 0 && (
          <span className="ml-3 text-xs text-[rgb(var(--color-info-600))] bg-[rgb(var(--color-info-100))] px-2 py-0.5 rounded-full whitespace-nowrap">
            {completedCount ?? 0}/{totalCount}
          </span>
        )}
      </div>

      <div className="relative shrink-0" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen((prev) => !prev)}
          className="flex items-center gap-1 px-4 py-1.5 text-sm font-medium text-[var(--text-secondary)] bg-[rgb(var(--color-secondary-50))] border border-[rgb(var(--color-secondary-300))] rounded-full hover:bg-[rgb(var(--color-secondary-100))] transition-colors"
        >
          {activeOption.shortLabel}
          <ChevronDown className={cn('w-4 h-4 transition-transform', dropdownOpen && 'rotate-180')} />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] rounded-lg shadow-lg border border-[rgb(var(--color-secondary-200))] bg-[rgb(var(--color-secondary-50))] py-1.5">
            {VIEW_OPTIONS.map((view) => (
              <button
                key={view.key}
                onClick={() => {
                  onViewChange(view.key);
                  if (view.key === 'weekly') onCustomDayCountChange?.(7);
                  setDropdownOpen(false);
                }}
                className={cn(
                  'w-full flex items-center px-3 py-2 text-sm transition-colors',
                  activeView === view.key && (view.key !== 'weekly' || customDayCount === 7)
                    ? 'bg-[rgb(var(--color-info-50))] text-[rgb(var(--color-info-600))]'
                    : 'text-[var(--text-secondary)] hover:bg-[rgb(var(--color-secondary-100))]'
                )}
              >
                <span className="w-5 shrink-0">
                  {activeView === view.key && (view.key !== 'weekly' || customDayCount === 7) && <Check className="w-4 h-4" />}
                </span>
                <span className="flex-1 text-left">{view.label}</span>
                <span className={cn(
                  'text-xs ml-4',
                  activeView === view.key ? 'text-blue-400' : 'text-[rgb(var(--color-secondary-400))]'
                )}>{view.shortcut}</span>
              </button>
            ))}

            {/* 커스텀 일수 (standalone) */}
            {onCustomDayCountChange && (
              <>
                <div className="border-t border-[rgb(var(--color-secondary-100))] my-1" />
                <div className="px-3 py-1.5 text-xs text-[rgb(var(--color-secondary-400))] font-medium">커스텀 뷰</div>
                {[2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={`standalone-custom-${n}`}
                    onClick={() => {
                      onViewChange('weekly');
                      onCustomDayCountChange(n);
                      setDropdownOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center px-3 py-2 text-sm transition-colors',
                      activeView === 'weekly' && customDayCount === n
                        ? 'bg-[rgb(var(--color-info-50))] text-[rgb(var(--color-info-600))]'
                        : 'text-[var(--text-secondary)] hover:bg-[rgb(var(--color-secondary-100))]'
                    )}
                  >
                    <span className="w-5 shrink-0">
                      {activeView === 'weekly' && customDayCount === n && <Check className="w-4 h-4" />}
                    </span>
                    <span className="flex-1 text-left">{n}일</span>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
