"use client";

import { useState, useMemo, useCallback, memo } from "react";
import { BookDetail } from "@/lib/types/plan";

type BookDetailsManagerProps = {
  initialDetails?: BookDetail[];
  onChange?: (details: Omit<BookDetail, "id" | "created_at">[]) => void;
};

type DetailItem = Omit<BookDetail, "id" | "created_at"> & { tempId?: string };

type GroupedDetails = {
  majorUnit: string;
  items: DetailItem[];
  groupId: string; // 고유 ID (첫 번째 항목의 tempId 또는 display_order 기반)
};

// 상수 정의
const EMPTY_MAJOR_UNIT = "(대단원 없음)";

// 유틸리티 함수
const getMajorUnit = (majorUnit: string | null | undefined): string => {
  return majorUnit || EMPTY_MAJOR_UNIT;
};

const normalizeMajorUnit = (majorUnit: string): string => {
  return majorUnit || EMPTY_MAJOR_UNIT;
};

export function BookDetailsManager({
  initialDetails = [],
  onChange,
}: BookDetailsManagerProps) {
  const [details, setDetails] = useState<DetailItem[]>(
    initialDetails.map((d) => ({
      book_id: d.book_id,
      major_unit: d.major_unit || "",
      minor_unit: d.minor_unit || "",
      page_number: d.page_number || 0,
      display_order: d.display_order || 0,
      tempId: d.id,
    }))
  );

  // 대단원별로 그룹화
  const groupedDetails = useMemo(() => {
    const groups = new Map<string, DetailItem[]>();

    details.forEach((detail) => {
      const majorUnit = getMajorUnit(detail.major_unit);
      if (!groups.has(majorUnit)) {
        groups.set(majorUnit, []);
      }
      groups.get(majorUnit)!.push(detail);
    });

    // display_order로 정렬
    const sortedGroups: GroupedDetails[] = Array.from(groups.entries())
      .map(([majorUnit, items]) => {
        const sortedItems = items.sort((a, b) => {
          // 같은 대단원 내에서는 display_order로 정렬
          if (a.display_order !== b.display_order) {
            return a.display_order - b.display_order;
          }
          // display_order가 같으면 페이지 번호로 정렬
          return (a.page_number || 0) - (b.page_number || 0);
        });
        // 그룹 고유 ID 생성 (majorUnit 제거, tempId 또는 display_order만 사용)
        const groupId = sortedItems[0]?.tempId || `group-${sortedItems[0]?.display_order ?? 0}`;
        return {
          majorUnit,
          items: sortedItems,
          groupId,
        };
      })
      .sort((a, b) => {
        // 대단원 간 정렬은 첫 번째 항목의 display_order로
        const aOrder = a.items[0]?.display_order || 0;
        const bOrder = b.items[0]?.display_order || 0;
        return aOrder - bOrder;
      });

    return sortedGroups;
  }, [details]);

  // 토글 상태 관리 (groupId 기반)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(groupedDetails.map((g) => g.groupId))
  );

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  const updateDetails = useCallback((newDetails: DetailItem[]) => {
    // display_order 재계산
    let order = 0;
    const updated = newDetails.map((d) => ({
      ...d,
      display_order: order++,
    }));

    setDetails(updated);
    onChange?.(
      updated.map((d) => ({
        book_id: d.book_id,
        major_unit: d.major_unit || null,
        minor_unit: d.minor_unit || null,
        page_number: d.page_number || 0,
        display_order: d.display_order || 0,
      }))
    );
  }, [onChange]);

  // 대단원 추가
  const addMajorUnit = useCallback(() => {
    const newDetail: DetailItem = {
      book_id: details[0]?.book_id || "",
      major_unit: `대단원 ${groupedDetails.length + 1}`,
      minor_unit: "",
      page_number: 0,
      display_order: details.length,
      tempId: `temp-major-${Date.now()}`,
    };
    updateDetails([...details, newDetail]);
    // 새로 추가된 대단원의 groupId를 찾아서 자동으로 펼침
    const newGroupId = newDetail.tempId || `group-${newDetail.display_order}`;
    setExpandedGroups((prev) => new Set([...prev, newGroupId]));
  }, [details, groupedDetails.length, updateDetails]);

  // 중단원 추가 (특정 대단원 아래)
  const addMinorUnit = useCallback((majorUnit: string) => {
    const majorUnitDetails = details.filter(
      (d) => getMajorUnit(d.major_unit) === majorUnit
    );
    const lastPage =
      majorUnitDetails.length > 0
        ? Math.max(...majorUnitDetails.map((d) => d.page_number || 0))
        : 0;

    const newDetail: DetailItem = {
      book_id: details[0]?.book_id || "",
      major_unit: majorUnit === EMPTY_MAJOR_UNIT ? "" : majorUnit,
      minor_unit: "",
      page_number: lastPage + 1,
      display_order: details.length,
      tempId: `temp-minor-${Date.now()}`,
    };
    updateDetails([...details, newDetail]);
  }, [details, updateDetails]);

  // 항목 삭제
  const removeItem = useCallback((tempId: string) => {
    updateDetails(details.filter((d) => d.tempId !== tempId));
  }, [details, updateDetails]);

  // 대단원 삭제 (해당 대단원의 모든 항목 삭제)
  const removeMajorUnit = useCallback((majorUnit: string) => {
    updateDetails(
      details.filter((d) => getMajorUnit(d.major_unit) !== majorUnit)
    );
  }, [details, updateDetails]);

  // 항목 업데이트
  const updateItem = useCallback((
    tempId: string,
    field: keyof DetailItem,
    value: string | number
  ) => {
    const newDetails = details.map((d) =>
      d.tempId === tempId ? { ...d, [field]: value } : d
    );
    updateDetails(newDetails);
  }, [details, updateDetails]);

  // 대단원명 업데이트 (해당 대단원의 모든 항목 업데이트)
  const updateMajorUnitName = useCallback((oldName: string, newName: string) => {
    const normalizedNewName = normalizeMajorUnit(newName);
    const normalizedOldName = normalizeMajorUnit(oldName);
    
    // 중복 체크: 새 이름이 이미 다른 그룹에 존재하는지 확인
    const existingGroup = groupedDetails.find(
      (g) => getMajorUnit(g.majorUnit) === normalizedNewName && 
             g.majorUnit !== normalizedOldName
    );
    
    if (existingGroup) {
      alert(`"${normalizedNewName}" 대단원명이 이미 존재합니다. 다른 이름을 사용해주세요.`);
      return;
    }

    const newDetails = details.map((d) =>
      getMajorUnit(d.major_unit) === normalizedOldName
        ? { ...d, major_unit: normalizedNewName === EMPTY_MAJOR_UNIT ? "" : normalizedNewName }
        : d
    );
    updateDetails(newDetails);
  }, [details, groupedDetails, updateDetails]);

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900">교재 목차</h4>
        <button
          type="button"
          onClick={addMajorUnit}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
        >
          + 대단원 추가
        </button>
      </div>

      {groupedDetails.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-900">
          목차가 없습니다. "+ 대단원 추가" 버튼을 클릭하여 추가하세요.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {groupedDetails.map((group) => {
            const isExpanded = expandedGroups.has(group.groupId);
            const hasMinorUnits = group.items.some((item) => item.minor_unit);

            return (
              <div
                key={group.groupId}
                className="rounded-md border border-gray-200 bg-white overflow-hidden"
              >
                {/* 대단원 헤더 */}
                <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 border-b border-gray-200">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.groupId)}
                    className="flex items-center justify-center w-6 h-6 rounded-md hover:bg-gray-200 transition"
                    aria-label={isExpanded ? "접기" : "펼치기"}
                  >
                    <span className="text-gray-500 text-xs">
                      {isExpanded ? "▼" : "▶"}
                    </span>
                  </button>
                  <input
                    type="text"
                    key={`input-${group.groupId}`}
                    value={group.majorUnit === EMPTY_MAJOR_UNIT ? "" : group.majorUnit}
                    onChange={(e) => {
                      const newName = normalizeMajorUnit(e.target.value);
                      updateMajorUnitName(group.majorUnit, newName);
                    }}
                    onFocus={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    placeholder="대단원명을 입력하세요"
                    className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm font-semibold text-gray-900 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                  />
                  {hasMinorUnits && (
                    <span className="text-xs text-gray-900">
                      ({group.items.filter((i) => i.minor_unit).length}개 중단원)
                    </span>
                  )}
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        addMinorUnit(group.majorUnit);
                        setExpandedGroups((prev) => new Set([...prev, group.groupId]));
                      }}
                      className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                      + 중단원
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`"${group.majorUnit === EMPTY_MAJOR_UNIT ? "기타" : group.majorUnit}" 대단원과 모든 중단원을 삭제하시겠습니까?`)) {
                          removeMajorUnit(group.majorUnit);
                        }
                      }}
                      className="rounded-md border border-red-300 bg-white px-2 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                    >
                      삭제
                    </button>
                  </div>
                </div>

                {/* 중단원 목록 */}
                {isExpanded && (
                  <MinorUnitList
                    items={group.items}
                    updateItem={updateItem}
                    removeItem={removeItem}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Hidden input for form submission */}
      <input
        type="hidden"
        name="details"
        value={JSON.stringify(
          details
            .filter((d) => d.major_unit || d.minor_unit || d.page_number)
            .map((d) => ({
              major_unit: d.major_unit || null,
              minor_unit: d.minor_unit || null,
              page_number: d.page_number || 0,
              display_order: d.display_order || 0,
            }))
        )}
      />
    </div>
  );
}

