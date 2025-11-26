"use client";

import { useState, useEffect, useMemo } from "react";
import { getSchoolsAction } from "@/app/(admin)/actions/schoolActions";
import SchoolTypeTabs from "./_components/SchoolTypeTabs";
import SchoolFilterPanel from "./_components/SchoolFilterPanel";
import SchoolTable from "./_components/SchoolTable";
import SchoolFormModal from "./_components/SchoolFormModal";
import SchoolStats from "./_components/SchoolStats";
import type { School } from "@/lib/data/schools";

export default function SchoolsPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [allSchools, setAllSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<
    "중학교" | "고등학교" | "대학교"
  >("중학교");
  const [searchQuery, setSearchQuery] = useState("");
  const [regionId, setRegionId] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [universityType, setUniversityType] = useState<string | null>(null);
  const [universityOwnership, setUniversityOwnership] = useState<string | null>(
    null
  );
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | undefined>(
    undefined
  );

  // 모든 타입의 학교 목록 로드 (통계용)
  async function loadAllSchools() {
    try {
      const [middleSchools, highSchools, universities] = await Promise.all([
        getSchoolsAction({ type: "중학교", includeInactive: false }),
        getSchoolsAction({ type: "고등학교", includeInactive: false }),
        getSchoolsAction({ type: "대학교", includeInactive: false }),
      ]);
      setAllSchools([
        ...(middleSchools || []),
        ...(highSchools || []),
        ...(universities || []),
      ]);
    } catch (error) {
      console.error("전체 학교 목록 조회 실패:", error);
      setAllSchools([]);
    }
  }

  // 선택한 탭의 학교 목록 로드
  async function loadSchools() {
    setLoading(true);
    try {
      const data = await getSchoolsAction({
        type: selectedType,
        includeInactive: false,
      });
      setSchools(data || []);
    } catch (error) {
      console.error("학교 목록 조회 실패:", error);
      setSchools([]);
    } finally {
      setLoading(false);
    }
  }

  // 컴포넌트 마운트 시 전체 학교 로드
  useEffect(() => {
    loadAllSchools();
  }, []);

  // 선택한 탭 변경 시 해당 탭의 학교 로드
  useEffect(() => {
    loadSchools();
  }, [selectedType]);

  // 필터링된 학교 목록
  const filteredSchools = useMemo(() => {
    let filtered = [...schools];

    // 검색어 필터
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((school) =>
        school.name.toLowerCase().includes(query)
      );
    }

    // 지역 필터
    if (regionId) {
      filtered = filtered.filter((school) => school.region_id === regionId);
    }

    // 고등학교 유형 필터
    if (selectedType === "고등학교" && category) {
      filtered = filtered.filter((school) => school.category === category);
    }

    // 대학교 유형 필터
    if (selectedType === "대학교") {
      if (universityType) {
        filtered = filtered.filter(
          (school) => school.university_type === universityType
        );
      }
      if (universityOwnership) {
        filtered = filtered.filter(
          (school) => school.university_ownership === universityOwnership
        );
      }
    }

    return filtered;
  }, [
    schools,
    searchQuery,
    regionId,
    category,
    universityType,
    universityOwnership,
    selectedType,
  ]);

  function handleCreateClick() {
    setEditingSchool(undefined);
    setShowFormModal(true);
  }

  function handleEditClick(school: School) {
    setEditingSchool(school);
    setShowFormModal(true);
  }

  function handleFormSuccess() {
    setShowFormModal(false);
    setEditingSchool(undefined);
    loadSchools();
    loadAllSchools(); // 통계 갱신을 위해 전체 학교도 다시 로드
  }

  function handleFormCancel() {
    setShowFormModal(false);
    setEditingSchool(undefined);
  }

  function handleResetFilters() {
    setSearchQuery("");
    setRegionId(null);
    setCategory(null);
    setUniversityType(null);
    setUniversityOwnership(null);
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="mb-6">
        <p className="text-sm font-medium text-gray-500">서비스 마스터</p>
        <h1 className="text-3xl font-semibold text-gray-900">학교 관리</h1>
        <p className="mt-2 text-sm text-gray-500">
          중학교, 고등학교, 대학교 정보를 관리하세요.
        </p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="mb-6">
        <SchoolTypeTabs
          selectedType={selectedType}
          onTypeChange={setSelectedType}
          onCreateClick={handleCreateClick}
        />
      </div>

      {/* 통계 */}
      <div className="mb-6">
        <SchoolStats schools={allSchools} />
      </div>

      {/* 검색 및 필터 */}
      <div className="mb-6">
        <SchoolFilterPanel
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          regionId={regionId}
          onRegionChange={setRegionId}
          category={category}
          onCategoryChange={setCategory}
          universityType={universityType}
          onUniversityTypeChange={setUniversityType}
          universityOwnership={universityOwnership}
          onUniversityOwnershipChange={setUniversityOwnership}
          schoolType={selectedType}
          onReset={handleResetFilters}
        />
      </div>

      {/* 결과 개수 */}
      <div className="mb-4 text-sm text-gray-600">
        총 <span className="font-semibold">{filteredSchools.length}</span>개의
        학교가 검색되었습니다.
      </div>

      {/* 학교 목록 테이블 */}
      <div className="mb-6">
        {loading ? (
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
            <div className="text-sm text-gray-500">로딩 중...</div>
          </div>
        ) : (
          <SchoolTable
            schools={filteredSchools}
            onEdit={handleEditClick}
            onRefresh={loadSchools}
          />
        )}
      </div>

      {/* 학교 등록/수정 모달 */}
      {showFormModal && (
        <SchoolFormModal
          school={editingSchool}
          defaultType={selectedType}
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
        />
      )}
    </section>
  );
}
