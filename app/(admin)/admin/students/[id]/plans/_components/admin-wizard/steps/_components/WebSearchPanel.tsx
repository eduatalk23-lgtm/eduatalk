"use client";

import { useState } from "react";
import { Search, Loader2, BookOpen, Video, Globe, Plus, AlertCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { searchExternalContentAction, type VirtualContentItem } from "@/lib/domains/plan/llm/actions/searchContent";
import { type SelectedContent, type SubjectType } from "../../_context/types";
import { SUBJECT_TYPE_OPTIONS } from "@/lib/domains/admin-plan/types";

interface WebSearchPanelProps {
  studentId: string;
  onSelect: (content: SelectedContent) => void;
  disabled?: boolean;
}

export function WebSearchPanel({ studentId, onSelect, disabled }: WebSearchPanelProps) {
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState<string>("영어"); // Default to English or Math
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<VirtualContentItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    setError(null);
    setResults([]);

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

  const handleAdd = (item: VirtualContentItem) => {
    // Convert VirtualContentItem to SelectedContent
    const newContent: SelectedContent = {
      contentId: `virtual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Temporary ID
      contentType: item.contentType,
      title: item.title,
      subject: subject,
      startRange: 1,
      endRange: item.totalRange,
      totalRange: item.totalRange,
      subjectType: null, // Default
      displayOrder: 0, // Will be set by parent
      virtualContentDetails: item, // Store full details for later persistence
    };
    onSelect(newContent);
  };

  return (
    <div className="space-y-6">
      {/* Search Bar */}
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
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <button
                type="button"
                onClick={handleSearch}
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

      {/* Results */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {!isSearching && results.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-1">
          {results.map((item, idx) => (
            <div key={idx} className="relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:border-purple-200 hover:shadow-md">
              <div className="flex items-start gap-4 p-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-50">
                  {item.contentType === "book" ? (
                    <BookOpen className="h-6 w-6 text-gray-400" />
                  ) : (
                    <Video className="h-6 w-6 text-gray-400" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
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
                      onClick={() => handleAdd(item)}
                      className="group flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4" />
                      추가
                    </button>
                  </div>
                  
                  {/* Partial Preview of Chapters */}
                  <div className="mt-4 rounded-lg bg-gray-50 p-3">
                    <p className="mb-2 text-xs font-semibold text-gray-500">목차 미리보기</p>
                    <div className="space-y-1">
                      {item.chapters.slice(0, 3).map((ch, i) => (
                        <div key={i} className="flex justify-between text-xs text-gray-600">
                          <span className="truncate">{ch.title}</span>
                          <span className="shrink-0 text-gray-400">{ch.startRange}-{ch.endRange}</span>
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
      
      {!isSearching && results.length === 0 && !error && query && (
         <div className="py-8 text-center text-sm text-gray-500">
           검색 결과가 없습니다. 정확한 교재/강의명을 입력해주세요.
         </div>
      )}
    </div>
  );
}
