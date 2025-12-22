"use client";

import { useMemo, useState, useRef } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Plan } from "@/app/(student)/plan/new-group/_components/_features/scheduling/components/scheduleTypes";
import type { ContentData } from "@/app/(student)/plan/new-group/_components/utils/scheduleTransform";
import { formatPlanTime, formatPlanLearningAmount, formatPlanDateShort } from "@/lib/utils/planFormatting";
import { timeToMinutes } from "@/lib/utils/time";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";

/**
 * 테이블 뷰용 플랜 행 데이터 타입
 */
type PlanTableRow = {
  id: string;
  plan_date: string;
  start_time: string;
  end_time: string;
  subject_category: string | null;
  subject: string | null;
  content_type: "book" | "lecture" | "custom";
  content_title: string | null;
  chapter: string | null;
  plan_number: number | null; // plan_number 우선 사용
  sequence: number | null; // 하위 호환성
  planned_start_page_or_time: number | null;
  planned_end_page_or_time: number | null;
  duration_minutes: number; // 계산된 값
  subject_type?: "strategy" | "weakness" | null; // 전략/취약 정보
};

type PlanListViewProps = {
  plans: Plan[];
  contents: Map<string, ContentData>;
  isLoading?: boolean;
};

/**
 * 배치된 플랜만 보는 전용 테이블 뷰 컴포넌트
 * - 학원, 이동, 점심, 자율 제외
 * - start_time과 end_time이 모두 있는 플랜만 표시
 */
