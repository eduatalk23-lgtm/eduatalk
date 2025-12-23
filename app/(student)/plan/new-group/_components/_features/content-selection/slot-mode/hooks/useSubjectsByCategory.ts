"use client";

import { useState, useEffect, useCallback } from "react";
import { getSubjectsByGroupNameAction } from "@/lib/domains/subject/actions/core";
import type { Subject } from "@/lib/data/subjects";

type UseSubjectsByCategoryOptions = {
  subjectCategory: string;
  curriculumRevisionId?: string;
  enabled?: boolean;
};

type UseSubjectsByCategoryResult = {
  subjects: Subject[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

/**
 * 교과 그룹명(subject_category)으로 과목 목록을 가져오는 훅
 * 슬롯 모드에서 subject_id 선택에 사용
 */
export function useSubjectsByCategory({
  subjectCategory,
  curriculumRevisionId,
  enabled = true,
}: UseSubjectsByCategoryOptions): UseSubjectsByCategoryResult {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSubjects = useCallback(async () => {
    if (!subjectCategory || !enabled) {
      setSubjects([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getSubjectsByGroupNameAction(
        subjectCategory,
        curriculumRevisionId
      );
      setSubjects(result);
    } catch (err) {
      console.error("[useSubjectsByCategory] 과목 조회 실패:", err);
      setError(err instanceof Error ? err.message : "과목 조회에 실패했습니다.");
      setSubjects([]);
    } finally {
      setIsLoading(false);
    }
  }, [subjectCategory, curriculumRevisionId, enabled]);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  return {
    subjects,
    isLoading,
    error,
    refetch: fetchSubjects,
  };
}
