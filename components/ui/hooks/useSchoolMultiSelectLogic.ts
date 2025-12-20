"use client";

import { useState, useEffect, useRef } from "react";
import {
  getSchoolById,
  searchSchools,
  type School,
} from "@/app/(student)/actions/schoolActions";

type UseSchoolMultiSelectLogicProps = {
  value?: string[];
  onChange: (value: string[]) => void;
  type?: "중학교" | "고등학교" | "대학교";
  disabled?: boolean;
  maxCount?: number;
  onSchoolSelect?: (school: School) => void;
};

export function useSchoolMultiSelectLogic({
  value = [],
  onChange,
  type,
  disabled = false,
  maxCount = 3,
  onSchoolSelect,
}: UseSchoolMultiSelectLogicProps) {
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSchools, setSelectedSchools] = useState<School[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const previousValueRef = useRef<string[]>([]);

  // 외부 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // 검색 모드로 전환 시 검색 입력 필드에 포커스
  useEffect(() => {
    if (isSearchMode && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchMode]);

  // 검색어 변경 시 자동 검색 (디바운스)
  useEffect(() => {
    if (!isSearchMode || disabled) {
      return;
    }

    if (searchQuery.trim().length >= 1) {
      const timeoutId = setTimeout(() => {
        handleSearchSchools(searchQuery);
      }, 300); // 디바운스

      return () => clearTimeout(timeoutId);
    } else {
      setSchools([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, isSearchMode, disabled]);

  // value가 변경되면 학교 정보 조회
  useEffect(() => {
    // 배열 내용이 실제로 변경되었는지 확인
    const currentValueStr = JSON.stringify(value?.sort() || []);
    const previousValueStr = JSON.stringify(previousValueRef.current.sort());

    if (currentValueStr === previousValueStr) {
      return;
    }

    previousValueRef.current = value || [];

    if (value && value.length > 0) {
      // 이미 선택된 학교들의 ID와 비교하여 불필요한 조회 방지
      const currentIds = selectedSchools
        .map((s) => s.id)
        .filter((id): id is string => !!id)
        .sort();
      const newIds = [...value].sort();

      const currentIdsStr = JSON.stringify(currentIds);
      const newIdsStr = JSON.stringify(newIds);

      if (currentIdsStr !== newIdsStr) {
        fetchSchoolsByIds(value);
      }
    } else {
      setSelectedSchools([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  async function fetchSchoolsByIds(schoolIds: string[]) {
    try {
      const schools = await Promise.all(
        schoolIds.map((id) => getSchoolById(id))
      );
      const validSchools = schools.filter(
        (school): school is School => school !== null
      );
      setSelectedSchools(validSchools);
    } catch (error) {
      console.error("학교 정보 조회 실패:", error);
    }
  }

  async function handleSearchSchools(query: string) {
    setLoading(true);
    try {
      const results = await searchSchools(query, type);
      // 이미 선택된 학교는 제외
      const filteredResults = results.filter(
        (school) => !selectedSchools.some((selected) => selected.id === school.id)
      );
      setSchools(filteredResults);
    } catch (error) {
      console.error("학교 검색 실패:", error);
      setSchools([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelect(school: School) {
    // 최대 개수 체크
    if (selectedSchools.length >= maxCount) {
      return;
    }

    // 이미 선택된 학교인지 확인
    if (selectedSchools.some((s) => s.id === school.id)) {
      return;
    }

    const newSelectedSchools = [...selectedSchools, school];
    setSelectedSchools(newSelectedSchools);

    // ID 배열로 변환하여 onChange 호출
    const newIds = newSelectedSchools
      .map((s) => s.id)
      .filter((id): id is string => !!id);
    onChange(newIds);

    setSearchQuery("");
    setIsOpen(false);
    setIsSearchMode(false);

    // 학교 선택 콜백 호출
    if (onSchoolSelect) {
      onSchoolSelect(school);
    }
  }

  function handleRemove(schoolId: string) {
    const newSelectedSchools = selectedSchools.filter(
      (s) => s.id !== schoolId
    );
    setSelectedSchools(newSelectedSchools);
    const newIds = newSelectedSchools
      .map((s) => s.id)
      .filter((id): id is string => !!id);
    onChange(newIds);
  }

  function handleClear() {
    setSelectedSchools([]);
    onChange([]);
    setSearchQuery("");
    setIsOpen(false);
    setIsSearchMode(false);
  }

  function handleSearchClick() {
    if (disabled) return;
    // 최대 개수에 도달했으면 검색 불가
    if (selectedSchools.length >= maxCount) {
      return;
    }
    setIsOpen(true);
    setIsSearchMode(true);
    setSearchQuery("");
    setSchools([]);
    // 검색 입력 필드에 포커스
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);
  }

  function handleSearchSubmit() {
    if (!searchQuery.trim() || loading) return;
    handleSearchSchools(searchQuery);
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearchSubmit();
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setIsSearchMode(false);
      setSearchQuery("");
      setSchools([]);
    }
  }

  function handleClose() {
    setIsOpen(false);
    setIsSearchMode(false);
    setSearchQuery("");
    setSchools([]);
  }

  const canAddMore = selectedSchools.length < maxCount;

  return {
    // 상태
    isSearchMode,
    isOpen,
    searchQuery,
    setSearchQuery,
    schools,
    loading,
    selectedSchools,
    canAddMore,

    // refs
    containerRef,
    searchInputRef,

    // 핸들러
    handleSelect,
    handleRemove,
    handleClear,
    handleSearchClick,
    handleSearchSubmit,
    handleSearchKeyDown,
    handleClose,
  };
}