export function PlanListView({ plans, contents, isLoading = false }: PlanListViewProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "plan_date", desc: false },
    { id: "start_time", desc: false },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // 배치된 플랜만 필터링
  const filteredPlans = useMemo(() => {
    return plans.filter((plan) => {
      // content_type이 'custom'이 아니고 시간 정보가 있는 플랜만
      if (plan.content_type === "custom") {
        return false;
      }
      // start_time과 end_time이 모두 있어야 함
      if (!plan.start_time || !plan.end_time) {
        return false;
      }
      return true;
    });
  }, [plans]);

  // 테이블 뷰용 데이터 변환
  const tableData = useMemo<PlanTableRow[]>(() => {
    return filteredPlans.map((plan) => {
      const content = contents.get(plan.content_id);
      
      // 소요시간 계산: start_time과 end_time이 있으면 사용, 없으면 콘텐츠 정보 기반으로 계산
      let durationMinutes = 0;
      if (plan.start_time && plan.end_time) {
        durationMinutes = timeToMinutes(plan.end_time) - timeToMinutes(plan.start_time);
      } else if (content && plan.planned_start_page_or_time !== null && plan.planned_end_page_or_time !== null) {
        // 시간 정보가 없으면 콘텐츠 정보 기반으로 계산
        if (plan.content_type === "lecture" && content.episodes) {
          // 강의의 경우 episode별 duration 합산
          const startEpisode = plan.planned_start_page_or_time;
          const endEpisode = plan.planned_end_page_or_time;
          let totalDuration = 0;
          for (let i = startEpisode; i <= endEpisode; i++) {
            const episode = content.episodes.find((ep) => ep.episode_number === i);
            if (episode && episode.duration !== null && episode.duration > 0) {
              totalDuration += episode.duration;
            } else {
              // episode 정보가 없으면 기본값 30분 사용
              totalDuration += 30;
            }
          }
          durationMinutes = totalDuration;
        } else if (plan.content_type === "book" && content.total_pages) {
          // 교재의 경우 페이지 수 기반 계산 (60페이지/시간 가정)
          const pages = plan.planned_end_page_or_time - plan.planned_start_page_or_time + 1;
          durationMinutes = Math.round((pages / 60) * 60); // 분 단위
        }
      }

      // 학습 내역: contentEpisode 우선, 없으면 chapter 사용
      const learningHistory = plan.contentEpisode || plan.chapter || null;

      return {
        id: plan.id,
        plan_date: plan.plan_date,
        start_time: plan.start_time || "",
        end_time: plan.end_time || "",
        subject_category: content?.subject_category || null,
        subject: content?.subject || null,
        content_type: plan.content_type as "book" | "lecture" | "custom",
        content_title: content?.title || null,
        chapter: learningHistory,
        plan_number: plan.plan_number ?? null, // plan_number 우선
        sequence: plan.sequence || null, // 하위 호환성
        planned_start_page_or_time: plan.planned_start_page_or_time,
        planned_end_page_or_time: plan.planned_end_page_or_time,
        duration_minutes: durationMinutes,
        subject_type: plan.subject_type || null,
      };
    });
  }, [filteredPlans, contents]);

  // 컬럼 정의
  const columns = useMemo<ColumnDef<PlanTableRow>[]>(
    () => [
      {
        accessorKey: "plan_date",
        header: "날짜",
        cell: ({ row }) => formatPlanDateShort(row.original.plan_date),
        enableSorting: true,
        size: 120,
      },
      {
        accessorKey: "start_time",
        header: "시간",
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.start_time} ~ {row.original.end_time}
          </span>
        ),
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const timeA = timeToMinutes(rowA.original.start_time);
          const timeB = timeToMinutes(rowB.original.start_time);
          return timeA - timeB;
        },
        size: 120,
      },
      {
        accessorKey: "subject_category",
        header: "교과",
        cell: ({ row }) => row.original.subject_category || "-",
        enableSorting: true,
        size: 100,
      },
      {
        accessorKey: "subject",
        header: "과목",
        cell: ({ row }) => row.original.subject || "-",
        enableSorting: true,
        size: 100,
      },
      {
        accessorKey: "content_type",
        header: "유형",
        cell: ({ row }) => (row.original.content_type === "book" ? "교재" : "강의"),
        enableSorting: true,
        size: 80,
      },
      {
        accessorKey: "content_title",
        header: "콘텐츠명",
        cell: ({ row }) => {
          const subjectType = row.original.subject_type;
          const contentTitle = row.original.content_title || "-";
          
          // 전략/취약 배지 컴포넌트
          const Badge = ({ type }: { type: "strategy" | "weakness" }) => {
            const config = {
              strategy: {
                label: "전략",
                className: "bg-blue-100 text-blue-800",
              },
              weakness: {
                label: "취약",
                className: "bg-red-100 text-red-800",
              },
            };
            const { label, className } = config[type];
            
            return (
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium mr-1 ${className}`}
              >
                {label}
              </span>
            );
          };
          
          return (
            <div className="max-w-[200px] truncate flex items-center gap-1" title={contentTitle}>
              {subjectType === "strategy" && <Badge type="strategy" />}
              {subjectType === "weakness" && <Badge type="weakness" />}
              <span>{contentTitle}</span>
            </div>
          );
        },
        enableSorting: true,
        size: 200,
      },
      {
        accessorKey: "chapter",
        header: "학습내역",
        cell: ({ row }) => (
          <div className="max-w-[200px] truncate" title={row.original.chapter || ""}>
            {row.original.chapter || "-"}
          </div>
        ),
        enableSorting: true,
        size: 200,
      },
      {
        accessorKey: "plan_number",
        header: "회차",
        cell: ({ row }) => {
          // plan_number 우선, 없으면 sequence 사용
          const planNumber = row.original.plan_number ?? row.original.sequence;
          return planNumber !== null ? planNumber : "-";
        },
        enableSorting: true,
        size: 80,
      },
      {
        accessorKey: "planned_start_page_or_time",
        header: "학습 분량",
        cell: ({ row }) =>
          formatPlanLearningAmount({
            content_type: row.original.content_type,
            planned_start_page_or_time: row.original.planned_start_page_or_time,
            planned_end_page_or_time: row.original.planned_end_page_or_time,
          }),
        enableSorting: false,
        size: 120,
      },
      {
        accessorKey: "duration_minutes",
        header: "소요시간",
        cell: ({ row }) => formatPlanTime(row.original.duration_minutes),
        enableSorting: true,
        size: 100,
      },
    ],
    []
  );

  // TanStack Table 설정
  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
  });

  // 가상 스크롤링 설정 (100개 이상일 때)
  const { rows } = table.getRowModel();
  const shouldUseVirtualScrolling = rows.length >= 100;

  const parentRef = useRef<HTMLDivElement>(null);

  // Hook must be called unconditionally
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50, // 행 높이 추정값
    overscan: 10, // 화면 밖 렌더링할 행 수
    enabled: shouldUseVirtualScrolling, // Only enable when needed
  });

  if (isLoading) {
    return <LoadingSkeleton variant="schedule" />;
  }

  if (tableData.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
        <p className="text-sm text-gray-800">배치된 플랜이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-800">
          총 {tableData.length}개의 배치된 플랜이 있습니다.
        </p>
      </div>

      <div className="overflow-auto rounded-lg border border-blue-200">
        <table className="w-full text-xs border-collapse border border-blue-200">
          <thead className="sticky top-0 bg-blue-100 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-3 py-2 text-center border border-blue-200 font-semibold text-blue-800"
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        className={
                          header.column.getCanSort()
                            ? "cursor-pointer select-none hover:bg-blue-200"
                            : ""
                        }
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {{
                          asc: " ↑",
                          desc: " ↓",
                        }[header.column.getIsSorted() as string] ?? null}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          {shouldUseVirtualScrolling ? (
            // 가상 스크롤링 사용 (100개 이상)
            <tbody>
              <tr>
                <td colSpan={columns.length} className="p-0">
                  <div
                    ref={parentRef}
                    className="h-[600px] overflow-auto"
                  >
                    <div
                      style={{
                        height: `${virtualizer.getTotalSize()}px`,
                        width: "100%",
                        position: "relative",
                      }}
                    >
                      {virtualizer.getVirtualItems().map((virtualRow) => {
                        const row = rows[virtualRow.index];
                        return (
                          <div
                            key={row.id}
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              width: "100%",
                              height: `${virtualRow.size}px`,
                              transform: `translateY(${virtualRow.start}px)`,
                            }}
                            className="border-b border-blue-200"
                          >
                            <div className="flex">
                              {row.getVisibleCells().map((cell) => (
                                <div
                                  key={cell.id}
                                  className="px-3 py-2 border-r border-blue-200 text-blue-800 flex-shrink-0"
                                  style={{ width: cell.column.getSize() }}
                                >
                                  {flexRender(
                                    cell.column.columnDef.cell,
                                    cell.getContext()
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          ) : (
            // 일반 렌더링 (100개 미만)
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-blue-50">
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-3 py-2 border border-blue-200 text-blue-800"
                      style={{ width: cell.column.getSize() }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
}