// 중단원 목록 컴포넌트 (불필요한 리렌더링 방지)
type MinorUnitListProps = {
  items: DetailItem[];
  updateItem: (tempId: string, field: keyof DetailItem, value: string | number) => void;
  removeItem: (tempId: string) => void;
};

const MinorUnitList = memo(function MinorUnitList({
  items,
  updateItem,
  removeItem,
}: MinorUnitListProps) {
  if (items.length === 0) {
    return (
      <div className="px-3 py-4 text-center text-sm text-gray-900">
        중단원이 없습니다. "+ 중단원" 버튼을 클릭하여 추가하세요.
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {items.map((item, itemIndex) => (
        <div
          key={item.tempId || itemIndex}
          className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50"
        >
          <div className="flex-1 flex items-center gap-3">
            <span className="text-gray-400 text-xs w-6">└</span>
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                value={item.minor_unit || ""}
                onChange={(e) =>
                  updateItem(
                    item.tempId!,
                    "minor_unit",
                    e.target.value
                  )
                }
                placeholder="중단원명을 입력하세요"
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="w-24">
              <input
                type="number"
                value={item.page_number || ""}
                onChange={(e) =>
                  updateItem(
                    item.tempId!,
                    "page_number",
                    parseInt(e.target.value) || 0
                  )
                }
                min="0"
                placeholder="페이지"
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="text-xs text-gray-900 min-w-[40px]">
              {item.page_number ? `${item.page_number}p` : ""}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (confirm("이 중단원을 삭제하시겠습니까?")) {
                removeItem(item.tempId!);
              }
            }}
            className="rounded-md border border-red-300 bg-white px-2 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50"
          >
            삭제
          </button>
        </div>
      ))}
    </div>
  );
});
