"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import type { SubjectGroup, Subject, SubjectType } from "@/lib/data/subjects";

/**
 * 개정교육과정별 전체 계층 구조
 */
export type SubjectHierarchy = {
  curriculumRevision: {
    id: string;
    name: string;
    year?: number | null;
  };
  subjectGroups: (SubjectGroup & {
    subjects: (Subject & { subjectType: SubjectType | null })[];
  })[];
  subjectTypes: SubjectType[];
};

/**
 * SubjectHierarchyContext의 값 타입
 */
interface SubjectHierarchyContextValue {
  /**
   * 현재 로드된 계층 구조 데이터
   */
  hierarchy: SubjectHierarchy | null;
  
  /**
   * 데이터 로딩 중 여부
   */
  loading: boolean;
  
  /**
   * 에러 메시지
   */
  error: string | null;
  
  /**
   * 특정 개정교육과정의 교과 목록 조회
   */
  getSubjectGroups: (curriculumRevisionId: string) => SubjectGroup[];
  
  /**
   * 특정 교과의 과목 목록 조회
   */
  getSubjectsByGroup: (groupId: string) => Subject[];
  
  /**
   * 계층 구조 데이터 로드
   */
  loadHierarchy: (curriculumRevisionId: string) => Promise<void>;
  
  /**
   * 캐시 초기화
   */
  clearCache: () => void;
}

const SubjectHierarchyContext = createContext<SubjectHierarchyContextValue | undefined>(undefined);

/**
 * SubjectHierarchyContext Provider Props
 */
interface SubjectHierarchyProviderProps {
  children: ReactNode;
}

/**
 * SubjectHierarchyContext Provider
 * 
 * 계층형 데이터(개정교육과정 → 교과 → 과목)를 클라이언트에 캐싱하여
 * 필터링 시 서버 요청 없이 즉시 반응할 수 있도록 합니다.
 */
export function SubjectHierarchyProvider({ children }: SubjectHierarchyProviderProps) {
  const [hierarchy, setHierarchy] = useState<SubjectHierarchy | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 서버 액션: getSubjectHierarchyOptimized 호출
   */
  const fetchHierarchy = useCallback(async (curriculumRevisionId: string): Promise<SubjectHierarchy> => {
    const response = await fetch(`/api/subject-hierarchy?curriculum_revision_id=${curriculumRevisionId}`);
    
    if (!response.ok) {
      throw new Error("계층 구조 데이터를 불러오는데 실패했습니다.");
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || "데이터 로드 실패");
    }
    
    return result.data;
  }, []);

  /**
   * 계층 구조 데이터 로드
   */
  const loadHierarchy = useCallback(async (curriculumRevisionId: string) => {
    // 이미 같은 데이터가 로드되어 있으면 스킵
    if (hierarchy?.curriculumRevision.id === curriculumRevisionId) {
      return;
    }

    // 이미 로딩 중이면 스킵
    if (loading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchHierarchy(curriculumRevisionId);
      setHierarchy(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
      setError(errorMessage);
      console.error("[SubjectHierarchyContext] 계층 구조 로드 실패:", err);
      setHierarchy(null);
    } finally {
      setLoading(false);
    }
  }, [hierarchy, loading, fetchHierarchy]);

  /**
   * 특정 개정교육과정의 교과 목록 조회
   */
  const getSubjectGroups = useCallback((curriculumRevisionId: string): SubjectGroup[] => {
    if (!hierarchy || hierarchy.curriculumRevision.id !== curriculumRevisionId) {
      return [];
    }
    return hierarchy.subjectGroups;
  }, [hierarchy]);

  /**
   * 특정 교과의 과목 목록 조회
   */
  const getSubjectsByGroup = useCallback((groupId: string): Subject[] => {
    if (!hierarchy) {
      return [];
    }
    
    const group = hierarchy.subjectGroups.find((g) => g.id === groupId);
    return group?.subjects || [];
  }, [hierarchy]);

  /**
   * 캐시 초기화
   */
  const clearCache = useCallback(() => {
    setHierarchy(null);
    setError(null);
  }, []);

  const value: SubjectHierarchyContextValue = {
    hierarchy,
    loading,
    error,
    getSubjectGroups,
    getSubjectsByGroup,
    loadHierarchy,
    clearCache,
  };

  return (
    <SubjectHierarchyContext.Provider value={value}>
      {children}
    </SubjectHierarchyContext.Provider>
  );
}

/**
 * SubjectHierarchyContext Hook
 * 
 * @throws {Error} Provider 외부에서 사용 시 에러 발생
 */
export function useSubjectHierarchy(): SubjectHierarchyContextValue {
  const context = useContext(SubjectHierarchyContext);
  
  if (context === undefined) {
    throw new Error("useSubjectHierarchy must be used within a SubjectHierarchyProvider");
  }
  
  return context;
}

