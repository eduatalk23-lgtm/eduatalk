"use client";

import { useState, useEffect } from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addBook } from "@/app/(student)/actions/contentActions";
import { BookDetailsManager } from "@/app/(student)/contents/_components/BookDetailsManager";
import {
  getCurriculumRevisionsAction,
  getPublishersAction,
} from "@/app/(student)/actions/contentMetadataActions";
import { getSubjectGroupsAction, getSubjectsByGroupAction } from "@/app/(student)/actions/contentMetadataActions";
import type { SubjectGroup, Subject } from "@/lib/data/subjects";

export default function NewBookPage() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [revisions, setRevisions] = useState<Array<{ id: string; name: string }>>([]);
  const [subjectGroups, setSubjectGroups] = useState<SubjectGroup[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [publishers, setPublishers] = useState<Array<{ id: string; name: string }>>([]);

  const [selectedRevisionId, setSelectedRevisionId] = useState<string>("");
  const [selectedSubjectGroupId, setSelectedSubjectGroupId] = useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedPublisherId, setSelectedPublisherId] = useState<string>("");

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
      const [revs, pubs] = await Promise.all([
        getCurriculumRevisionsAction(),
        getPublishersAction(),
      ]);
      setRevisions(revs.filter((r) => r.is_active));
      setPublishers(pubs.filter((p) => p.is_active));
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

    // 출판사 이름 추가
    if (selectedPublisherId) {
      const publisher = publishers.find((p) => p.id === selectedPublisherId);
      if (publisher) {
        formData.set("publisher", publisher.name);
      }
    }

    startTransition(async () => {
      try {
        await addBook(formData);
        router.push("/contents");
        router.refresh();
      } catch (error) {
        console.error("책 등록 실패:", error);
        alert(error instanceof Error ? error.message : "책 등록에 실패했습니다.");
      }
    });
  }

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-gray-900">📚 책 등록하기</h1>
        <p className="text-sm text-gray-500">새로운 교재를 등록하세요.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6 rounded-lg border bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          {/* 교재명 */}
          <div className="flex flex-col gap-1 md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">
              교재명 <span className="text-red-500">*</span>
            </label>
            <input
              name="title"
              required
              placeholder="교재명을 입력하세요"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

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

          {/* 출판사 */}
          <div className="flex flex-col gap-1">
            <label className="block text-sm font-medium text-gray-700">출판사</label>
            <select
              value={selectedPublisherId}
              onChange={(e) => setSelectedPublisherId(e.target.value)}
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

          {/* 총 페이지 */}
          <div className="flex flex-col gap-1">
            <label className="block text-sm font-medium text-gray-700">
              총 페이지 <span className="text-red-500">*</span>
            </label>
            <input
              name="total_pages"
              type="number"
              required
              min="1"
              placeholder="예: 255"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* 난이도 */}
          <div className="flex flex-col gap-1">
            <label className="block text-sm font-medium text-gray-700">
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
          <div className="flex flex-col gap-1 md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">
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

        {/* 교재 상세 정보 */}
        <BookDetailsManager />

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
