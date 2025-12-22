"use client";

import { useState, useEffect } from "react";
import {
  getRegionsByLevelAction,
  getRegionsByParentAction,
} from "@/lib/domains/school";
import type { Region } from "@/lib/data/schools";

type RegionFilterProps = {
  value?: string | null;
  onChange: (regionId: string | null) => void;
  className?: string;
};

export default function RegionFilter({
  value,
  onChange,
  className,
}: RegionFilterProps) {
  const [level1Regions, setLevel1Regions] = useState<Region[]>([]);
  const [level2Regions, setLevel2Regions] = useState<Region[]>([]);
  const [level3Regions, setLevel3Regions] = useState<Region[]>([]);
  const [selectedLevel1, setSelectedLevel1] = useState<string>("");
  const [selectedLevel2, setSelectedLevel2] = useState<string>("");
  const [selectedLevel3, setSelectedLevel3] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // 초기 레벨 1 지역 로드
  useEffect(() => {
    async function loadLevel1() {
      setLoading(true);
      try {
        const regions = await getRegionsByLevelAction(1);
        setLevel1Regions(regions);
      } catch (error) {
        console.error("시/도 조회 실패:", error);
      } finally {
        setLoading(false);
      }
    }
    loadLevel1();
  }, []);

  // 레벨 1 선택 시 레벨 2 로드
  useEffect(() => {
    if (!selectedLevel1) {
      setLevel2Regions([]);
      setLevel3Regions([]);
      setSelectedLevel2("");
      setSelectedLevel3("");
      onChange(null);
      return;
    }

    async function loadLevel2() {
      setLoading(true);
      try {
        const regions = await getRegionsByParentAction(selectedLevel1);
        setLevel2Regions(regions);
        setLevel3Regions([]);
        setSelectedLevel2("");
        setSelectedLevel3("");
        // 레벨 2가 없으면 레벨 1 ID 전달, 있으면 null (레벨 2 선택 대기)
        onChange(regions.length === 0 ? selectedLevel1 : null);
      } catch (error) {
        console.error("시/군/구 조회 실패:", error);
        onChange(null);
      } finally {
        setLoading(false);
      }
    }
    loadLevel2();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLevel1]);

  // 레벨 2 선택 시 레벨 3 로드
  useEffect(() => {
    if (!selectedLevel2) {
      setLevel3Regions([]);
      setSelectedLevel3("");
      // 레벨 2가 선택 해제되면, 레벨 1이 있고 레벨 2가 없으면 레벨 1 ID 전달
      if (selectedLevel1) {
        onChange(level2Regions.length === 0 ? selectedLevel1 : null);
      } else {
        onChange(null);
      }
      return;
    }

    async function loadLevel3() {
      setLoading(true);
      try {
        const regions = await getRegionsByParentAction(selectedLevel2);
        setLevel3Regions(regions);
        setSelectedLevel3("");
        // 레벨 3가 없으면 레벨 2 ID 전달, 있으면 null (레벨 3 선택 대기)
        onChange(regions.length === 0 ? selectedLevel2 : null);
      } catch (error) {
        console.error("읍/면/동 조회 실패:", error);
        onChange(null);
      } finally {
        setLoading(false);
      }
    }
    loadLevel3();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLevel2]);

  // 레벨 3 선택 시 최종 ID 전달
  useEffect(() => {
    if (selectedLevel3) {
      onChange(selectedLevel3);
    } else if (selectedLevel2 && level3Regions.length > 0) {
      // 레벨 3가 선택 해제되고 레벨 3 목록이 있으면 레벨 2 ID 전달
      onChange(selectedLevel2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLevel3]);

  return (
    <div className={`flex flex-col gap-2 ${className || ""}`}>
      <label className="text-xs font-medium text-gray-700">지역</label>
      <div className="flex gap-2">
        {/* 시/도 */}
        <select
          value={selectedLevel1}
          onChange={(e) => setSelectedLevel1(e.target.value)}
          disabled={loading}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
        >
          <option value="">시/도 선택</option>
          {level1Regions.map((region) => (
            <option key={region.id} value={region.id}>
              {region.name}
            </option>
          ))}
        </select>

        {/* 시/군/구 */}
        {selectedLevel1 && (
          <select
            value={selectedLevel2}
            onChange={(e) => setSelectedLevel2(e.target.value)}
            disabled={loading || !selectedLevel1}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
          >
            <option value="">시/군/구 선택</option>
            {level2Regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
        )}

        {/* 읍/면/동 */}
        {selectedLevel2 && level3Regions.length > 0 && (
          <select
            value={selectedLevel3}
            onChange={(e) => setSelectedLevel3(e.target.value)}
            disabled={loading || !selectedLevel2}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
          >
            <option value="">읍/면/동 선택</option>
            {level3Regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

