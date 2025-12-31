/**
 * 학교 검색 관련 커스텀 훅
 * 
 * 학교 검색, 조회 로직을 분리하여 재사용 가능하게 만든 훅입니다.
 * UI 상태는 컴포넌트에서 관리하고, 데이터 페칭 로직만 이 훅에서 처리합니다.
 */

import { useState, useCallback } from "react";
import {
  searchSchools,
  getSchoolById,
  getSchoolByName,
  type School,
} from "@/lib/domains/school";

export type SchoolType = "중학교" | "고등학교" | "대학교";

export interface UseSchoolSearchOptions {
  type?: SchoolType;
}

export interface UseSchoolSearchReturn {
  schools: School[];
  loading: boolean;
  error: Error | null;
  search: (query: string) => Promise<void>;
  getById: (id: string) => Promise<School | null>;
  getByName: (name: string, type?: SchoolType) => Promise<School | null>;
  clear: () => void;
}

/**
 * 학교 검색 커스텀 훅
 * 
 * @param options 검색 옵션 (학교 타입 등)
 * @returns 학교 검색 관련 상태와 함수들
 * 
 * @example
 * ```tsx
 * const { schools, loading, search } = useSchoolSearch({ type: "고등학교" });
 * 
 * useEffect(() => {
 *   search("서울");
 * }, [searchQuery]);
 * ```
 */
export function useSchoolSearch(options: UseSchoolSearchOptions = {}): UseSchoolSearchReturn {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * 학교 검색
   * 
   * @param query 검색어
   */
  const search = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setSchools([]);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const results = await searchSchools(query, options.type);
        setSchools(results);
      } catch (e) {
        const err = e instanceof Error ? e : new Error("학교 검색 실패");
        setError(err);
        console.error("[useSchoolSearch] 학교 검색 실패:", err);
        setSchools([]);
      } finally {
        setLoading(false);
      }
    },
    [options.type]
  );

  /**
   * ID로 학교 조회
   * 
   * @param id 학교 ID
   * @returns 학교 객체 또는 null
   */
  const getById = useCallback(async (id: string): Promise<School | null> => {
    if (!id.trim()) {
      return null;
    }

    setLoading(true);
    setError(null);
    try {
      const school = await getSchoolById(id);
      return school;
    } catch (e) {
      const err = e instanceof Error ? e : new Error("학교 조회 실패");
      setError(err);
      console.error("[useSchoolSearch] 학교 조회 실패:", err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 이름으로 학교 조회
   * 
   * @param name 학교명
   * @param type 학교 타입 (옵션, 훅 옵션보다 우선)
   * @returns 학교 객체 또는 null (학교가 없으면 임시 객체 반환)
   */
  const getByName = useCallback(
    async (name: string, type?: SchoolType): Promise<School | null> => {
      if (!name.trim()) {
        return null;
      }

      setLoading(true);
      setError(null);
      try {
        const schoolType = type || options.type;
        const school = await getSchoolByName(name, schoolType);
        
        if (school) {
          return school;
        } else {
          // 학교명이 DB에 없으면 임시로 설정
          return {
            id: "",
            name: name,
            type: schoolType || "대학교",
            region: null,
          };
        }
      } catch (e) {
        const err = e instanceof Error ? e : new Error("학교 조회 실패");
        setError(err);
        console.error("[useSchoolSearch] 학교 조회 실패:", err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [options.type]
  );

  /**
   * 검색 결과 초기화
   */
  const clear = useCallback(() => {
    setSchools([]);
    setError(null);
  }, []);

  return {
    schools,
    loading,
    error,
    search,
    getById,
    getByName,
    clear,
  };
}

