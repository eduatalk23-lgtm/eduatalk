"use client";

import { useState, useMemo } from "react";
import { BookDetail } from "@/lib/types/plan";

type BookDetailsDisplayProps = {
  details: BookDetail[];
};

type GroupedDetails = {
  majorUnit: string;
  items: BookDetail[];
};

export function BookDetailsDisplay({ details }: BookDetailsDisplayProps) {
  // 대단원별로 그룹화
  const groupedDetails = useMemo(() => {
    const groups = new Map<string, BookDetail[]>();

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

  // 토글 상태 관리 (기본적으로 모두 펼침)
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

  if (groupedDetails.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4 border-t pt-8">
      <h3 className="text-lg font-semibold text-gray-900">교재 목차</h3>
      <div className="flex flex-col gap-2">
        {groupedDetails.map((group) => {
          const isExpanded = expandedGroups.has(group.majorUnit);
          const hasMinorUnits = group.items.some((item) => item.minor_unit);

          return (
            <div
              key={group.majorUnit}
              className="rounded-md border border-gray-200 bg-white overflow-hidden"
            >
              {/* 대단원 헤더 */}
              <div className="flex items-center gap-2 bg-gray-50 px-4 py-3 border-b border-gray-200">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.majorUnit)}
                  className="flex items-center gap-2 flex-1 text-left hover:bg-gray-100 -mx-4 px-4 py-2 rounded-md transition"
                >
                  <span className="text-gray-500 text-sm">
                    {isExpanded ? "▼" : "▶"}
                  </span>
                  <span className="font-semibold text-gray-900">
                    {group.majorUnit === "(대단원 없음)" ? "기타" : group.majorUnit}
                  </span>
                  {hasMinorUnits && (
                    <span className="text-xs text-gray-500">
                      ({group.items.filter((i) => i.minor_unit).length}개 중단원)
                    </span>
                  )}
                </button>
              </div>

              {/* 중단원 목록 */}
              {isExpanded && (
                <div className="divide-y divide-gray-100">
                  {group.items.length === 0 ? (
                    <div className="px-4 py-4 text-center text-sm text-gray-500">
                      중단원이 없습니다.
                    </div>
                  ) : (
                    group.items.map((item, itemIndex) => (
                      <div
                        key={item.id || itemIndex}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50"
                      >
                        <span className="text-gray-400 text-sm w-6">└</span>
                        <div className="flex-1">
                          <span className="text-sm text-gray-900">
                            {item.minor_unit || "—"}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 min-w-[60px] text-right">
                          {item.page_number ? `${item.page_number}p` : "—"}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

