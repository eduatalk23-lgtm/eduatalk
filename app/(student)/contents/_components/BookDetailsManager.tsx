"use client";

import { useState, useMemo } from "react";
import { BookDetail } from "@/lib/types/plan";

type BookDetailsManagerProps = {
  initialDetails?: BookDetail[];
  onChange?: (details: Omit<BookDetail, "id" | "created_at">[]) => void;
};

type DetailItem = Omit<BookDetail, "id" | "created_at"> & { tempId?: string };

type GroupedDetails = {
  majorUnit: string;
  items: DetailItem[];
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
      const majorUnit = detail.major_unit || "(대단원 없음)";
      if (!groups.has(majorUnit)) {
        groups.set(majorUnit, []);
      }
      groups.get(majorUnit)!.push(detail);
    });

    // display_order로 정렬
    const sortedGroups: GroupedDetails[] = Array.from(groups.entries())
      .map(([majorUnit, items]) => ({
        majorUnit,
        items: items.sort((a, b) => {
          // 같은 대단원 내에서는 display_order로 정렬
          if (a.display_order !== b.display_order) {
            return a.display_order - b.display_order;
          }
          // display_order가 같으면 페이지 번호로 정렬
          return (a.page_number || 0) - (b.page_number || 0);
        }),
      }))
      .sort((a, b) => {
        // 대단원 간 정렬은 첫 번째 항목의 display_order로
        const aOrder = a.items[0]?.display_order || 0;
        const bOrder = b.items[0]?.display_order || 0;
        return aOrder - bOrder;
      });

    return sortedGroups;
  }, [details]);

  // 토글 상태 관리
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(groupedDetails.map((g) => g.majorUnit))
  );

  const toggleGroup = (majorUnit: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(majorUnit)) {
        next.delete(majorUnit);
      } else {
        next.add(majorUnit);
      }
      return next;
    });
  };

  const updateDetails = (newDetails: DetailItem[]) => {
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
  };

  // 대단원 추가
  const addMajorUnit = () => {
    const newDetail: DetailItem = {
      book_id: details[0]?.book_id || "",
      major_unit: `대단원 ${groupedDetails.length + 1}`,
      minor_unit: "",
      page_number: 0,
      display_order: details.length,
      tempId: `temp-major-${Date.now()}`,
    };
    updateDetails([...details, newDetail]);
    // 새로 추가된 대단원은 자동으로 펼침
    if (newDetail.major_unit) {
      setExpandedGroups((prev) => new Set([...prev, newDetail.major_unit!]));
    }
  };

  // 중단원 추가 (특정 대단원 아래)
  const addMinorUnit = (majorUnit: string) => {
    const majorUnitDetails = details.filter(
      (d) => (d.major_unit || "(대단원 없음)") === majorUnit
    );
    const lastPage =
      majorUnitDetails.length > 0
        ? Math.max(...majorUnitDetails.map((d) => d.page_number || 0))
        : 0;

    const newDetail: DetailItem = {
      book_id: details[0]?.book_id || "",
      major_unit: majorUnit === "(대단원 없음)" ? "" : majorUnit,
      minor_unit: "",
      page_number: lastPage + 1,
      display_order: details.length,
      tempId: `temp-minor-${Date.now()}`,
    };
    updateDetails([...details, newDetail]);
  };

  // 항목 삭제
  const removeItem = (tempId: string) => {
    updateDetails(details.filter((d) => d.tempId !== tempId));
  };

  // 대단원 삭제 (해당 대단원의 모든 항목 삭제)
  const removeMajorUnit = (majorUnit: string) => {
    updateDetails(
      details.filter((d) => (d.major_unit || "(대단원 없음)") !== majorUnit)
    );
  };

  // 항목 업데이트
  const updateItem = (
    tempId: string,
    field: keyof DetailItem,
    value: string | number
  ) => {
    const newDetails = details.map((d) =>
      d.tempId === tempId ? { ...d, [field]: value } : d
    );
    updateDetails(newDetails);
  };

  // 대단원명 업데이트 (해당 대단원의 모든 항목 업데이트)
  const updateMajorUnitName = (oldName: string, newName: string) => {
    const newDetails = details.map((d) =>
      (d.major_unit || "(대단원 없음)") === oldName
        ? { ...d, major_unit: newName }
        : d
    );
    updateDetails(newDetails);
  };

  return (
    <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="mb-4 flex items-center justify-between">
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
        <p className="py-4 text-center text-sm text-gray-500">
          목차가 없습니다. "+ 대단원 추가" 버튼을 클릭하여 추가하세요.
        </p>
      ) : (
        <div className="space-y-2">
          {groupedDetails.map((group) => {
            const isExpanded = expandedGroups.has(group.majorUnit);
            const hasMinorUnits = group.items.some((item) => item.minor_unit);

            return (
              <div
                key={group.majorUnit}
                className="rounded-md border border-gray-200 bg-white overflow-hidden"
              >
                {/* 대단원 헤더 */}
                <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 border-b border-gray-200">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.majorUnit)}
                    className="flex items-center gap-2 flex-1 text-left hover:bg-gray-100 -mx-3 px-3 py-2 rounded-md transition"
                  >
                    <span className="text-gray-500">
                      {isExpanded ? "▼" : "▶"}
                    </span>
                    <input
                      type="text"
                      value={group.majorUnit === "(대단원 없음)" ? "" : group.majorUnit}
                      onChange={(e) => {
                        const newName = e.target.value || "(대단원 없음)";
                        updateMajorUnitName(group.majorUnit, newName);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="대단원명을 입력하세요"
                      className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm font-semibold text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                    />
                    {hasMinorUnits && (
                      <span className="text-xs text-gray-500">
                        ({group.items.filter((i) => i.minor_unit).length}개 중단원)
                      </span>
                    )}
                  </button>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        addMinorUnit(group.majorUnit);
                        setExpandedGroups((prev) => new Set([...prev, group.majorUnit]));
                      }}
                      className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                      + 중단원
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`"${group.majorUnit}" 대단원과 모든 중단원을 삭제하시겠습니까?`)) {
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
                  <div className="divide-y divide-gray-100">
                    {group.items.length === 0 ? (
                      <div className="px-3 py-4 text-center text-sm text-gray-500">
                        중단원이 없습니다. "+ 중단원" 버튼을 클릭하여 추가하세요.
                      </div>
                    ) : (
                      group.items.map((item, itemIndex) => (
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
                                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>
                            <div className="text-xs text-gray-500 min-w-[40px]">
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
                      ))
                    )}
                  </div>
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
