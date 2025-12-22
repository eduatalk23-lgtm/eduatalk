"use client";

/**
 * 학교 관리 페이지 (읽기 전용)
 *
 * 새 테이블 구조:
 * - school_info: 중·고등학교 (나이스 데이터)
 * - universities: 대학교
 * - university_campuses: 대학교 캠퍼스
 *
 * 주의: 학교 데이터는 외부 데이터 기반으로 읽기 전용입니다.
 */

import { useState, useEffect, useMemo } from "react";
import {
  getAllSchoolsAction,
  getSchoolInfoListAction,
  getUniversityCampusesAction,
  searchSchoolsAction,
} from "@/lib/domains/school";
import Button from "@/components/atoms/Button";
import { useToast } from "@/components/ui/ToastProvider";
import type { AllSchoolsView, SchoolInfo, UniversityWithCampus } from "@/lib/data/schools";
import type { SchoolType } from "@/lib/domains/school/types";

type TabType = "ALL" | "MIDDLE" | "HIGH" | "UNIVERSITY";

const TAB_LABELS: Record<TabType, string> = {
  ALL: "전체",
  MIDDLE: "중학교",
  HIGH: "고등학교",
  UNIVERSITY: "대학교",
};

export default function SchoolsPage() {
  const toast = useToast();
  const [schools, setSchools] = useState<AllSchoolsView[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<TabType>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [regionFilter, setRegionFilter] = useState("");

  // 통계
  const stats = useMemo(() => {
    const middleCount = schools.filter((s) => s.school_type === "MIDDLE").length;
    const highCount = schools.filter((s) => s.school_type === "HIGH").length;
    const universityCount = schools.filter((s) => s.school_type === "UNIVERSITY").length;
    return { middleCount, highCount, universityCount, total: schools.length };
  }, [schools]);

  // 학교 목록 로드
  async function loadSchools() {
    setLoading(true);
    try {
      const schoolType: SchoolType | undefined =
        selectedTab === "ALL" ? undefined : selectedTab;
      
      const data = await getAllSchoolsAction({
        schoolType,
        region: regionFilter || undefined,
        limit: 500,
      });
      setSchools(data);
    } catch (error) {
      console.error("학교 목록 조회 실패:", error);
      toast.showError("학교 목록을 불러오는데 실패했습니다.");
      setSchools([]);
    } finally {
      setLoading(false);
    }
  }

  // 탭 변경 시 다시 로드
  useEffect(() => {
    loadSchools();
  }, [selectedTab, regionFilter]);

  // 검색 필터링 (클라이언트 사이드)
  const filteredSchools = useMemo(() => {
    if (!searchQuery.trim()) return schools;
    
    const query = searchQuery.toLowerCase();
    return schools.filter(
      (school) =>
        school.name.toLowerCase().includes(query) ||
        school.region?.toLowerCase().includes(query)
    );
  }, [schools, searchQuery]);

  // 고유 지역 목록 추출
  const uniqueRegions = useMemo(() => {
    const regions = new Set<string>();
    schools.forEach((school) => {
      if (school.region) {
        // 시/도 단위만 추출 (첫 번째 단어)
        const province = school.region.split(" ")[0];
        regions.add(province);
      }
    });
    return Array.from(regions).sort();
  }, [schools]);

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">서비스 마스터</p>
            <h1 className="text-3xl font-semibold text-gray-900">학교 관리</h1>
            <p className="mt-2 text-sm text-gray-500">
              중학교, 고등학교, 대학교 정보를 조회합니다.
              <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                읽기 전용
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* 안내 메시지 (상단) */}
      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-amber-800">중요 안내</h3>
            <div className="mt-2 text-sm text-amber-700">
              <p>
                학교 정보는 나이스(NEIS) 데이터와 연동되어 자동으로 관리됩니다.
                수정이 필요한 경우 관리자에게 문의하세요.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex gap-4">
          {(Object.keys(TAB_LABELS) as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={`whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
                selectedTab === tab
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {TAB_LABELS[tab]}
              {tab !== "ALL" && (
                <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs">
                  {tab === "MIDDLE"
                    ? stats.middleCount
                    : tab === "HIGH"
                    ? stats.highCount
                    : stats.universityCount}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* 통계 */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">전체 학교</p>
          <p className="text-2xl font-semibold text-gray-900">{stats.total.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">중학교</p>
          <p className="text-2xl font-semibold text-blue-600">{stats.middleCount.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">고등학교</p>
          <p className="text-2xl font-semibold text-green-600">{stats.highCount.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">대학교</p>
          <p className="text-2xl font-semibold text-purple-600">{stats.universityCount.toLocaleString()}</p>
        </div>
      </div>

      {/* 검색 및 필터 */}
      <div className="mb-6 flex gap-4">
        <div className="flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="학교명 또는 지역으로 검색..."
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>
        <select
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        >
          <option value="">전체 지역</option>
          {uniqueRegions.map((region) => (
            <option key={region} value={region}>
              {region}
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSearchQuery("");
            setRegionFilter("");
          }}
        >
          초기화
        </Button>
      </div>

      {/* 결과 개수 */}
      <div className="mb-4 text-sm text-gray-600">
        총 <span className="font-semibold">{filteredSchools.length.toLocaleString()}</span>개의
        학교가 검색되었습니다.
      </div>

      {/* 학교 목록 테이블 */}
      <div className="mb-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
        {loading ? (
          <div className="p-12 text-center">
            <div className="text-sm text-gray-500">로딩 중...</div>
          </div>
        ) : filteredSchools.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-sm text-gray-500">검색 결과가 없습니다.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    학교명
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    구분
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    지역
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    설립유형
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    연락처
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredSchools.slice(0, 100).map((school) => (
                  <tr key={school.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900">{school.name}</span>
                        {school.campus_name && school.campus_name !== school.name && (
                          <span className="text-xs text-gray-500">{school.campus_name}</span>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          school.school_type === "MIDDLE"
                            ? "bg-blue-100 text-blue-800"
                            : school.school_type === "HIGH"
                            ? "bg-green-100 text-green-800"
                            : "bg-purple-100 text-purple-800"
                        }`}
                      >
                        {school.school_type === "MIDDLE"
                          ? "중학교"
                          : school.school_type === "HIGH"
                          ? "고등학교"
                          : "대학교"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      {school.region || "-"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      {school.establishment_type || "-"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      {school.phone || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredSchools.length > 100 && (
              <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 text-center text-sm text-gray-500">
                상위 100개만 표시됩니다. 검색어를 입력하여 결과를 좁혀주세요.
              </div>
            )}
          </div>
        )}
      </div>

      {/* 안내 메시지 */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">안내</h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>
                학교 데이터는 나이스(NEIS) 및 교육부 공식 데이터를 기반으로 관리됩니다.
                학교 정보 추가/수정이 필요한 경우 시스템 관리자에게 문의해주세요.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
