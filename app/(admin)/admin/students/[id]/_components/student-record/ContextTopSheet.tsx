"use client";

// ============================================
// 학생 전체 컨텍스트 탑시트
// z-index 오버레이, 가로 100%, 위에서 아래로 슬라이드
// 기존 layer-view/BottomSheet의 13개 탭 콘텐츠 재사용
// ============================================

import { useEffect, useState, useMemo } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { X } from "lucide-react";
import { useStudentRecordContext } from "./StudentRecordContext";
import {
  recordTabQueryOptions,
  diagnosisTabQueryOptions,
  storylineTabQueryOptions,
} from "@/lib/query-options/studentRecord";
import { calculateSchoolYear, gradeToSchoolYear } from "@/lib/utils/schoolYear";
import { TAB_GROUPS, TabContent } from "./ContextTabContent";
import type { TabId } from "./ContextTabContent";
import type { RecordTabData } from "@/lib/domains/student-record/types";
import type { LayerGuideAssignment, LayerActivityTag, LayerSetekGuide } from "./ContextTabContent";

interface ContextTopSheetProps {
  isOpen: boolean;
  onClose: () => void;
  studentGrade: number;
  initialSchoolYear: number;
}

export function ContextTopSheet({ isOpen, onClose, studentGrade, initialSchoolYear }: ContextTopSheetProps) {
  const { studentId, tenantId } = useStudentRecordContext();
  const [visible, setVisible] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("competency");

  // 열기/닫기 애니메이션 (렌더 중 상태 조정 + 비동기 transition)
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) setVisible(true);
    else setAnimateIn(false);
  }

  useEffect(() => {
    if (isOpen) {
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimateIn(true));
      });
      return () => cancelAnimationFrame(raf);
    }
    // 닫기: CSS transition 후 DOM 제거
    const t = setTimeout(() => setVisible(false), 300);
    return () => clearTimeout(t);
  }, [isOpen]);

  // Escape로 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // 학년-연도 쌍
  const currentSchoolYear = calculateSchoolYear();
  const yearGradePairs = useMemo(() => {
    const pairs: Array<{ grade: number; schoolYear: number }> = [];
    for (let g = 1; g <= studentGrade; g++) {
      pairs.push({ grade: g, schoolYear: gradeToSchoolYear(g, studentGrade, currentSchoolYear) });
    }
    return pairs;
  }, [studentGrade, currentSchoolYear]);

  // 다년도 record 쿼리 (캐시 재사용)
  const recordQueries = useQueries({
    queries: yearGradePairs.map((p) => recordTabQueryOptions(studentId, p.schoolYear)),
  });

  const recordByGrade = useMemo(() => {
    const map = new Map<number, { data: RecordTabData }>();
    yearGradePairs.forEach((p, i) => {
      const q = recordQueries[i];
      if (q.data) map.set(p.grade, { data: q.data });
    });
    return map;
  }, [yearGradePairs, recordQueries]);

  // 진단 + 스토리라인 (캐시 재사용)
  const { data: diagnosisData } = useQuery(
    diagnosisTabQueryOptions(studentId, initialSchoolYear, tenantId),
  );
  const { data: storylineData } = useQuery(
    storylineTabQueryOptions(studentId, initialSchoolYear),
  );

  // 가이드 배정, 활동 태그, 세특 가이드 집계
  const { guideAssignments, activityTags, setekGuides } = useMemo(() => {
    const ga: LayerGuideAssignment[] = [];
    const at: LayerActivityTag[] = [];
    const sg: LayerSetekGuide[] = [];

    if (diagnosisData?.activityTags) {
      for (const t of diagnosisData.activityTags as LayerActivityTag[]) {
        at.push(t);
      }
    }

    return { guideAssignments: ga, activityTags: at, setekGuides: sg };
  }, [diagnosisData]);

  if (!visible) return null;

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] transition-opacity duration-300",
          animateIn ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
      />

      {/* 탑시트 */}
      <div
        className={cn(
          "fixed inset-x-0 top-0 z-50 flex flex-col rounded-b-2xl border-b border-gray-200 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-out dark:border-gray-700 dark:bg-gray-900",
          animateIn ? "translate-y-0" : "-translate-y-full",
        )}
        style={{ height: "80vh" }}
      >
        {/* 헤더 */}
        <div className="flex-shrink-0 border-b border-gray-100 px-5 pt-4 pb-3 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">학생 컨텍스트</h3>
            <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[11px] font-medium text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
              전체 맥락
            </span>
            <button
              type="button"
              onClick={onClose}
              className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* 탭 바 */}
          <div className="mt-3 flex items-center gap-0.5 overflow-x-auto">
            {TAB_GROUPS.map((group, gi) => (
              <div key={group.label} className="flex shrink-0 items-center gap-0.5">
                {gi > 0 && <div className="mx-1.5 h-4 w-px bg-gray-200 dark:bg-gray-700" />}
                {group.tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as TabId)}
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                      activeTab === tab.id
                        ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                        : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800",
                    )}
                  >
                    {tab.emoji} {tab.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* 탭 콘텐츠 */}
        <div className="flex-1 overflow-y-auto hide-scrollbar p-5">
          <TabContent
            tabId={activeTab}
            studentId={studentId}
            recordByGrade={recordByGrade}
            guideAssignments={guideAssignments}
            activityTags={activityTags}
            setekGuides={setekGuides}
            diagnosisData={diagnosisData}
            storylineData={storylineData}
            tenantId={tenantId}
          />
        </div>

        {/* 하단 핸들 */}
        <div className="flex-shrink-0 flex justify-center pb-3 pt-1">
          <div className="h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>
      </div>
    </>
  );
}
