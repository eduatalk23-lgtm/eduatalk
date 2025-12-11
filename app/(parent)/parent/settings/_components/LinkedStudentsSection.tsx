"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StudentSearchModal } from "./StudentSearchModal";
import { LinkRequestList } from "./LinkRequestList";
import { getLinkRequests, type LinkRequest } from "@/app/(parent)/actions/parentStudentLinkRequestActions";
import type { LinkedStudent } from "../../../_utils";

type LinkedStudentsSectionProps = {
  linkedStudents: LinkedStudent[];
  parentId: string;
  initialLinkRequests?: LinkRequest[];
};

export function LinkedStudentsSection({
  linkedStudents,
  parentId,
  initialLinkRequests = [],
}: LinkedStudentsSectionProps) {
  const router = useRouter();
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [linkRequests, setLinkRequests] = useState<LinkRequest[]>(initialLinkRequests);
  const [isPending, startTransition] = useTransition();

  function handleRefresh() {
    startTransition(async () => {
      const result = await getLinkRequests(parentId);
      if (result.success && result.data) {
        setLinkRequests(result.data);
      }
      router.refresh();
    });
  }

  return (
    <>
      {/* 연결된 자녀 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">연결된 자녀</h2>
          <button
            onClick={() => setIsSearchModalOpen(true)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            학생 연결 요청
          </button>
        </div>
        {linkedStudents.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
            <p className="text-sm text-gray-500">
              연결된 자녀가 없습니다. 아래 버튼을 눌러 연결을 요청해주세요.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {linkedStudents.map((student) => (
              <div
                key={student.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4"
              >
                <div>
                  <div className="text-base font-semibold text-gray-900">
                    {student.name || "이름 없음"}
                  </div>
                  {student.grade && (
                    <div className="text-sm text-gray-500">
                      {student.grade}학년 {student.class}반
                    </div>
                  )}
                  <div className="mt-1 text-xs text-gray-400">
                    관계:{" "}
                    {student.relation === "mother"
                      ? "어머니"
                      : student.relation === "father"
                      ? "아버지"
                      : "보호자"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 연결 요청 목록 */}
      <LinkRequestList
        requests={linkRequests}
        parentId={parentId}
        onCancel={handleRefresh}
      />

      {/* 학생 검색 모달 */}
      <StudentSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        parentId={parentId}
        onSuccess={handleRefresh}
      />
    </>
  );
}

