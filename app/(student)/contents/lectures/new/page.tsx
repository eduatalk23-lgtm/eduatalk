"use client";

import { useState, useEffect } from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addLecture } from "@/app/(student)/actions/contentActions";
import { LectureEpisodesManager } from "@/app/(student)/contents/_components/LectureEpisodesManager";
import {
  getCurriculumRevisionsAction,
  getGradesAction,
  getSemestersAction,
  getSubjectCategoriesAction,
  getSubjectsAction,
  getPlatformsAction,
} from "@/app/(student)/actions/contentMetadataActions";

export default function NewLecturePage() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [revisions, setRevisions] = useState<Array<{ id: string; name: string }>>([]);
  const [grades, setGrades] = useState<Array<{ id: string; name: string }>>([]);
  const [semesters, setSemesters] = useState<Array<{ id: string; name: string }>>([]);
  const [subjectCategories, setSubjectCategories] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [subjects, setSubjects] = useState<Array<{ id: string; name: string }>>([]);
  const [platforms, setPlatforms] = useState<Array<{ id: string; name: string }>>([]);

  const [selectedRevisionId, setSelectedRevisionId] = useState<string>("");
  const [selectedGradeId, setSelectedGradeId] = useState<string>("");
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>("");
  const [selectedSubjectCategoryId, setSelectedSubjectCategoryId] = useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedPlatformId, setSelectedPlatformId] = useState<string>("");

  useEffect(() => {
    loadMetadata();
  }, []);

  useEffect(() => {
    if (selectedRevisionId) {
      loadSubjectCategories(selectedRevisionId);
    } else {
      setSubjectCategories([]);
      setSubjects([]);
    }
  }, [selectedRevisionId]);

  useEffect(() => {
    if (selectedSubjectCategoryId) {
      loadSubjects(selectedSubjectCategoryId);
    } else {
      setSubjects([]);
    }
  }, [selectedSubjectCategoryId]);

  async function loadMetadata() {
    try {
      const [revs, grds, sems, plats] = await Promise.all([
        getCurriculumRevisionsAction(),
        getGradesAction(),
        getSemestersAction(),
        getPlatformsAction(),
      ]);
      setRevisions(revs.filter((r) => r.is_active));
      setGrades(grds.filter((g) => g.is_active));
      setSemesters(sems.filter((s) => s.is_active));
      setPlatforms(plats.filter((p) => p.is_active));
    } catch (error) {
      console.error("메타데이터 로드 실패:", error);
    }
  }

  async function loadSubjectCategories(revisionId: string) {
    try {
      const categories = await getSubjectCategoriesAction(revisionId);
      setSubjectCategories(categories.filter((c) => c.is_active));
      setSelectedSubjectCategoryId("");
      setSubjects([]);
    } catch (error) {
      console.error("교과 로드 실패:", error);
    }
  }

  async function loadSubjects(subjectCategoryId: string) {
    try {
      const subs = await getSubjectsAction(subjectCategoryId);
      setSubjects(subs.filter((s) => s.is_active));
      setSelectedSubjectId("");
    } catch (error) {
      console.error("과목 로드 실패:", error);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    // 개정교육과정 이름 추가
    if (selectedRevisionId) {
      const revision = revisions.find((r) => r.id === selectedRevisionId);
      if (revision) {
        formData.set("revision", revision.name);
      }
    }

    // 학년-학기 조합
    if (selectedGradeId && selectedSemesterId) {
      const grade = grades.find((g) => g.id === selectedGradeId);
      const semester = semesters.find((s) => s.id === selectedSemesterId);
      if (grade && semester) {
        formData.set("semester", `${grade.name}-${semester.name}`);
      }
    }

    // 교과 이름 추가
    if (selectedSubjectCategoryId) {
      const category = subjectCategories.find((c) => c.id === selectedSubjectCategoryId);
      if (category) {
        formData.set("subject_category", category.name);
      }
    }

    // 과목 이름 추가
    if (selectedSubjectId) {
      const subject = subjects.find((s) => s.id === selectedSubjectId);
      if (subject) {
        formData.set("subject", subject.name);
      }
    }

    // 플랫폼 이름 추가
    if (selectedPlatformId) {
      const platform = platforms.find((p) => p.id === selectedPlatformId);
      if (platform) {
        formData.set("platform", platform.name);
      }
    }

    startTransition(async () => {
      try {
        await addLecture(formData);
        router.push("/contents");
        router.refresh();
      } catch (error) {
        console.error("강의 등록 실패:", error);
        alert(error instanceof Error ? error.message : "강의 등록에 실패했습니다.");
      }
    });
  }

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-gray-900">🎧 강의 등록하기</h1>
        <p className="mt-2 text-sm text-gray-500">새로운 강의를 등록하세요.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6 rounded-lg border bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          {/* 강의명 */}
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              강의명 <span className="text-red-500">*</span>
            </label>
            <input
              name="title"
              required
              placeholder="강의명을 입력하세요"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* 개정교육과정 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              개정교육과정
            </label>
            <select
              value={selectedRevisionId}
              onChange={(e) => {
                setSelectedRevisionId(e.target.value);
                setSelectedSubjectCategoryId("");
                setSelectedSubjectId("");
              }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">선택하세요</option>
              {revisions.map((rev) => (
                <option key={rev.id} value={rev.id}>
                  {rev.name}
                </option>
              ))}
            </select>
          </div>

          {/* 학년 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">학년</label>
            <select
              value={selectedGradeId}
              onChange={(e) => setSelectedGradeId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">선택하세요</option>
              {grades.map((grade) => (
                <option key={grade.id} value={grade.id}>
                  {grade.name}
                </option>
              ))}
            </select>
          </div>

          {/* 학기 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">학기</label>
            <select
              value={selectedSemesterId}
              onChange={(e) => setSelectedSemesterId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">선택하세요</option>
              {semesters.map((semester) => (
                <option key={semester.id} value={semester.id}>
                  {semester.name}
                </option>
              ))}
            </select>
          </div>

          {/* 교과 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">교과</label>
            <select
              value={selectedSubjectCategoryId}
              onChange={(e) => {
                setSelectedSubjectCategoryId(e.target.value);
                setSelectedSubjectId("");
              }}
              disabled={!selectedRevisionId}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">
                {selectedRevisionId ? "선택하세요" : "개정교육과정을 먼저 선택하세요"}
              </option>
              {subjectCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* 과목 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">과목</label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              disabled={!selectedSubjectCategoryId}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">
                {selectedSubjectCategoryId ? "선택하세요" : "교과를 먼저 선택하세요"}
              </option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>

          {/* 플랫폼 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">플랫폼</label>
            <select
              value={selectedPlatformId}
              onChange={(e) => setSelectedPlatformId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">선택하세요</option>
              {platforms.map((platform) => (
                <option key={platform.id} value={platform.id}>
                  {platform.name}
                </option>
              ))}
            </select>
          </div>

          {/* 총 회차 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              총 회차 <span className="text-red-500">*</span>
            </label>
            <input
              name="total_episodes"
              type="number"
              required
              min="1"
              placeholder="예: 30"
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
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">선택하세요</option>
              <option value="개념">개념</option>
              <option value="기본">기본</option>
              <option value="심화">심화</option>
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
              placeholder="메모를 입력하세요"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* 강의 회차 정보 */}
        <LectureEpisodesManager />

        {/* 버튼 */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {isPending ? "등록 중..." : "등록하기"}
          </button>
          <Link
            href="/contents"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            취소
          </Link>
        </div>
      </form>
    </section>
  );
}
