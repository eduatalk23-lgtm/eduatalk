"use client";

import { useState, useTransition } from "react";
import { searchContentMastersAction, copyMasterToStudentContentAction } from "@/app/(student)/actions/contentMasterActions";
import { ContentMaster } from "@/lib/types/plan";

type ContentMasterSearchProps = {
  contentType: "book" | "lecture";
  onContentAdded: (contentId: string, contentType: "book" | "lecture") => void;
  onClose: () => void;
};

export function ContentMasterSearch({
  contentType,
  onContentAdded,
  onClose,
}: ContentMasterSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [subject, setSubject] = useState("");
  const [results, setResults] = useState<ContentMaster[]>([]);
  const [isSearching, startSearch] = useTransition();
  const [copyingId, setCopyingId] = useState<string | null>(null);

  const handleSearch = () => {
    if (!searchQuery.trim() && !subject) {
      return;
    }

    startSearch(async () => {
      try {
        const result = await searchContentMastersAction({
          content_type: contentType,
          search: searchQuery.trim() || undefined,
          subject: subject || undefined,
          limit: 20,
        });
        setResults(result.data);
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "검색에 실패했습니다."
        );
      }
    });
  };

  const handleCopy = async (masterId: string) => {
    setCopyingId(masterId);
    try {
      const result = await copyMasterToStudentContentAction(masterId);
      const contentId = result.bookId || result.lectureId;
      if (contentId) {
        onContentAdded(contentId, contentType);
        onClose();
      }
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "콘텐츠 복사에 실패했습니다."
      );
    } finally {
      setCopyingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            {contentType === "book" ? "📚 교재 검색" : "🎧 강의 검색"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {/* 검색 폼 */}
        <div className="mb-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              제목 검색
            </label>
            <input
              type="text"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
              placeholder="교재/강의 이름을 입력하세요"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearch();
                }
              }}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              과목 (선택사항)
            </label>
            <input
              type="text"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
              placeholder="예: 국어, 수학"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={handleSearch}
            disabled={isSearching}
            className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isSearching ? "검색 중..." : "검색"}
          </button>
        </div>

        {/* 검색 결과 */}
        {results.length > 0 && (
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {results.map((master) => (
              <div
                key={master.id}
                className="flex items-start justify-between rounded-lg border border-gray-200 bg-gray-50 p-4"
              >
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{master.title}</h4>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-600">
                    {master.publisher_or_academy && (
                      <span>{master.publisher_or_academy}</span>
                    )}
                    {master.subject && <span>· {master.subject}</span>}
                    {master.semester && <span>· {master.semester}</span>}
                    {master.revision && <span>· {master.revision}</span>}
                    {master.total_pages && (
                      <span>· {master.total_pages}페이지</span>
                    )}
                    {master.total_episodes && (
                      <span>· {master.total_episodes}회차</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(master.id)}
                  disabled={copyingId === master.id}
                  className="ml-4 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400"
                >
                  {copyingId === master.id ? "복사 중..." : "가져오기"}
                </button>
              </div>
            ))}
          </div>
        )}

        {results.length === 0 && !isSearching && searchQuery && (
          <div className="py-8 text-center text-sm text-gray-500">
            검색 결과가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}

