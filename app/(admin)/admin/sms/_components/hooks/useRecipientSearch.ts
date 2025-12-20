"use client";

import { useState, useCallback } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import type { SMSRecipient } from "@/app/api/admin/sms/students/route";
import type { SMSFilter } from "../SMSFilterPanel";

type UseRecipientSearchProps = {
  filter: SMSFilter;
  onFilterChange: (filter: SMSFilter) => void;
};

export function useRecipientSearch({
  filter,
  onFilterChange,
}: UseRecipientSearchProps) {
  const { showError } = useToast();
  const [queryResults, setQueryResults] = useState<SMSRecipient[]>([]);
  const [isLoadingResults, setIsLoadingResults] = useState(false);

  // 조회 실행
  const handleSearch = useCallback(async () => {
    if (filter.recipientTypes.length === 0) {
      showError("전송 대상자를 최소 1개 이상 선택해주세요.");
      return;
    }

    setIsLoadingResults(true);
    try {
      // Query Parameters 구성
      const params = new URLSearchParams();
      if (filter.search) {
        params.append("search", filter.search);
      }
      if (filter.grades.length > 0) {
        params.append("grades", filter.grades.join(","));
      }
      if (filter.divisions.length > 0) {
        params.append(
          "divisions",
          filter.divisions.map((d) => (d === null ? "null" : d)).join(",")
        );
      }
      params.append("recipientTypes", filter.recipientTypes.join(","));

      const response = await fetch(
        `/api/admin/sms/students?${params.toString()}`
      );
      const result: { recipients: SMSRecipient[]; total: number; error?: string } =
        await response.json();

      if (!response.ok || result.error) {
        showError(result.error || "조회 중 오류가 발생했습니다.");
        setQueryResults([]);
        return;
      }

      setQueryResults(result.recipients);
    } catch (error) {
      console.error("[SMS] 조회 실패:", error);
      showError("조회 중 오류가 발생했습니다.");
      setQueryResults([]);
    } finally {
      setIsLoadingResults(false);
    }
  }, [filter, showError]);

  return {
    queryResults,
    isLoadingResults,
    handleSearch,
    setQueryResults,
  };
}

