"use client";

import { useState } from "react";
import { Search, Loader2, BookOpen, Video, Globe, Plus, AlertCircle, Sparkles, Wand2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { searchExternalContentAction, type VirtualContentItem } from "@/lib/domains/plan/llm/actions/searchContent";
import { type SelectedContent, type SubjectType } from "../../_context/types";
import { SUBJECT_TYPE_OPTIONS } from "@/lib/domains/admin-plan/types";
import {
  getUnifiedContentRecommendation,
  type RecommendedContent,
} from "@/lib/domains/plan/llm/actions/unifiedContentRecommendation";
import { getTenantContext } from "@/lib/tenant/getTenantContext";

/**
 * 검색 모드
 */
type SearchMode = "direct" | "ai-recommend";

/**
 * 교과 옵션
 */
const SUBJECT_CATEGORIES = [
  { value: "국어", label: "국어" },
  { value: "수학", label: "수학" },
  { value: "영어", label: "영어" },
  { value: "한국사", label: "한국사" },
  { value: "사회", label: "사회" },
  { value: "과학", label: "과학" },
] as const;

/**
 * 난이도 옵션
 */
const DIFFICULTY_OPTIONS = [
  { value: "", label: "전체" },
  { value: "개념", label: "개념" },
  { value: "기본", label: "기본" },
  { value: "심화", label: "심화" },
] as const;

/**
 * 콘텐츠 타입 옵션
 */
const CONTENT_TYPE_OPTIONS = [
  { value: "all", label: "전체" },
  { value: "book", label: "교재" },
  { value: "lecture", label: "강의" },
] as const;

interface WebSearchPanelProps {
  studentId: string;
  onSelect: (content: SelectedContent) => void;
  disabled?: boolean;
}

export function WebSearchPanel({ studentId, onSelect, disabled }: WebSearchPanelProps) {
  // 모드 상태
  const [mode, setMode] = useState<SearchMode>("ai-recommend");

  // 직접 검색 상태
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState<string>("영어");

  // AI 추천 상태
  const [subjectCategory, setSubjectCategory] = useState<string>("수학");
  const [difficultyLevel, setDifficultyLevel] = useState<string>("");
  const [contentType, setContentType] = useState<"book" | "lecture" | "all">("all");

  // 공통 상태
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<VirtualContentItem[]>([]);
  const [aiResults, setAiResults] = useState<RecommendedContent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ fromCache: number; fromWebSearch: number; newlySaved: number } | null>(null);

  // 직접 검색 실행
  const handleDirectSearch = async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    setError(null);
    setResults([]);
    setAiResults([]);

    try {
      const result = await searchExternalContentAction(query, subject);

      if (!result.success) {
        setError(result.error || "검색에 실패했습니다.");
      } else if (result.data) {
        setResults(result.data);
      }
    } catch (e) {
      setError("AI 검색 중 오류가 발생했습니다.");
    } finally {
      setIsSearching(false);
    }
  };

  // AI 추천 (콜드 스타트) 실행
  const handleAiRecommend = async () => {
    if (!subjectCategory) return;

    setIsSearching(true);
    setError(null);
    setResults([]);
    setAiResults([]);
    setStats(null);

    try {
      // 테넌트 컨텍스트 조회
      const tenantContext = await getTenantContext();

      if (!tenantContext?.tenantId) {
        setError("테넌트 정보를 찾을 수 없습니다.");
        return;
      }

      const result = await getUnifiedContentRecommendation({
        tenantId: tenantContext.tenantId,
        studentId,
        subjectCategory,
        difficultyLevel: difficultyLevel || undefined,
        contentType,
        maxResults: 10,
        forceColdStart: true, // AI 웹 검색 강제
        saveResults: true,
      });

      if (!result.success) {
        setError(result.error || "AI 추천에 실패했습니다.");
      } else if (result.recommendations) {
        setAiResults(result.recommendations);
        setStats(result.stats ?? null);
      }
    } catch (e) {
      console.error("AI 추천 오류:", e);
      setError("AI 추천 중 오류가 발생했습니다.");
    } finally {
      setIsSearching(false);
    }
  };

  // VirtualContentItem → SelectedContent 변환
  const handleAddVirtual = (item: VirtualContentItem) => {
    const newContent: SelectedContent = {
      contentId: `virtual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      contentType: item.contentType,
      title: item.title,
      subject: subject,
      startRange: 1,
      endRange: item.totalRange,
      totalRange: item.totalRange,
      subjectType: null,
      displayOrder: 0,
      virtualContentDetails: item,
    };
    onSelect(newContent);
  };

  // RecommendedContent → SelectedContent 변환
  const handleAddRecommended = (item: RecommendedContent) => {
    const newContent: SelectedContent = {
      contentId: item.id,
      contentType: item.contentType,
      title: item.title,
      subject: subjectCategory,
      subjectCategory: subjectCategory,
      startRange: 1,
      endRange: item.totalRange || 1,
      totalRange: item.totalRange || 1,
      subjectType: null,
      displayOrder: 0,
    };
    onSelect(newContent);
  };

  return (
    <div className="space-y-6">
      {/* 모드 토글 */}
      <div className="flex gap-2 rounded-lg bg-gray-100 p-1">
        <button
          type="button"
          onClick={() => setMode("ai-recommend")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition",
            mode === "ai-recommend"
              ? "bg-white text-purple-700 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          )}
        >
          <Wand2 className="h-4 w-4" />
          AI 추천
        </button>
        <button
          type="button"
          onClick={() => setMode("direct")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition",
            mode === "direct"
              ? "bg-white text-purple-700 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          )}
        >
          <Search className="h-4 w-4" />
          직접 검색
        </button>
      </div>

      {/* AI 추천 모드 */}
      {mode === "ai-recommend" && (
        <div className="rounded-xl border border-purple-100 bg-gradient-to-br from-purple-50 to-indigo-50 p-6">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100">
              <Wand2 className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">AI 콘텐츠 추천</h3>
              <p className="text-xs text-gray-500">교과와 난이도를 선택하면 AI가 최적의 콘텐츠를 추천합니다</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {/* 교과 선택 */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">교과</label>
              <select
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
                value={subjectCategory}
                onChange={(e) => setSubjectCategory(e.target.value)}
              >
                {SUBJECT_CATEGORIES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 난이도 선택 */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">난이도</label>
              <select
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
                value={difficultyLevel}
                onChange={(e) => setDifficultyLevel(e.target.value)}
              >
                {DIFFICULTY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 콘텐츠 타입 선택 */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">콘텐츠 타입</label>
              <select
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
                value={contentType}
                onChange={(e) => setContentType(e.target.value as "book" | "lecture" | "all")}
              >
                {CONTENT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAiRecommend}
            disabled={isSearching || !subjectCategory}
            className={cn(
              "mt-4 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition",
              isSearching || !subjectCategory
                ? "cursor-not-allowed bg-gray-200 text-gray-400"
                : "bg-purple-600 text-white hover:bg-purple-700"
            )}
          >
            {isSearching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                AI가 콘텐츠를 찾고 있습니다...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                AI 추천 받기
              </>
            )}
          </button>

          <p className="mt-3 text-xs text-gray-500">
            * AI가 웹에서 최신 교재와 강의 정보를 검색하여 목차와 분량까지 분석합니다.
          </p>
        </div>
      )}

      {/* 직접 검색 모드 */}
      {mode === "direct" && (
        <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="w-full sm:w-48">
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                과목 / 주제
              </label>
              <select
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              >
                <option value="국어">국어</option>
                <option value="영어">영어</option>
                <option value="수학">수학</option>
                <option value="탐구">탐구</option>
                <option value="기타">기타</option>
              </select>
            </div>

            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                <span className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-purple-500" />
                  검색어 (교재명, 강의명)
                </span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="예: 2025 EBS 수능특강 영어, 쎈 수학1"
                  className="w-full rounded-lg border border-gray-200 py-2 pl-4 pr-12 text-sm focus:border-purple-500 focus:outline-none"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleDirectSearch()}
                />
                <button
                  type="button"
                  onClick={handleDirectSearch}
                  disabled={isSearching || !query.trim()}
                  className="absolute right-1 top-1 rounded-md bg-purple-600 p-1.5 text-white hover:bg-purple-700 disabled:bg-gray-300"
                >
                  {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            * AI가 웹 검색을 통해 해당 콘텐츠의 목차와 분량을 자동으로 분석합니다.
          </p>
        </div>
      )}

      {/* 에러 표시 */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* AI 추천 결과 통계 */}
      {!isSearching && aiResults.length > 0 && stats && (
        <div className="flex items-center gap-4 rounded-lg bg-purple-50 px-4 py-3 text-sm">
          <span className="font-medium text-purple-700">AI 추천 결과</span>
          <div className="flex gap-3 text-xs text-purple-600">
            {stats.fromCache > 0 && <span>캐시: {stats.fromCache}개</span>}
            {stats.fromWebSearch > 0 && <span>웹 검색: {stats.fromWebSearch}개</span>}
            {stats.newlySaved > 0 && <span>새로 저장: {stats.newlySaved}개</span>}
          </div>
        </div>
      )}

      {/* AI 추천 결과 (콜드 스타트) */}
      {!isSearching && aiResults.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-1">
          {aiResults.map((item, idx) => (
            <div
              key={item.id || idx}
              className="relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:border-purple-200 hover:shadow-md"
            >
              {/* 추천 점수 배지 */}
              {item.matchScore && (
                <div className="absolute right-4 top-4">
                  <span className="rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700">
                    일치도 {item.matchScore}%
                  </span>
                </div>
              )}

              <div className="flex items-start gap-4 p-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-purple-50">
                  {item.contentType === "book" ? (
                    <BookOpen className="h-6 w-6 text-purple-500" />
                  ) : (
                    <Video className="h-6 w-6 text-purple-500" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className="font-semibold text-gray-900">{item.title}</h4>
                      <p className="text-sm text-gray-500">
                        {item.author && `${item.author} · `}
                        {item.publisher && `${item.publisher} · `}
                        {item.totalRange} {item.contentType === "book" ? "페이지" : "강"}
                      </p>
                      {item.difficultyLevel && (
                        <span className="mt-1 inline-block rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                          {item.difficultyLevel}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => handleAddRecommended(item)}
                      className="group flex shrink-0 items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-purple-700 disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4" />
                      추가
                    </button>
                  </div>

                  {/* 추천 이유 */}
                  {item.reason && (
                    <p className="mt-2 text-sm text-gray-600">
                      <span className="font-medium text-purple-600">추천 이유:</span> {item.reason}
                    </p>
                  )}

                  {/* 목차 미리보기 */}
                  {item.chapters && item.chapters.length > 0 && (
                    <div className="mt-4 rounded-lg bg-gray-50 p-3">
                      <p className="mb-2 text-xs font-semibold text-gray-500">목차 미리보기</p>
                      <div className="space-y-1">
                        {item.chapters.slice(0, 3).map((ch, i) => (
                          <div key={i} className="flex justify-between text-xs text-gray-600">
                            <span className="truncate">{ch.title}</span>
                            <span className="shrink-0 text-gray-400">
                              {ch.startRange}-{ch.endRange}
                            </span>
                          </div>
                        ))}
                        {item.chapters.length > 3 && (
                          <p className="text-xs text-gray-400">+ {item.chapters.length - 3}개 더</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 직접 검색 결과 */}
      {!isSearching && results.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-1">
          {results.map((item, idx) => (
            <div
              key={idx}
              className="relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:border-purple-200 hover:shadow-md"
            >
              <div className="flex items-start gap-4 p-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-50">
                  {item.contentType === "book" ? (
                    <BookOpen className="h-6 w-6 text-gray-400" />
                  ) : (
                    <Video className="h-6 w-6 text-gray-400" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900">{item.title}</h4>
                      <p className="text-sm text-gray-500">
                        {item.author && `${item.author} · `}
                        {item.totalRange} {item.contentType === "book" ? "페이지" : "강"}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => handleAddVirtual(item)}
                      className="group flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4" />
                      추가
                    </button>
                  </div>

                  {/* 목차 미리보기 */}
                  <div className="mt-4 rounded-lg bg-gray-50 p-3">
                    <p className="mb-2 text-xs font-semibold text-gray-500">목차 미리보기</p>
                    <div className="space-y-1">
                      {item.chapters.slice(0, 3).map((ch, i) => (
                        <div key={i} className="flex justify-between text-xs text-gray-600">
                          <span className="truncate">{ch.title}</span>
                          <span className="shrink-0 text-gray-400">
                            {ch.startRange}-{ch.endRange}
                          </span>
                        </div>
                      ))}
                      {item.chapters.length > 3 && (
                        <p className="text-xs text-gray-400">+ 더 많은 목차 포함</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 결과 없음 메시지 */}
      {!isSearching && mode === "direct" && results.length === 0 && !error && query && (
        <div className="py-8 text-center text-sm text-gray-500">
          검색 결과가 없습니다. 정확한 교재/강의명을 입력해주세요.
        </div>
      )}

      {!isSearching && mode === "ai-recommend" && aiResults.length === 0 && !error && (
        <div className="py-8 text-center">
          <Wand2 className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">
            교과와 난이도를 선택하고 &quot;AI 추천 받기&quot; 버튼을 클릭하세요.
          </p>
        </div>
      )}
    </div>
  );
}
