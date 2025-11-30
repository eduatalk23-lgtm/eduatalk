"use client";

import Link from "next/link";
import { useTransition, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateMasterBookAction } from "@/app/(student)/actions/masterContentActions";
import { getSubjectGroupsWithSubjectsAction } from "@/app/(admin)/actions/subjectActions";
import { MasterBook, BookDetail } from "@/lib/types/plan";
import { BookDetailsManager } from "@/app/(student)/contents/_components/BookDetailsManager";
import type { Subject, SubjectGroup } from "@/lib/data/subjects";
import type { Publisher, CurriculumRevision } from "@/lib/data/contentMetadata";

type MasterBookEditFormProps = {
  book: MasterBook;
  details: BookDetail[];
  curriculumRevisions: CurriculumRevision[];
  publishers: Publisher[];
  currentSubject: (Subject & { subjectGroup: SubjectGroup }) | null;
};

export function MasterBookEditForm({
  book,
  details,
  curriculumRevisions,
  publishers,
  currentSubject,
}: MasterBookEditFormProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [selectedRevisionId, setSelectedRevisionId] = useState<string>(
    book.curriculum_revision_id || ""
  );
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    currentSubject?.subjectGroup.id || ""
  );
  const [selectedSubjects, setSelectedSubjects] = useState<Subject[]>([]);
  const [subjectGroups, setSubjectGroups] = useState<(SubjectGroup & { subjects: Subject[] })[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  // 초기 교과 그룹 목록 로드
  useEffect(() => {
    async function loadInitialGroups() {
      if (book.curriculum_revision_id) {
        setLoadingGroups(true);
        try {
          const groups = await getSubjectGroupsWithSubjectsAction(book.curriculum_revision_id);
          setSubjectGroups(groups);
          
          // 현재 과목이 있으면 해당 과목 목록 설정
          if (currentSubject) {
            const group = groups.find(g => g.id === currentSubject.subjectGroup.id);
            setSelectedSubjects(group?.subjects || []);
          }
        } catch (error) {
          console.error("교과 그룹 조회 실패:", error);
          setSubjectGroups([]);
        } finally {
          setLoadingGroups(false);
        }
      }
    }
    loadInitialGroups();
  }, [book.curriculum_revision_id, currentSubject]);

  // 개정교육과정 선택 시 해당 개정교육과정의 교과 그룹 목록 조회
  async function handleCurriculumRevisionChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const revisionName = e.target.value;
    const selectedRevision = curriculumRevisions.find(r => r.name === revisionName);
    
    // 교과 그룹과 과목 선택 초기화 (기존 과목은 유지하지 않음)
    setSelectedGroupId("");
    setSelectedSubjects([]);
    
    if (selectedRevision) {
      setSelectedRevisionId(selectedRevision.id);
      setLoadingGroups(true);
      
      try {
        const groups = await getSubjectGroupsWithSubjectsAction(selectedRevision.id);
        setSubjectGroups(groups);
      } catch (error) {
        console.error("교과 그룹 조회 실패:", error);
        setSubjectGroups([]);
      } finally {
        setLoadingGroups(false);
      }
    } else {
      setSelectedRevisionId("");
      setSubjectGroups([]);
    }
  }

  // 교과 그룹 선택 시 해당 그룹의 과목 목록 업데이트
  function handleSubjectGroupChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const groupId = e.target.value;
    setSelectedGroupId(groupId);
    
    if (groupId) {
      const group = subjectGroups.find(g => g.id === groupId);
      setSelectedSubjects(group?.subjects || []);
    } else {
      setSelectedSubjects([]);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await updateMasterBookAction(book.id, formData);
      } catch (error) {
        console.error("교재 수정 실패:", error);
        alert(
          error instanceof Error ? error.message : "교재 수정에 실패했습니다."
        );
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-6 rounded-lg border bg-white p-6 shadow-sm"
    >
      <div className="grid gap-4 md:grid-cols-2">
        {/* 교재명 */}
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            교재명 <span className="text-red-500">*</span>
          </label>
          <input
            name="title"
            required
            defaultValue={book.title}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* 개정교육과정 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            개정교육과정
          </label>
          <select
            name="revision"
            value={curriculumRevisions.find(r => r.id === selectedRevisionId)?.name || book.revision || ""}
            onChange={handleCurriculumRevisionChange}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">선택하세요</option>
            {curriculumRevisions.map((revision) => (
              <option key={revision.id} value={revision.name}>
                {revision.name}
              </option>
            ))}
          </select>
          {/* curriculum_revision_id를 hidden input으로 전송 */}
          <input type="hidden" name="curriculum_revision_id" value={selectedRevisionId} />
        </div>

        {/* 학년/학기 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            학년/학기
          </label>
          <input
            name="semester"
            defaultValue={book.semester || ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* 교과 그룹 선택 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            교과 그룹
          </label>
          <select
            value={selectedGroupId}
            onChange={handleSubjectGroupChange}
            disabled={!selectedRevisionId || loadingGroups}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="">
              {loadingGroups
                ? "로딩 중..."
                : !selectedRevisionId
                ? "개정교육과정을 먼저 선택하세요"
                : "선택하세요"}
            </option>
            {subjectGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
          {!selectedRevisionId && (
            <p className="mt-1 text-xs text-gray-500">
              개정교육과정을 먼저 선택하세요
            </p>
          )}
        </div>

        {/* 과목 선택 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            과목
          </label>
          <select
            name="subject_id"
            defaultValue={book.subject_id || ""}
            disabled={!selectedGroupId}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
          >
            <option value="">선택하세요</option>
            {selectedSubjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {!selectedRevisionId
              ? "개정교육과정과 교과 그룹을 먼저 선택하세요"
              : !selectedGroupId
              ? "교과 그룹을 먼저 선택하세요"
              : ""}
          </p>
        </div>

        {/* 출판사 선택 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            출판사
          </label>
          <select
            name="publisher_id"
            defaultValue={book.publisher_id || ""}
            onChange={(e) => {
              // publisher_id 변경 시 publisher_name도 자동 설정
              const selectedPublisher = publishers.find(p => p.id === e.target.value);
              const publisherNameInput = document.querySelector('input[name="publisher_name"]') as HTMLInputElement;
              if (publisherNameInput && selectedPublisher) {
                publisherNameInput.value = selectedPublisher.name;
              }
            }}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">선택하세요</option>
            {publishers.map((publisher) => (
              <option key={publisher.id} value={publisher.id}>
                {publisher.name}
              </option>
            ))}
          </select>
        </div>

        {/* 출판사명 (숨김 필드, 자동 설정됨) */}
        <input type="hidden" name="publisher_name" defaultValue={book.publisher_name || ""} />

        {/* 학교 유형 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            학교 유형
          </label>
          <select
            name="school_type"
            defaultValue={book.school_type || ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">선택하세요</option>
            <option value="MIDDLE">중학교</option>
            <option value="HIGH">고등학교</option>
            <option value="OTHER">기타</option>
          </select>
        </div>

        {/* 최소 학년 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            최소 학년
          </label>
          <select
            name="grade_min"
            defaultValue={book.grade_min || ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">선택하세요</option>
            <option value="1">1학년</option>
            <option value="2">2학년</option>
            <option value="3">3학년</option>
          </select>
        </div>

        {/* 최대 학년 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            최대 학년
          </label>
          <select
            name="grade_max"
            defaultValue={book.grade_max || ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">선택하세요</option>
            <option value="1">1학년</option>
            <option value="2">2학년</option>
            <option value="3">3학년</option>
          </select>
        </div>

        {/* 총 페이지 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            총 페이지
          </label>
          <input
            name="total_pages"
            type="number"
            min="1"
            defaultValue={book.total_pages || ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* 난이도 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            난이도
          </label>
          <select
            name="difficulty_level"
            defaultValue={book.difficulty_level || ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">선택하세요</option>
            <option value="개념">개념</option>
            <option value="기본">기본</option>
            <option value="심화">심화</option>
          </select>
        </div>

        {/* 대상 시험 유형 */}
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            대상 시험 유형
          </label>
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="target_exam_type"
                value="수능"
                defaultChecked={book.target_exam_type?.includes("수능")}
                className="rounded border-gray-300"
              />
              <span className="text-sm">수능</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="target_exam_type"
                value="내신"
                defaultChecked={book.target_exam_type?.includes("내신")}
                className="rounded border-gray-300"
              />
              <span className="text-sm">내신</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="target_exam_type"
                value="모의고사"
                defaultChecked={book.target_exam_type?.includes("모의고사")}
                className="rounded border-gray-300"
              />
              <span className="text-sm">모의고사</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="target_exam_type"
                value="특목고입시"
                defaultChecked={book.target_exam_type?.includes("특목고입시")}
                className="rounded border-gray-300"
              />
              <span className="text-sm">특목고입시</span>
            </label>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            해당하는 시험 유형을 모두 선택하세요
          </p>
        </div>

        {/* 태그 */}
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            태그
          </label>
          <input
            name="tags"
            defaultValue={book.tags?.join(", ") || ""}
            placeholder="태그를 쉼표로 구분하여 입력하세요 (예: 기출문제, 실전모의고사, 핵심개념)"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            쉼표(,)로 구분하여 여러 태그를 입력할 수 있습니다
          </p>
        </div>

        {/* 메모 */}
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            메모
          </label>
          <textarea
            name="notes"
            rows={3}
            defaultValue={book.notes || ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* 교재 상세 정보 */}
      <BookDetailsManager initialDetails={details.map(d => ({ ...d, book_id: book.id }))} />

      {/* 버튼 */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {isPending ? "수정 중..." : "변경사항 저장"}
        </button>
        <Link
          href={`/admin/master-books/${book.id}`}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          취소
        </Link>
      </div>
    </form>
  );
}

