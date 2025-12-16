"use client";

import { useState, useEffect } from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addLecture } from "@/app/(student)/actions/contentActions";
import { LectureEpisodesManager } from "@/app/(student)/contents/_components/LectureEpisodesManager";
import {
  getCurriculumRevisionsAction,
  getPlatformsAction,
} from "@/app/(student)/actions/contentMetadataActions";
import { getSubjectGroupsAction, getSubjectsByGroupAction } from "@/app/(student)/actions/contentMetadataActions";
import type { SubjectGroup, Subject } from "@/lib/data/subjects";
import FormField, { FormSelect } from "@/components/molecules/FormField";
import { useToast } from "@/components/ui/ToastProvider";
import { ContentFormLayout } from "@/app/(student)/contents/_components/ContentFormLayout";
import { ContentFormActions } from "@/app/(student)/contents/_components/ContentFormActions";

export default function NewLecturePage() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showError, showSuccess } = useToast();

  const [revisions, setRevisions] = useState<Array<{ id: string; name: string }>>([]);
  const [subjectGroups, setSubjectGroups] = useState<SubjectGroup[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [platforms, setPlatforms] = useState<Array<{ id: string; name: string }>>([]);

  const [selectedRevisionId, setSelectedRevisionId] = useState<string>("");
  const [selectedSubjectGroupId, setSelectedSubjectGroupId] = useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedPlatformId, setSelectedPlatformId] = useState<string>("");

  useEffect(() => {
    loadMetadata();
  }, []);

  useEffect(() => {
    if (selectedRevisionId) {
      loadSubjectGroups(selectedRevisionId);
    } else {
      setSubjectGroups([]);
      setSubjects([]);
    }
  }, [selectedRevisionId]);

  useEffect(() => {
    if (selectedSubjectGroupId) {
      loadSubjects(selectedSubjectGroupId);
    } else {
      setSubjects([]);
    }
  }, [selectedSubjectGroupId]);

  async function loadMetadata() {
    try {
      const [revs, plats] = await Promise.all([
        getCurriculumRevisionsAction(),
        getPlatformsAction(),
      ]);
      setRevisions(revs.filter((r) => r.is_active));
      setPlatforms(plats.filter((p) => p.is_active));
    } catch (error) {
      console.error("메타데이터 로드 실패:", error);
    }
  }

  async function loadSubjectGroups(revisionId: string) {
    try {
      const groups = await getSubjectGroupsAction(revisionId);
      setSubjectGroups(groups);
      setSelectedSubjectGroupId("");
      setSubjects([]);
    } catch (error) {
      console.error("교과 그룹 로드 실패:", error);
    }
  }

  async function loadSubjects(subjectGroupId: string) {
    try {
      const subs = await getSubjectsByGroupAction(subjectGroupId);
      setSubjects(subs);
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

    // 교과 이름 추가
    if (selectedSubjectGroupId) {
      const group = subjectGroups.find((g) => g.id === selectedSubjectGroupId);
      if (group) {
        formData.set("subject_category", group.name);
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
        showSuccess("강의가 성공적으로 등록되었습니다.");
        router.push("/contents");
        router.refresh();
      } catch (error) {
        console.error("강의 등록 실패:", error);
        showError(error instanceof Error ? error.message : "강의 등록에 실패했습니다.");
      }
    });
  }

  return (
    <ContentFormLayout
      title="🎧 강의 등록하기"
      description="새로운 강의를 등록하세요."
    >

      <form onSubmit={handleSubmit} className="flex flex-col gap-6 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 md:p-8 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          {/* 강의명 */}
          <FormField
            name="title"
            label="강의명"
            required
            placeholder="강의명을 입력하세요"
            className="md:col-span-2"
          />

          {/* 개정교육과정 */}
          <div className="flex flex-col gap-1">
            <label className="block text-sm font-medium text-gray-700">
              개정교육과정
            </label>
            <select
              value={selectedRevisionId}
              onChange={(e) => {
                setSelectedRevisionId(e.target.value);
                setSelectedSubjectGroupId("");
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

          {/* 교과 */}
          <div className="flex flex-col gap-1">
            <label className="block text-sm font-medium text-gray-700">교과</label>
            <select
              value={selectedSubjectGroupId}
              onChange={(e) => {
                setSelectedSubjectGroupId(e.target.value);
                setSelectedSubjectId("");
              }}
              disabled={!selectedRevisionId}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">
                {selectedRevisionId ? "선택하세요" : "개정교육과정을 먼저 선택하세요"}
              </option>
              {subjectGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>

          {/* 과목 */}
          <div className="flex flex-col gap-1">
            <label className="block text-sm font-medium text-gray-700">과목</label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              disabled={!selectedSubjectGroupId}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">
                {selectedSubjectGroupId ? "선택하세요" : "교과를 먼저 선택하세요"}
              </option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>

          {/* 플랫폼 */}
          <div className="flex flex-col gap-1">
            <label className="block text-sm font-medium text-gray-700">플랫폼</label>
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
          <FormField
            name="total_episodes"
            label="총 회차"
            type="number"
            required
            min={1}
            placeholder="예: 30"
          />

          {/* 총 강의시간 */}
          <FormField
            name="duration"
            label="총 강의시간 (분)"
            type="number"
            min={0}
            placeholder="예: 300"
          />

          {/* 난이도 */}
          <FormSelect
            name="difficulty"
            label="난이도"
            placeholder="선택하세요"
            options={[
              { value: "개념", label: "개념" },
              { value: "기본", label: "기본" },
              { value: "심화", label: "심화" },
            ]}
          />

          {/* 메모 */}
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              메모
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="메모를 입력하세요"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 px-3 py-2 text-sm focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-gray-900/20 dark:focus:ring-gray-100/20 transition-colors"
            />
          </div>
        </div>

        {/* 강의 회차 정보 */}
        <LectureEpisodesManager />

        {/* 버튼 */}
        <ContentFormActions
          submitLabel="등록하기"
          cancelHref="/contents"
          isPending={isPending}
        />
      </form>
    </ContentFormLayout>
  );
}
