"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { SiblingCandidate, FamilyStudent } from "@/lib/domains/family";
import {
  createFamilyGroup,
  addStudentToFamily,
  removeStudentFromFamily,
  searchStudentsForSibling,
} from "@/lib/domains/family";
import { useToast } from "@/components/ui/ToastProvider";

type Props = {
  studentId: string;
  familyId: string | null;
  candidates: SiblingCandidate[];
  siblings: FamilyStudent[];
};

export function FamilySectionClient({
  studentId,
  familyId,
  candidates,
  siblings,
}: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(
    new Set()
  );

  // 검색 관련 상태
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FamilyStudent[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const toggleCandidate = (candidateId: string) => {
    setSelectedCandidates((prev) => {
      const next = new Set(prev);
      if (next.has(candidateId)) {
        next.delete(candidateId);
      } else {
        next.add(candidateId);
      }
      return next;
    });
  };

  // 학생 검색
  const handleSearch = async (query: string) => {
    setSearchQuery(query);

    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const result = await searchStudentsForSibling(query, studentId);
      if (result.success && result.data) {
        // 이미 형제자매인 학생과 후보 목록에 있는 학생 제외
        const siblingIds = new Set(siblings.map((s) => s.id));
        const candidateIds = new Set(candidates.map((c) => c.studentId));
        const filtered = result.data.filter(
          (s) => !siblingIds.has(s.id) && !candidateIds.has(s.id)
        );
        setSearchResults(filtered);
      }
    } catch {
      showToast("검색 중 오류가 발생했습니다.", "error");
    } finally {
      setIsSearching(false);
    }
  };

  // 가족 생성 (새 가족)
  const handleCreateFamily = () => {
    startTransition(async () => {
      const studentIds = [studentId, ...Array.from(selectedCandidates)];

      const result = await createFamilyGroup({
        studentIds,
      });

      if (result.success && result.data) {
        showToast("가족이 생성되었습니다.", "success");
        router.refresh();
      } else {
        showToast(result.error || "가족 생성에 실패했습니다.", "error");
      }
    });
  };

  // 형제자매 연결 제거
  const handleRemoveSibling = (siblingStudentId: string, siblingName: string | null) => {
    if (!confirm(`${siblingName || "이 학생"}을(를) 형제자매에서 제거하시겠습니까?`)) {
      return;
    }

    startTransition(async () => {
      const result = await removeStudentFromFamily(siblingStudentId);

      if (result.success) {
        showToast("형제자매 연결이 제거되었습니다.", "success");
        router.refresh();
      } else {
        showToast(result.error || "제거에 실패했습니다.", "error");
      }
    });
  };

  // 형제자매 추가 (기존 가족에)
  const handleAddSibling = (siblingStudentId: string) => {
    if (!familyId) {
      // 가족이 없으면 새로 생성
      startTransition(async () => {
        const result = await createFamilyGroup({
          studentIds: [studentId, siblingStudentId],
        });

        if (result.success) {
          showToast("가족이 생성되고 형제자매가 추가되었습니다.", "success");
          setSearchQuery("");
          setSearchResults([]);
          router.refresh();
        } else {
          showToast(result.error || "추가에 실패했습니다.", "error");
        }
      });
    } else {
      // 기존 가족에 추가
      startTransition(async () => {
        const result = await addStudentToFamily(siblingStudentId, familyId);

        if (result.success) {
          showToast("형제자매가 추가되었습니다.", "success");
          setSearchQuery("");
          setSearchResults([]);
          router.refresh();
        } else {
          showToast(result.error || "추가에 실패했습니다.", "error");
        }
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* 기존 형제자매 목록 */}
      {siblings.length > 0 && (
        <ul className="space-y-2">
          {siblings.map((sibling) => (
            <li key={sibling.id} className="flex items-center gap-2">
              <Link
                href={`/admin/students/${sibling.id}`}
                className="flex flex-1 items-center justify-between rounded-lg border border-gray-200 p-3 transition hover:border-blue-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:border-blue-700 dark:hover:bg-gray-800"
              >
                <div>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {sibling.name || "이름 없음"}
                  </span>
                  <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                    {[sibling.grade, sibling.school].filter(Boolean).join(" · ")}
                  </span>
                </div>
                <svg
                  className="h-4 w-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
              <button
                type="button"
                onClick={() => handleRemoveSibling(sibling.id, sibling.name)}
                disabled={isPending}
                className="rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                title="형제자매 연결 제거"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
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
      )}

      {/* 자동 감지된 후보 */}
      {candidates.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-900/20">
          <div className="mb-3 flex items-start gap-2">
            <svg
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                형제자매 후보가 감지되었습니다
              </p>
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                같은 부모에 연결된 학생이 있습니다.
              </p>
            </div>
          </div>

          <ul className="mb-4 space-y-2">
            {candidates.map((candidate) => (
              <li key={candidate.studentId}>
                <button
                  type="button"
                  onClick={() => toggleCandidate(candidate.studentId)}
                  className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition ${
                    selectedCandidates.has(candidate.studentId)
                      ? "border-blue-500 bg-blue-50 dark:border-blue-600 dark:bg-blue-900/30"
                      : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded border ${
                        selectedCandidates.has(candidate.studentId)
                          ? "border-blue-500 bg-blue-500"
                          : "border-gray-300 dark:border-gray-600"
                      }`}
                    >
                      {selectedCandidates.has(candidate.studentId) && (
                        <svg
                          className="h-3 w-3 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                    <div>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {candidate.studentName || "이름 없음"}
                      </span>
                      {candidate.grade && (
                        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                          {candidate.grade}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    {candidate.confidence}% 일치
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <button
            onClick={handleCreateFamily}
            disabled={isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending
              ? "생성 중..."
              : selectedCandidates.size > 0
              ? `${selectedCandidates.size + 1}명으로 가족 생성`
              : "혼자 가족 생성"}
          </button>
        </div>
      )}

      {/* 형제자매 검색 및 추가 */}
      {!showSearch && siblings.length === 0 && candidates.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          형제/자매가 없습니다.
        </p>
      )}

      <div className="pt-2">
        {!showSearch ? (
          <button
            type="button"
            onClick={() => setShowSearch(true)}
            className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            형제/자매 추가
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="학생 이름으로 검색..."
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
                {isSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowSearch(false);
                  setSearchQuery("");
                  setSearchResults([]);
                }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                취소
              </button>
            </div>

            {/* 검색 결과 */}
            {searchResults.length > 0 && (
              <ul className="space-y-2">
                {searchResults.map((student) => (
                  <li key={student.id}>
                    <button
                      type="button"
                      onClick={() => handleAddSibling(student.id)}
                      disabled={isPending}
                      className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white p-3 text-left transition hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-600 dark:hover:bg-blue-900/20"
                    >
                      <div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {student.name || "이름 없음"}
                        </span>
                        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                          {[student.grade, student.school]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </div>
                      <span className="text-sm text-blue-600 dark:text-blue-400">
                        {isPending ? "추가 중..." : "추가"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {searchQuery.length >= 2 &&
              !isSearching &&
              searchResults.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  검색 결과가 없습니다.
                </p>
              )}
          </div>
        )}
      </div>
    </div>
  );
}
