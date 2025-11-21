"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateLecture } from "@/app/(student)/actions/contentActions";
import { Lecture } from "@/app/types/content";
import { ContentHeader } from "@/app/(student)/contents/_components/ContentHeader";
import { ContentDetailTable } from "@/app/(student)/contents/_components/ContentDetailTable";

type LectureInfoSectionProps = {
  lecture: Lecture & { linked_book_id?: string | null };
  deleteAction: () => void;
  linkedBook?: { id: string; title: string } | null;
  studentBooks?: Array<{ id: string; title: string }>;
  isFromMaster?: boolean;
};

export function LectureInfoSection({ lecture, deleteAction, linkedBook, studentBooks = [], isFromMaster = false }: LectureInfoSectionProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: lecture.title,
    revision: lecture.revision || "",
    semester: lecture.semester || "",
    subject_category: lecture.subject_category || "",
    subject: lecture.subject || "",
    platform: lecture.platform || "",
    difficulty_level: lecture.difficulty_level || "",
    duration: lecture.duration || "",
    notes: lecture.notes || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const formDataObj = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        formDataObj.append(key, String(value));
      });

      await updateLecture(lecture.id, formDataObj);
      setIsEditing(false);
      router.refresh();
    } catch (error) {
      console.error("강의 수정 실패:", error);
      alert(error instanceof Error ? error.message : "강의 수정에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">강의 정보 수정</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* 강의명 */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                강의명 <span className="text-red-500">*</span>
              </label>
              <input
                name="title"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="강의명을 입력하세요"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* 개정교육과정 */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                개정교육과정
              </label>
              <input
                name="revision"
                value={formData.revision}
                onChange={(e) => setFormData({ ...formData, revision: e.target.value })}
                placeholder="예: 2015개정"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* 학년/학기 */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                학년/학기
              </label>
              <input
                name="semester"
                value={formData.semester}
                onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                placeholder="예: 고3-1"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* 교과 */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                교과
              </label>
              <select
                name="subject_category"
                value={formData.subject_category}
                onChange={(e) => setFormData({ ...formData, subject_category: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">선택하세요</option>
                <option value="국어">국어</option>
                <option value="수학">수학</option>
                <option value="영어">영어</option>
                <option value="사회">사회</option>
                <option value="과학">과학</option>
              </select>
            </div>

            {/* 과목 */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                과목
              </label>
              <input
                name="subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="예: 화법과 작문"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* 플랫폼 */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                플랫폼
              </label>
              <input
                name="platform"
                value={formData.platform}
                onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                placeholder="예: 메가스터디, EBSi"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* 총 강의시간 */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                총 강의시간 (분)
              </label>
              <input
                name="duration"
                type="number"
                min="0"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                placeholder="예: 300"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* 난이도 */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                난이도
              </label>
              <select
                name="difficulty"
                value={formData.difficulty_level}
                onChange={(e) => setFormData({ ...formData, difficulty_level: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">선택하세요</option>
                <option value="하">하</option>
                <option value="중">중</option>
                <option value="중상">중상</option>
                <option value="상">상</option>
                <option value="최상">최상</option>
              </select>
            </div>

            {/* 메모 */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                메모
              </label>
              <textarea
                name="notes"
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="메모를 입력하세요"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex justify-end gap-3 border-t pt-4">
            <button
              type="button"
              onClick={() => {
                    setFormData({
                      title: lecture.title,
                      revision: lecture.revision || "",
                      semester: lecture.semester || "",
                      subject_category: lecture.subject_category || "",
                      subject: lecture.subject || "",
                      platform: lecture.platform || "",
                      difficulty_level: lecture.difficulty_level || "",
                      duration: lecture.duration || "",
                      notes: lecture.notes || "",
                    });
                setIsEditing(false);
              }}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSaving ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div>
      {/* 정보 수정 버튼 */}
      {!isFromMaster && (
        <div className="mb-6 flex items-center justify-end">
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            정보 수정
          </button>
        </div>
      )}
      {isFromMaster && (
        <div className="mb-6 flex items-center justify-end">
          <div className="inline-flex items-center gap-2 rounded-md bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700">
            <span>📦</span>
            <span>마스터에서 가져온 강의는 정보 수정이 불가능합니다</span>
          </div>
        </div>
      )}

      <ContentHeader
        title={lecture.title}
        subtitle={lecture.platform || ""}
        icon="🎧 강의"
        createdAt={lecture.created_at}
      />

      <ContentDetailTable
        rows={[
          { label: "개정교육과정", value: lecture.revision },
          { label: "학년/학기", value: lecture.semester },
          { label: "교과", value: lecture.subject_category },
          { label: "과목", value: lecture.subject },
          { label: "플랫폼", value: lecture.platform },
          { label: "난이도", value: lecture.difficulty_level },
          {
            label: "총 회차",
            value: lecture.total_episodes ? `${lecture.total_episodes}회` : null,
          },
          {
            label: "총 길이",
            value: lecture.duration ? `${lecture.duration}분` : null,
          },
          { label: "메모", value: lecture.notes },
        ]}
      />
    </div>
  );
}

