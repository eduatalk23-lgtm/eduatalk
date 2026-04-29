"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useDebounce } from "@/lib/hooks/useDebounce";
import {
  studentSearchQueryOptions,
  studentDetailQueryOptions,
} from "@/lib/query-options/students";
import type { StudentSearchFilters } from "@/lib/domains/student/actions/search";
import { StudentSearchPanel } from "./StudentSearchPanel";
import { StudentFormPanel } from "./StudentFormPanel";
import { EnrollmentSlidePanel } from "./EnrollmentSlidePanel";
import { FamilySlidePanel } from "./FamilySlidePanel";
import { ConsultationSlidePanel } from "./ConsultationSlidePanel";
import { ScoreSlidePanel } from "./ScoreSlidePanel";
import { TimeManagementSlidePanel } from "./TimeManagementSlidePanel";
import { SMSSlidePanel } from "./SMSSlidePanel";

type FormMode = "register" | "selected";
export type StudentPanelKey =
  | "enrollment"
  | "family"
  | "consultation"
  | "score"
  | "time"
  | "sms";

const VALID_PANELS: StudentPanelKey[] = [
  "enrollment",
  "family",
  "consultation",
  "score",
  "time",
  "sms",
];

type StudentManageClientProps = {
  isAdmin: boolean;
};

export function StudentManageClient({ isAdmin }: StudentManageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL → 초기 상태
  const initialStudentId = searchParams.get("studentId");
  const initialPanelParam = searchParams.get("panel");
  const initialPanel: StudentPanelKey | null =
    initialPanelParam && VALID_PANELS.includes(initialPanelParam as StudentPanelKey)
      ? (initialPanelParam as StudentPanelKey)
      : null;

  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<StudentSearchFilters>({ status: "enrolled" });
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    initialStudentId,
  );
  const [formMode, setFormMode] = useState<FormMode>(
    initialStudentId ? "selected" : "register",
  );
  const [activePanel, setActivePanel] = useState<StudentPanelKey | null>(
    initialStudentId ? initialPanel : null,
  );

  const debouncedQuery = useDebounce(searchQuery, 300);

  // 검색 쿼리
  const searchResult = useQuery(studentSearchQueryOptions(debouncedQuery, filters));

  // 상세 조회 쿼리
  const detailResult = useQuery({
    ...studentDetailQueryOptions(selectedStudentId ?? ""),
    enabled: !!selectedStudentId,
    placeholderData: undefined,
  });

  const students = searchResult.data?.students ?? [];
  const total = searchResult.data?.total ?? 0;
  const studentData = detailResult.data?.data ?? null;
  const isDetailLoading = detailResult.isFetching;

  const studentLabel = studentData
    ? [studentData.division, studentData.grade ? `${studentData.grade}학년` : null, studentData.name, studentData.school_name]
        .filter(Boolean)
        .join(" ")
    : undefined;

  // URL 동기화 — selectedStudentId · activePanel 변경 시 ?studentId=&panel= 갱신
  // (router.replace 로 history 오염 없이)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const params = new URLSearchParams();
    if (selectedStudentId) params.set("studentId", selectedStudentId);
    if (selectedStudentId && activePanel) params.set("panel", activePanel);
    const next = params.toString();
    router.replace(next ? `?${next}` : "?", { scroll: false });
  }, [selectedStudentId, activePanel, router]);

  // 학생 선택 — 다른 학생 선택 시 열린 패널 닫음
  const handleSelectStudent = useCallback((studentId: string) => {
    setSelectedStudentId((prev) => {
      if (prev !== studentId) setActivePanel(null);
      return studentId;
    });
    setFormMode("selected");
  }, []);

  const handleNewStudent = useCallback(() => {
    setSelectedStudentId(null);
    setActivePanel(null);
    setFormMode("register");
  }, []);

  const handleStudentSaved = useCallback((studentId: string) => {
    setSelectedStudentId(studentId);
    setFormMode("selected");
  }, []);

  const handleStudentDeleted = useCallback(() => {
    setSelectedStudentId(null);
    setActivePanel(null);
    setFormMode("register");
  }, []);

  // 패널 열기 — 단일 활성 강제 (이전 패널 자동 닫힘)
  const openPanel = useCallback(
    (key: StudentPanelKey) => {
      if (selectedStudentId) setActivePanel(key);
    },
    [selectedStudentId],
  );

  const closePanel = useCallback(() => {
    setActivePanel(null);
  }, []);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        {/* 왼쪽: 검색 패널 */}
        <StudentSearchPanel
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          students={students}
          total={total}
          isLoading={searchResult.isLoading}
          selectedStudentId={selectedStudentId}
          onSelectStudent={handleSelectStudent}
          filters={filters}
          onFiltersChange={setFilters}
        />

        {/* 오른쪽: 폼 패널 */}
        <StudentFormPanel
          selectedStudentId={selectedStudentId}
          studentData={studentData}
          isLoading={isDetailLoading}
          formMode={formMode}
          onNewStudent={handleNewStudent}
          onStudentSaved={handleStudentSaved}
          onStudentDeleted={handleStudentDeleted}
          onOpenEnrollment={() => openPanel("enrollment")}
          onOpenFamily={() => openPanel("family")}
          onOpenConsultation={() => openPanel("consultation")}
          onOpenScore={() => openPanel("score")}
          onOpenTimeManagement={() => openPanel("time")}
          onOpenSMS={() => openPanel("sms")}
          isAdmin={isAdmin}
        />
      </div>

      {/* 단일 활성 패널 — selectedStudentId 가 있을 때만 마운트 */}
      {selectedStudentId && (
        <>
          <EnrollmentSlidePanel
            studentId={selectedStudentId}
            studentLabel={studentLabel}
            isOpen={activePanel === "enrollment"}
            onClose={closePanel}
          />
          <FamilySlidePanel
            studentId={selectedStudentId}
            studentLabel={studentLabel}
            isOpen={activePanel === "family"}
            onClose={closePanel}
          />
          <ConsultationSlidePanel
            studentId={selectedStudentId}
            studentLabel={studentLabel}
            isOpen={activePanel === "consultation"}
            onClose={closePanel}
          />
          <ScoreSlidePanel
            studentId={selectedStudentId}
            studentLabel={studentLabel}
            isOpen={activePanel === "score"}
            onClose={closePanel}
          />
          <TimeManagementSlidePanel
            studentId={selectedStudentId}
            studentLabel={studentLabel}
            isOpen={activePanel === "time"}
            onClose={closePanel}
          />
          <SMSSlidePanel
            studentId={selectedStudentId}
            studentName={studentData?.name ?? "학생"}
            studentLabel={studentLabel}
            isOpen={activePanel === "sms"}
            onClose={closePanel}
          />
        </>
      )}
    </>
  );
}
