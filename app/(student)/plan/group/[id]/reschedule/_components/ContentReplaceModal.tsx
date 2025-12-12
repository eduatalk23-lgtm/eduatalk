/**
 * 콘텐츠 교체 모달 컴포넌트
 * 
 * 학생 콘텐츠 목록을 조회하고 선택할 수 있는 모달입니다.
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type ContentReplaceModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (content: {
    content_id: string;
    content_type: "book" | "lecture" | "custom";
    title: string;
    total_page_or_time: number | null;
    range: { start: number; end: number };
  }) => void;
  studentId: string;
  currentContentType?: "book" | "lecture" | "custom";
  initialRange?: { start: number; end: number } | null;
};

type TabKey = "books" | "lectures" | "custom";

type ContentWithTotal = {
  id: string;
  title: string;
  subtitle: string | null;
  total_page_or_time: number | null;
};

export function ContentReplaceModal({
  isOpen,
  onClose,
  onSelect,
  studentId,
  currentContentType,
  initialRange,
}: ContentReplaceModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>(
    currentContentType === "book"
      ? "books"
      : currentContentType === "lecture"
      ? "lectures"
      : "custom"
  );
  const [contents, setContents] = useState<{
    books: ContentWithTotal[];
    lectures: ContentWithTotal[];
    custom: ContentWithTotal[];
  }>({
    books: [],
    lectures: [],
    custom: [],
  });
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContent, setSelectedContent] = useState<ContentWithTotal | null>(null);
  const [range, setRange] = useState<{ start: number; end: number }>({
    start: initialRange?.start ?? 1,
    end: initialRange?.end ?? 1,
  });

  // 콘텐츠 목록 조회
  useEffect(() => {
    if (!isOpen) return;

    const loadContents = async () => {
      setLoading(true);
      try {
        const supabase = createSupabaseBrowserClient();

        // 책 목록 조회
        const { data: booksData } = await supabase
          .from("books")
          .select("id, title, subject, total_pages")
          .eq("student_id", studentId)
          .order("created_at", { ascending: false });

        const books: ContentWithTotal[] =
          booksData?.map((book) => ({
            id: book.id,
            title: book.title || "제목 없음",
            subtitle: book.subject || null,
            total_page_or_time: book.total_pages ?? null,
          })) || [];

        // 강의 목록 조회
        const { data: lecturesData } = await supabase
          .from("lectures")
          .select("id, title, subject, duration")
          .eq("student_id", studentId)
          .order("created_at", { ascending: false });

        const lectures: ContentWithTotal[] =
          lecturesData?.map((lecture) => ({
            id: lecture.id,
            title: lecture.title || "제목 없음",
            subtitle: lecture.subject || null,
            total_page_or_time: lecture.duration ?? null,
          })) || [];

        // 커스텀 콘텐츠 목록 조회
        const { data: customData } = await supabase
          .from("student_custom_contents")
          .select("id, title, content_type, total_page_or_time")
          .eq("student_id", studentId)
          .order("created_at", { ascending: false });

        const custom: ContentWithTotal[] =
          customData?.map((customContent) => ({
            id: customContent.id,
            title: customContent.title || "커스텀 콘텐츠",
            subtitle: customContent.content_type || null,
            total_page_or_time: customContent.total_page_or_time ?? null,
          })) || [];

        setContents({
          books,
          lectures,
          custom,
        });
      } catch (error) {
        console.error("[ContentReplaceModal] 콘텐츠 목록 조회 실패:", error);
      } finally {
        setLoading(false);
      }
    };

    loadContents();
  }, [isOpen, studentId]);

  // 현재 탭의 콘텐츠 목록
  const currentContents = useMemo(() => {
    const list = contents[activeTab];
    if (!searchQuery.trim()) return list;

    const query = searchQuery.toLowerCase();
    return list.filter(
      (content) =>
        content.title.toLowerCase().includes(query) ||
        content.subtitle?.toLowerCase().includes(query)
    );
  }, [contents, activeTab, searchQuery]);

  // 콘텐츠 선택 핸들러
  const handleContentClick = (content: ContentWithTotal) => {
    setSelectedContent(content);
    // 기본 범위 설정
    if (content.total_page_or_time !== null) {
      setRange({
        start: 1,
        end: Math.min(content.total_page_or_time, initialRange?.end ?? content.total_page_or_time),
      });
    } else {
      setRange({
        start: initialRange?.start ?? 1,
        end: initialRange?.end ?? 1,
      });
    }
  };

  const handleConfirm = () => {
    if (!selectedContent) return;

    const contentType =
      activeTab === "books"
        ? "book"
        : activeTab === "lectures"
        ? "lecture"
        : "custom";

    // 범위 검증
    if (selectedContent.total_page_or_time !== null) {
      if (
        range.start < 1 ||
        range.end > selectedContent.total_page_or_time ||
        range.start > range.end
      ) {
        alert(
          `범위가 유효하지 않습니다. (1 ~ ${selectedContent.total_page_or_time} 사이, 시작 <= 끝)`
        );
        return;
      }
    }

    onSelect({
      content_id: selectedContent.id,
      content_type: contentType,
      title: selectedContent.title,
      total_page_or_time: selectedContent.total_page_or_time,
      range,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-2xl rounded-lg border border-gray-200 bg-white shadow-lg">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-xl font-bold text-gray-900">콘텐츠 교체</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* 탭 및 검색 */}
        <div className="flex flex-col gap-4 border-b border-gray-200 px-6 py-4">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("books")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                activeTab === "books"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              📚 교재 ({contents.books.length})
            </button>
            <button
              onClick={() => setActiveTab("lectures")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                activeTab === "lectures"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              🎥 강의 ({contents.lectures.length})
            </button>
            <button
              onClick={() => setActiveTab("custom")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                activeTab === "custom"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              📝 커스텀 ({contents.custom.length})
            </button>
          </div>

          <input
            type="text"
            placeholder="콘텐츠 제목으로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* 콘텐츠 목록 */}
        <div className="max-h-96 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="py-8 text-center text-sm text-gray-500">
              콘텐츠 목록을 불러오는 중...
            </div>
          ) : currentContents.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              {searchQuery.trim()
                ? "검색 결과가 없습니다."
                : "콘텐츠가 없습니다."}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {currentContents.map((content) => (
                <button
                  key={content.id}
                  onClick={() => handleContentClick(content)}
                  className={`flex items-center justify-between rounded-lg border p-3 text-left transition ${
                    selectedContent?.id === content.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-blue-300 hover:bg-blue-50"
                  }`}
                >
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="font-medium text-gray-900">
                      {content.title}
                    </div>
                    {content.subtitle && (
                      <div className="text-xs text-gray-500">
                        {content.subtitle}
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-gray-600">
                    {content.total_page_or_time !== null
                      ? activeTab === "books"
                        ? `${content.total_page_or_time}페이지`
                        : `${content.total_page_or_time}분`
                      : "정보 없음"}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 범위 입력 (콘텐츠 선택 시) */}
        {selectedContent && (
          <div className="flex flex-col gap-3 border-t border-gray-200 px-6 py-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-medium text-gray-900">
                선택된 콘텐츠: {selectedContent.title}
              </h3>
              {selectedContent.total_page_or_time !== null && (
                <p className="text-xs text-gray-500">
                  총량:{" "}
                  {activeTab === "books"
                    ? `${selectedContent.total_page_or_time}페이지`
                    : `${selectedContent.total_page_or_time}분`}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700">
                  시작 범위:
                </label>
                <input
                  type="number"
                  value={range.start}
                  onChange={(e) =>
                    setRange({
                      ...range,
                      start: parseInt(e.target.value) || 1,
                    })
                  }
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  min={1}
                  max={selectedContent.total_page_or_time ?? undefined}
                />
              </div>
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700">
                  끝 범위:
                </label>
                <input
                  type="number"
                  value={range.end}
                  onChange={(e) =>
                    setRange({
                      ...range,
                      end: parseInt(e.target.value) || 1,
                    })
                  }
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  min={range.start}
                  max={selectedContent.total_page_or_time ?? undefined}
                />
              </div>
            </div>
          </div>
        )}

        {/* 푸터 */}
        <div className="border-t border-gray-200 px-6 py-4">
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              취소
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedContent}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500"
            >
              확인
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
