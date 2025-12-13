"use client";

import { useState, useEffect, useTransition } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import {
  getStudentParents,
  type StudentParent,
} from "@/app/(admin)/actions/parentStudentLinkActions";
import { ParentCard } from "./ParentCard";
import { ParentSearchModal } from "./ParentSearchModal";

type ParentLinksSectionProps = {
  studentId: string;
};

export function ParentLinksSection({ studentId }: ParentLinksSectionProps) {
  const { showError } = useToast();
  const [parents, setParents] = useState<StudentParent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // 데이터 로드
  useEffect(() => {
    async function loadParents() {
      setIsLoading(true);
      const result = await getStudentParents(studentId);

      if (result.success && result.data) {
        setParents(result.data);
      } else {
        if (result.error) {
          showError(result.error);
        }
        setParents([]);
      }
      setIsLoading(false);
    }

    loadParents();
  }, [studentId, showError]);

  // 연결 생성/삭제/수정 후 새로고침
  function handleRefresh() {
    startTransition(async () => {
      const result = await getStudentParents(studentId);

      if (result.success && result.data) {
        setParents(result.data);
      } else {
        if (result.error) {
          showError(result.error);
        }
      }
    });
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="h-7 w-32 animate-pulse rounded bg-gray-200" />
            <div className="h-9 w-24 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="text-center text-sm text-gray-500">로딩 중...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">연결된 학부모</h2>
            <button
              onClick={() => setIsSearchModalOpen(true)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
            >
              학부모 추가
            </button>
          </div>

          {parents.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              연결된 학부모가 없습니다.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {parents.map((parent) => (
                <ParentCard
                  key={parent.linkId}
                  parent={parent}
                  onRefresh={handleRefresh}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <ParentSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        studentId={studentId}
        existingParents={parents}
        onSuccess={handleRefresh}
      />
    </>
  );
}

