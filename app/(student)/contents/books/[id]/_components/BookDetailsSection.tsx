"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookDetailsDisplay } from "@/app/(student)/contents/_components/BookDetailsDisplay";
import { BookDetailsManager } from "@/app/(student)/contents/_components/BookDetailsManager";
import { saveBookDetailsAction } from "@/app/(student)/actions/contentDetailsActions";
import { BookDetail } from "@/lib/types/plan";

type BookDetailsSectionProps = {
  bookId: string;
  initialDetails: BookDetail[];
  isFromMaster: boolean;
};

export function BookDetailsSection({
  bookId,
  initialDetails,
  isFromMaster,
}: BookDetailsSectionProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [details, setDetails] = useState(initialDetails);
  const [isSaving, setIsSaving] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [currentDetails, setCurrentDetails] = useState<Omit<BookDetail, "id" | "created_at">[]>(
    initialDetails.map((d) => ({
      book_id: d.book_id,
      major_unit: d.major_unit,
      minor_unit: d.minor_unit,
      page_number: d.page_number,
      display_order: d.display_order,
    }))
  );

  const handleSave = async (newDetails: Omit<BookDetail, "id" | "created_at">[]) => {
    setIsSaving(true);
    try {
      const result = await saveBookDetailsAction(bookId, newDetails);
      if (result.success) {
        // 저장된 세부정보로 업데이트
        const updatedDetails: BookDetail[] = newDetails.map((d, index) => ({
          id: `temp-${index}`,
          book_id: bookId,
          major_unit: d.major_unit,
          minor_unit: d.minor_unit,
          page_number: d.page_number || 0,
          display_order: d.display_order || 0,
          created_at: "",
        }));
        setDetails(updatedDetails);
        setIsEditing(false);
        router.refresh();
      }
    } catch (error) {
      console.error("세부정보 저장 실패:", error);
      alert(error instanceof Error ? error.message : "세부정보 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing && !isFromMaster) {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">교재 목차 관리</h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              취소
            </button>
          </div>
        </div>
        <BookDetailsManager
          initialDetails={details}
          onChange={(newDetails) => {
            setCurrentDetails(newDetails);
          }}
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={async () => {
              await handleSave(currentDetails);
            }}
            disabled={isSaving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSaving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">교재 목차</h3>
        <div className="flex gap-2">
          {details.length > 0 && (
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              {isCollapsed ? "전체 펼치기" : "전체 접기"}
            </button>
          )}
          {!isFromMaster && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              {details.length > 0 ? "수정" : "목차 추가"}
            </button>
          )}
          {isFromMaster && (
            <div className="inline-flex items-center gap-2 rounded-md bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700">
              <span>📦</span>
              <span>마스터에서 가져온 교재는 목차 수정이 불가능합니다</span>
            </div>
          )}
        </div>
      </div>
      {details.length > 0 ? (
        isCollapsed ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
            <p className="text-sm text-gray-600">
              {details.length}개의 목차 항목이 있습니다. "전체 펼치기" 버튼을 클릭하여 확인하세요.
            </p>
          </div>
        ) : (
          <BookDetailsDisplay details={details} />
        )
      ) : (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <p className="text-sm text-gray-500">
            목차 정보가 없습니다. "목차 추가" 버튼을 클릭하여 추가하세요.
          </p>
        </div>
      )}
    </div>
  );
}

