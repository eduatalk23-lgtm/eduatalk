"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { FamilyWithMembers } from "@/lib/domains/family";
import {
  deleteFamilyGroup,
  removeStudentFromFamily,
  removeParentFromFamily,
} from "@/lib/domains/family";
import { useToast } from "@/components/ui/ToastProvider";

type Props = {
  family: FamilyWithMembers;
};

export function FamilyDetailClient({ family }: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeleteFamily = () => {
    startTransition(async () => {
      const result = await deleteFamilyGroup(family.id);
      if (result.success) {
        showToast("가족이 삭제되었습니다.", "success");
        router.push("/admin/families");
      } else {
        showToast(result.error || "삭제에 실패했습니다.", "error");
      }
    });
  };

  const handleRemoveStudent = (studentId: string, studentName: string | null) => {
    if (!confirm(`${studentName || "학생"}을(를) 가족에서 제거하시겠습니까?`)) return;

    startTransition(async () => {
      const result = await removeStudentFromFamily(studentId);
      if (result.success) {
        showToast("학생을 가족에서 제거했습니다.", "success");
        router.refresh();
      } else {
        showToast(result.error || "제거에 실패했습니다.", "error");
      }
    });
  };

  const handleRemoveParent = (parentId: string, parentName: string | null) => {
    if (!confirm(`${parentName || "학부모"}을(를) 가족에서 제거하시겠습니까?`)) return;

    startTransition(async () => {
      const result = await removeParentFromFamily(parentId, family.id);
      if (result.success) {
        showToast("학부모를 가족에서 제거했습니다.", "success");
        router.refresh();
      } else {
        showToast(result.error || "제거에 실패했습니다.", "error");
      }
    });
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Students Section */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            <svg
              className="h-5 w-5 text-green-600 dark:text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            학생 ({family.students.length})
          </h2>
          <button
            className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
            onClick={() => {
              // TODO: 학생 추가 모달
              showToast("학생 추가 기능은 추후 구현 예정입니다.", "info");
            }}
          >
            + 학생 추가
          </button>
        </div>

        {family.students.length > 0 ? (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {family.students.map((student) => (
              <li key={student.id} className="flex items-center justify-between py-3">
                <Link
                  href={`/admin/students/${student.id}`}
                  className="flex flex-col hover:text-blue-600 dark:hover:text-blue-400"
                >
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {student.name || "이름 없음"}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {[student.grade, student.school].filter(Boolean).join(" · ") || "정보 없음"}
                  </span>
                </Link>
                <button
                  onClick={() => handleRemoveStudent(student.id, student.name)}
                  disabled={isPending}
                  className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                  title="가족에서 제거"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            등록된 학생이 없습니다
          </p>
        )}
      </div>

      {/* Parents Section */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            <svg
              className="h-5 w-5 text-purple-600 dark:text-purple-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m3 5.197V21"
              />
            </svg>
            학부모 ({family.parents.length})
          </h2>
          <button
            className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
            onClick={() => {
              // TODO: 학부모 추가 모달
              showToast("학부모 추가 기능은 추후 구현 예정입니다.", "info");
            }}
          >
            + 학부모 추가
          </button>
        </div>

        {family.parents.length > 0 ? (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {family.parents.map((parent) => (
              <li key={parent.id} className="flex items-center justify-between py-3">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {parent.name || "이름 없음"}
                    </span>
                    {parent.role === "primary" && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        주 보호자
                      </span>
                    )}
                    {parent.role === "guardian" && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        후견인
                      </span>
                    )}
                  </div>
                  {parent.email && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">{parent.email}</span>
                  )}
                </div>
                <button
                  onClick={() => handleRemoveParent(parent.id, parent.name)}
                  disabled={isPending}
                  className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                  title="가족에서 제거"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            등록된 학부모가 없습니다
          </p>
        )}
      </div>

      {/* Info & Actions Section */}
      <div className="lg:col-span-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">가족 정보</h2>

          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-gray-500 dark:text-gray-400">생성일</dt>
              <dd className="mt-1 text-gray-900 dark:text-gray-100">
                {new Date(family.createdAt).toLocaleDateString("ko-KR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500 dark:text-gray-400">수정일</dt>
              <dd className="mt-1 text-gray-900 dark:text-gray-100">
                {new Date(family.updatedAt).toLocaleDateString("ko-KR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </dd>
            </div>
            {family.notes && (
              <div className="sm:col-span-2">
                <dt className="text-sm text-gray-500 dark:text-gray-400">메모</dt>
                <dd className="mt-1 whitespace-pre-wrap text-gray-900 dark:text-gray-100">
                  {family.notes}
                </dd>
              </div>
            )}
          </dl>

          {/* Danger Zone */}
          <div className="mt-8 border-t border-gray-200 pt-6 dark:border-gray-700">
            <h3 className="mb-4 text-sm font-medium text-red-600 dark:text-red-400">위험 영역</h3>

            {showDeleteConfirm ? (
              <div className="flex items-center gap-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-900/20">
                <p className="flex-1 text-sm text-red-700 dark:text-red-300">
                  정말로 이 가족을 삭제하시겠습니까? 학생과 학부모의 가족 연결이 해제됩니다.
                </p>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isPending}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  취소
                </button>
                <button
                  onClick={handleDeleteFamily}
                  disabled={isPending}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {isPending ? "삭제 중..." : "삭제"}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                가족 삭제
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
