"use client";

/**
 * 간편 도서 등록 폼
 *
 * 제목 입력 시 AI가 메타데이터를 자동 추론합니다.
 */

import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { AIMetadataPanel } from "./AIMetadataPanel";
import {
  extractContentMetadata,
  calculateOverallConfidence,
  type ExtractedMetadata,
} from "@/lib/domains/content-research";
import { addMasterBook } from "@/lib/domains/content";
import FormField from "@/components/molecules/FormField";

interface QuickBookFormProps {
  publishers: Array<{ id: string; name: string }>;
}

export function QuickBookForm({ publishers }: QuickBookFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // 폼 상태
  const [title, setTitle] = useState("");
  const [publisherName, setPublisherName] = useState("");
  const [totalPages, setTotalPages] = useState<number | undefined>();
  const [isbn13, setIsbn13] = useState("");

  // AI 메타데이터 상태
  const [aiMetadata, setAiMetadata] = useState<ExtractedMetadata | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [overallScore, setOverallScore] = useState(0);

  // 사용자 수정 값
  const [userOverrides, setUserOverrides] = useState<Partial<ExtractedMetadata>>({});

  // 디바운스된 제목
  const debouncedTitle = useDebounce(title, 800);

  // 제목 변경 시 AI 메타데이터 추출
  const handleTitleChange = useCallback(async (newTitle: string) => {
    setTitle(newTitle);

    // 제목이 충분히 길면 AI 추론 시작
    if (newTitle.trim().length >= 3) {
      setAiLoading(true);
      setAiError(null);

      try {
        const result = await extractContentMetadata(newTitle, "book", publisherName || undefined);

        if (result.success && result.metadata) {
          setAiMetadata(result.metadata);
          setOverallScore(calculateOverallConfidence(result.metadata));
          setUserOverrides({});
        } else {
          setAiError(result.error ?? "메타데이터 추출 실패");
          setAiMetadata(null);
        }
      } catch (error) {
        setAiError("AI 서비스 오류");
        setAiMetadata(null);
      } finally {
        setAiLoading(false);
      }
    } else {
      setAiMetadata(null);
      setAiError(null);
    }
  }, [publisherName]);

  // 메타데이터 필드 수정
  const handleMetadataEdit = (field: keyof ExtractedMetadata, value: unknown) => {
    setUserOverrides((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // 폼 제출
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!title.trim()) {
      alert("교재명을 입력해주세요.");
      return;
    }

    // 최종 메타데이터 병합
    const finalMetadata = aiMetadata
      ? { ...aiMetadata, ...userOverrides }
      : null;

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("title", title.trim());

        if (totalPages) {
          formData.append("totalPages", String(totalPages));
        }
        if (publisherName) {
          formData.append("publisherName", publisherName);
        }
        if (isbn13) {
          formData.append("isbn13", isbn13);
        }

        // AI 메타데이터 적용
        if (finalMetadata) {
          if (finalMetadata.subject) {
            formData.append("subject", finalMetadata.subject);
          }
          if (finalMetadata.subjectCategory) {
            formData.append("subjectCategory", finalMetadata.subjectCategory);
          }
          if (finalMetadata.difficulty) {
            formData.append("difficultyLevel", finalMetadata.difficulty);
          }
          if (finalMetadata.curriculum) {
            formData.append("revision", finalMetadata.curriculum);
          }
          if (finalMetadata.gradeLevel.length > 0) {
            const gradeMin = Math.min(
              ...finalMetadata.gradeLevel.map((g) => parseInt(g.replace(/[^0-9]/g, "")) || 1)
            );
            const gradeMax = Math.max(
              ...finalMetadata.gradeLevel.map((g) => parseInt(g.replace(/[^0-9]/g, "")) || 3)
            );
            formData.append("gradeMin", String(gradeMin));
            formData.append("gradeMax", String(gradeMax));
          }
        }

        // addMasterBook은 성공 시 redirect()를 호출하므로 반환값이 없음
        // 에러 시에만 catch로 이동
        await addMasterBook(formData);
        // 이 줄에 도달하면 redirect가 실패한 것이므로 수동으로 이동
        router.push("/admin/master-books");
        router.refresh();
      } catch (error) {
        // redirect()도 NEXT_REDIRECT 에러를 발생시키므로 이를 구분
        if ((error as Error)?.message?.includes("NEXT_REDIRECT")) {
          // 정상적인 리다이렉트이므로 에러가 아님
          return;
        }
        console.error("Submit error:", error);
        alert((error as Error)?.message ?? "오류가 발생했습니다.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 안내 배너 */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl">✨</span>
          <div>
            <p className="font-medium text-blue-800">AI 간편 등록</p>
            <p className="text-sm text-blue-700 mt-1">
              교재명을 입력하면 AI가 과목, 난이도, 교육과정을 자동으로 추론합니다.
              추론 결과를 확인하고 수정할 수 있습니다.
            </p>
          </div>
        </div>
      </div>

      {/* 필수 정보 */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold mb-4">기본 정보</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {/* 교재명 */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              교재명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="예: 수학의 정석 기본편"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* 총 페이지 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              총 페이지
            </label>
            <input
              type="number"
              value={totalPages ?? ""}
              onChange={(e) => setTotalPages(e.target.value ? Number(e.target.value) : undefined)}
              placeholder="예: 320"
              min={1}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {totalPages && (
              <p className="text-xs text-gray-500 mt-1">
                예상 학습 시간: 약 {Math.round(totalPages / 10)}시간
              </p>
            )}
          </div>

          {/* 출판사 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              출판사
            </label>
            <input
              type="text"
              value={publisherName}
              onChange={(e) => setPublisherName(e.target.value)}
              placeholder="예: 성지출판"
              list="publisher-list"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <datalist id="publisher-list">
              {publishers.map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
          </div>

          {/* ISBN */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ISBN-13 (선택)
            </label>
            <input
              type="text"
              value={isbn13}
              onChange={(e) => setIsbn13(e.target.value)}
              placeholder="예: 9788972879978"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* AI 메타데이터 패널 */}
      <AIMetadataPanel
        metadata={aiMetadata}
        overallScore={overallScore}
        isLoading={aiLoading}
        error={aiError}
        onEdit={handleMetadataEdit}
      />

      {/* 제출 버튼 */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={isPending || !title.trim()}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "등록 중..." : "교재 등록"}
        </button>
      </div>
    </form>
  );
}
