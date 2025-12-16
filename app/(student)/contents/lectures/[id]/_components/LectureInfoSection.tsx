"use client";

import { useState } from "react";
import { updateLecture } from "@/app/(student)/actions/contentActions";
import { Lecture } from "@/app/types/content";
import { MasterLecture } from "@/lib/types/plan";
import { ContentHeader } from "@/app/(student)/contents/_components/ContentHeader";
import { ContentDetailTable } from "@/app/(student)/contents/_components/ContentDetailTable";
import { ContentEditForm } from "@/app/(student)/contents/_components/ContentEditForm";

type LectureInfoSectionProps = {
  lecture: Lecture & { linked_book_id?: string | null };
  deleteAction: () => void;
  linkedBook?: { id: string; title: string } | null;
  studentBooks?: Array<{ id: string; title: string }>;
  isFromMaster?: boolean;
  masterLecture?: MasterLecture | null;
};

const DIFFICULTY_OPTIONS = [
  { value: "하", label: "하" },
  { value: "중", label: "중" },
  { value: "중상", label: "중상" },
  { value: "상", label: "상" },
  { value: "최상", label: "최상" },
];

const SUBJECT_CATEGORY_OPTIONS = [
  { value: "국어", label: "국어" },
  { value: "수학", label: "수학" },
  { value: "영어", label: "영어" },
  { value: "사회", label: "사회" },
  { value: "과학", label: "과학" },
];

export function LectureInfoSection({ lecture, deleteAction, linkedBook, studentBooks = [], isFromMaster = false, masterLecture }: LectureInfoSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const lectureFields = [
    { name: "title", label: "강의명", type: "text" as const, required: true, placeholder: "강의명을 입력하세요", colSpan: 2 as const },
    { name: "revision", label: "개정교육과정", type: "text" as const, placeholder: "예: 2015개정" },
    { name: "semester", label: "학년/학기", type: "text" as const, placeholder: "예: 고3-1" },
    { name: "subject_category", label: "교과", type: "select" as const, options: SUBJECT_CATEGORY_OPTIONS },
    { name: "subject", label: "과목", type: "text" as const, placeholder: "예: 화법과 작문" },
    { name: "platform", label: "플랫폼", type: "text" as const, placeholder: "예: 메가스터디, EBSi" },
    { name: "duration", label: "총 강의시간 (분)", type: "number" as const, min: 0, placeholder: "예: 300" },
    { name: "difficulty_level", label: "난이도", type: "select" as const, options: DIFFICULTY_OPTIONS },
    { name: "notes", label: "메모", type: "textarea" as const, placeholder: "메모를 입력하세요", colSpan: 2 as const },
  ];

  const handleSubmit = async (formData: FormData) => {
    setIsSaving(true);
    try {
      await updateLecture(lecture.id, formData);
      setIsEditing(false);
    } catch (error) {
      throw error; // ContentEditForm에서 처리
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
    return (
      <ContentEditForm
        title="강의 정보 수정"
        initialData={lecture}
        fields={lectureFields}
        onSubmit={handleSubmit}
        onCancel={() => setIsEditing(false)}
        isSaving={isSaving}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 정보 수정 버튼 */}
      {!isFromMaster && (
        <div className="flex items-center justify-end">
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
        <div className="flex items-center justify-end">
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
        contentType="lecture"
        createdAt={lecture.created_at}
      />

      <ContentDetailTable
        rows={[
          { label: "개정교육과정", value: lecture.revision ?? null },
          { label: "학년/학기", value: lecture.semester ?? null },
          { label: "교과", value: lecture.subject_category ?? null },
          { label: "과목", value: lecture.subject ?? null },
          { label: "플랫폼", value: lecture.platform ?? null },
          { label: "강의 유형", value: lecture.lecture_type ?? null },
          { label: "콘텐츠 카테고리", value: lecture.content_category ?? null },
          { label: "강사명", value: lecture.instructor_name ?? null },
          { label: "대상 학년", value: lecture.grade_level ?? null },
          { label: "난이도", value: lecture.difficulty_level ?? null },
          {
            label: "총 회차",
            value: lecture.total_episodes ? `${lecture.total_episodes}회` : null,
          },
          {
            label: "총 길이",
            value: lecture.duration ? `${Math.round(lecture.duration / 60)}분` : null,
          },
          {
            label: "총 강의시간",
            value: lecture.total_duration ? `${Math.round(lecture.total_duration / 60)}분` : null,
          },
          {
            label: "출처 URL",
            value: lecture.lecture_source_url ?? null,
            isUrl: !!lecture.lecture_source_url,
          },
          { label: "부제목", value: lecture.subtitle ?? null },
          { label: "시리즈명", value: lecture.series_name ?? null },
          { label: "설명", value: lecture.description ?? null },
          { label: "메모", value: lecture.notes ?? null },
        ]}
      />
    </div>
  );
}

