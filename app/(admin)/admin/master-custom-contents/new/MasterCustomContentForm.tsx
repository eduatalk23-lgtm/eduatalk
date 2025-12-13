"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { addMasterCustomContent } from "@/app/(admin)/actions/masterCustomContentActions";
import { getSubjectGroupsWithSubjectsAction } from "@/app/(admin)/actions/subjectActions";
import type { Subject, SubjectGroup } from "@/lib/data/subjects";
import type { CurriculumRevision } from "@/lib/data/contentMetadata";

type MasterCustomContentFormProps = {
  curriculumRevisions: CurriculumRevision[];
};

export function MasterCustomContentForm({ curriculumRevisions }: MasterCustomContentFormProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [selectedRevisionId, setSelectedRevisionId] = useState<string>("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedSubjects, setSelectedSubjects] = useState<Subject[]>([]);
  const [subjectGroups, setSubjectGroups] = useState<(SubjectGroup & { subjects: Subject[] })[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  // 개정교육과정 선택 시 해당 개정교육과정의 교과 그룹 목록 조회
  async function handleCurriculumRevisionChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const revisionName = e.target.value;
    const selectedRevision = curriculumRevisions.find(r => r.name === revisionName);
    
    // 교과 그룹과 과목 선택 초기화
    setSelectedGroupId("");
    setSelectedSubjectId("");
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
    setSelectedSubjectId(""); // 과목 선택 초기화
    
    if (groupId) {
      const group = subjectGroups.find(g => g.id === groupId);
      setSelectedSubjects(group?.subjects || []);
    } else {
      setSelectedSubjects([]);
    }
  }

  // 과목 선택 시 처리
  function handleSubjectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const subjectName = e.target.value;
    const selectedSubject = selectedSubjects.find(s => s.name === subjectName);
    setSelectedSubjectId(selectedSubject?.id || "");
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    // 교과 그룹 정보 추가 (denormalize)
    if (selectedGroupId) {
      const selectedGroup = subjectGroups.find(g => g.id === selectedGroupId);
      if (selectedGroup) {
        formData.set("subject_group_id", selectedGroup.id);
        formData.set("subject_category", selectedGroup.name);
      }
    }

    // 과목 정보 추가 (denormalize)
    if (selectedSubjectId) {
      const selectedSubject = selectedSubjects.find(s => s.id === selectedSubjectId);
      if (selectedSubject) {
        formData.set("subject", selectedSubject.name);
      }
    }

    startTransition(async () => {
      try {
        await addMasterCustomContent(formData);
      } catch (error) {
        console.error("커스텀 콘텐츠 등록 실패:", error);
        alert(
          error instanceof Error ? error.message : "커스텀 콘텐츠 등록에 실패했습니다."
        );
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 rounded-lg border bg-white p-6 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2">
        {/* 제목 */}
        <div className="flex flex-col gap-1 md:col-span-2">
          <label className="block text-sm font-medium text-gray-700">
            제목 <span className="text-red-500">*</span>
          </label>
          <input
            name="title"
            required
            placeholder="커스텀 콘텐츠 제목을 입력하세요"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* 콘텐츠 유형 */}
        <div className="flex flex-col gap-1">
          <label className="block text-sm font-medium text-gray-700">
            콘텐츠 유형
          </label>
          <select
            name="content_type"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">선택하세요</option>
            <option value="book">책</option>
            <option value="lecture">강의</option>
            <option value="worksheet">문제집</option>
            <option value="other">기타</option>
          </select>
        </div>

        {/* 총 페이지/시간 */}
        <div className="flex flex-col gap-1">
          <label className="block text-sm font-medium text-gray-700">
            총 페이지/시간
          </label>
          <input
            type="number"
            name="total_page_or_time"
            placeholder="페이지 수 또는 시간(분)"
            min="0"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* 개정교육과정 */}
        <div className="flex flex-col gap-1">
          <label className="block text-sm font-medium text-gray-700">
            개정교육과정
          </label>
          <select
            name="revision"
            value={curriculumRevisions.find(r => r.id === selectedRevisionId)?.name || ""}
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

        {/* 교과 그룹 선택 */}
        <div className="flex flex-col gap-1">
          <label className="block text-sm font-medium text-gray-700">
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
        </div>

        {/* 과목 선택 */}
        <div className="flex flex-col gap-1">
          <label className="block text-sm font-medium text-gray-700">
            과목
          </label>
          <select
            value={selectedSubjects.find(s => s.id === selectedSubjectId)?.name || ""}
            onChange={handleSubjectChange}
            disabled={!selectedGroupId}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
          >
            <option value="">선택하세요</option>
            {selectedSubjects.map((subject) => (
              <option key={subject.id} value={subject.name}>
                {subject.name}
              </option>
            ))}
          </select>
          {/* subject_id를 hidden input으로 전송 */}
          <input type="hidden" name="subject_id" value={selectedSubjectId} />
        </div>

        {/* 난이도 */}
        <div className="flex flex-col gap-1">
          <label className="block text-sm font-medium text-gray-700">
            난이도
          </label>
          <select
            name="difficulty_level"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">선택하세요</option>
            <option value="상">상</option>
            <option value="중">중</option>
            <option value="하">하</option>
          </select>
        </div>

        {/* 콘텐츠 카테고리 */}
        <div className="flex flex-col gap-1">
          <label className="block text-sm font-medium text-gray-700">
            콘텐츠 카테고리
          </label>
          <input
            name="content_category"
            placeholder="예: 개념서, 문제집 등"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* 메모 */}
        <div className="flex flex-col gap-1 md:col-span-2">
          <label className="block text-sm font-medium text-gray-700">
            메모
          </label>
          <textarea
            name="notes"
            rows={3}
            placeholder="추가 정보나 메모를 입력하세요"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* 제출 버튼 */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400"
        >
          {isPending ? "등록 중..." : "등록하기"}
        </button>
      </div>
    </form>
  );
}

