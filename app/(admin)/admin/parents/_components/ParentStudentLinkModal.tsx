"use client";

import { useState, useTransition } from "react";
import { Search, Loader2 } from "lucide-react";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/ToastProvider";
import { Dialog, DialogFooter } from "@/components/ui/Dialog";
import Button from "@/components/atoms/Button";
import { studentSearchQueryOptions } from "@/lib/query-options/students";
import { createParentStudentLink } from "@/lib/domains/student/actions/parentLinks";
import { PARENT_RELATION_OPTIONS } from "@/lib/constants/parents";
import type { ParentRelation } from "@/lib/domains/parent/types";

type ParentStudentLinkModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentId: string;
  onLinkCreated: () => void;
};

export function ParentStudentLinkModal({
  open,
  onOpenChange,
  parentId,
  onLinkCreated,
}: ParentStudentLinkModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [relation, setRelation] = useState<ParentRelation>("mother");
  const [isPending, startTransition] = useTransition();
  const { showSuccess, showError } = useToast();

  const debouncedQuery = useDebounce(searchQuery, 300);

  const searchResult = useQuery({
    ...studentSearchQueryOptions(debouncedQuery),
    enabled: open && debouncedQuery.length >= 1,
  });

  const students = searchResult.data?.students ?? [];

  const handleLink = () => {
    if (!selectedStudentId) return;
    startTransition(async () => {
      const result = await createParentStudentLink(selectedStudentId, parentId, relation);
      if (result.success) {
        showSuccess("학생이 연결되었습니다.");
        resetForm();
        onLinkCreated();
      } else {
        showError(result.error ?? "연결에 실패했습니다.");
      }
    });
  };

  const resetForm = () => {
    setSearchQuery("");
    setSelectedStudentId(null);
    setRelation("mother");
  };

  const handleOpen = (newOpen: boolean) => {
    if (!newOpen) resetForm();
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen} title="학생 연결" maxWidth="md">
      <div className="flex flex-col gap-4 p-6">
        {/* 학생 검색 */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">학생 검색</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="이름 또는 연락처"
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          {/* 검색 결과 */}
          {searchQuery && (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200">
              {searchResult.isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                </div>
              ) : students.length === 0 ? (
                <div className="py-4 text-center text-xs text-gray-400">
                  검색 결과가 없습니다
                </div>
              ) : (
                students.map((student) => (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => setSelectedStudentId(student.id)}
                    className={cn(
                      "w-full px-3 py-2 text-left text-sm transition",
                      selectedStudentId === student.id
                        ? "bg-indigo-50 text-indigo-700"
                        : "hover:bg-gray-50"
                    )}
                  >
                    <span className="font-medium">{student.name ?? "이름 없음"}</span>
                    <span className="ml-2 text-xs text-gray-500">
                      {student.grade != null && `${student.grade}학년`}
                      {student.class && ` ${student.class}반`}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}

          {selectedStudentId && (
            <p className="text-xs text-indigo-600">
              선택됨: {students.find((s) => s.id === selectedStudentId)?.name ?? selectedStudentId}
            </p>
          )}
        </div>

        {/* 관계 선택 */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">관계</label>
          <select
            value={relation}
            onChange={(e) => setRelation(e.target.value as ParentRelation)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          >
            {PARENT_RELATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => handleOpen(false)}
          disabled={isPending}
        >
          취소
        </Button>
        <Button
          variant="primary"
          onClick={handleLink}
          disabled={isPending || !selectedStudentId}
          isLoading={isPending}
        >
          {isPending ? "연결 중..." : "연결"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
