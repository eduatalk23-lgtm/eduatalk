"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/lib/hooks/useDebounce";
import {
  parentSearchQueryOptions,
  parentDetailQueryOptions,
} from "@/lib/query-options/parents";
import { ParentSearchPanel } from "./ParentSearchPanel";
import { ParentFormPanel } from "./ParentFormPanel";

type FormMode = "info" | "selected";

type ParentManageClientProps = {
  isAdmin: boolean;
};

export function ParentManageClient({ isAdmin }: ParentManageClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>("info");

  const debouncedQuery = useDebounce(searchQuery, 300);

  // 검색 쿼리
  const searchResult = useQuery(parentSearchQueryOptions(debouncedQuery));

  // 상세 조회 쿼리
  const detailResult = useQuery({
    ...parentDetailQueryOptions(selectedParentId ?? ""),
    enabled: !!selectedParentId,
    placeholderData: undefined,
  });

  const parents = searchResult.data?.parents ?? [];
  const total = searchResult.data?.total ?? 0;
  const parentData = detailResult.data?.data ?? null;
  const isDetailLoading = detailResult.isFetching;

  // 학부모 선택
  const handleSelectParent = useCallback((parentId: string) => {
    setSelectedParentId(parentId);
    setFormMode("selected");
  }, []);

  // 삭제 완료 후
  const handleParentDeleted = useCallback(() => {
    setSelectedParentId(null);
    setFormMode("info");
  }, []);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
      {/* 왼쪽: 검색 패널 */}
      <ParentSearchPanel
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        parents={parents}
        total={total}
        isLoading={searchResult.isLoading}
        selectedParentId={selectedParentId}
        onSelectParent={handleSelectParent}
      />

      {/* 오른쪽: 폼 패널 */}
      <ParentFormPanel
        selectedParentId={selectedParentId}
        parentData={parentData}
        isLoading={isDetailLoading}
        formMode={formMode}
        onParentDeleted={handleParentDeleted}
        isAdmin={isAdmin}
      />
    </div>
  );
}
