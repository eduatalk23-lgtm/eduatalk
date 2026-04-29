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
import {
  StudentDetailPanel,
  type StudentDetailTabKey,
} from "./detail-panel/StudentDetailPanel";

type FormMode = "register" | "selected";

const VALID_TABS: StudentDetailTabKey[] = [
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
  const initialTabParam = searchParams.get("panel");
  const initialTab: StudentDetailTabKey | null =
    initialTabParam &&
    VALID_TABS.includes(initialTabParam as StudentDetailTabKey)
      ? (initialTabParam as StudentDetailTabKey)
      : null;

  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<StudentSearchFilters>({ status: "enrolled" });
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    initialStudentId,
  );
  const [formMode, setFormMode] = useState<FormMode>(
    initialStudentId ? "selected" : "register",
  );
  const [activeTab, setActiveTab] = useState<StudentDetailTabKey | null>(
    initialStudentId ? initialTab : null,
  );

  const debouncedQuery = useDebounce(searchQuery, 300);

  const searchResult = useQuery(studentSearchQueryOptions(debouncedQuery, filters));

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

  // URL 동기화 — selectedStudentId · activeTab 변경 시 mirror
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const params = new URLSearchParams();
    if (selectedStudentId) params.set("studentId", selectedStudentId);
    if (selectedStudentId && activeTab) params.set("panel", activeTab);
    const next = params.toString();
    router.replace(next ? `?${next}` : "?", { scroll: false });
  }, [selectedStudentId, activeTab, router]);

  const handleSelectStudent = useCallback((studentId: string) => {
    setSelectedStudentId((prev) => {
      if (prev !== studentId) setActiveTab(null);
      return studentId;
    });
    setFormMode("selected");
  }, []);

  const handleNewStudent = useCallback(() => {
    setSelectedStudentId(null);
    setActiveTab(null);
    setFormMode("register");
  }, []);

  const handleStudentSaved = useCallback((studentId: string) => {
    setSelectedStudentId(studentId);
    setFormMode("selected");
  }, []);

  const handleStudentDeleted = useCallback(() => {
    setSelectedStudentId(null);
    setActiveTab(null);
    setFormMode("register");
  }, []);

  const openTab = useCallback(
    (tab: StudentDetailTabKey) => {
      if (selectedStudentId) setActiveTab(tab);
    },
    [selectedStudentId],
  );

  const closePanel = useCallback(() => {
    setActiveTab(null);
  }, []);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
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

        <StudentFormPanel
          selectedStudentId={selectedStudentId}
          studentData={studentData}
          isLoading={isDetailLoading}
          formMode={formMode}
          onNewStudent={handleNewStudent}
          onStudentSaved={handleStudentSaved}
          onStudentDeleted={handleStudentDeleted}
          onOpenEnrollment={() => openTab("enrollment")}
          onOpenFamily={() => openTab("family")}
          onOpenConsultation={() => openTab("consultation")}
          onOpenScore={() => openTab("score")}
          onOpenTimeManagement={() => openTab("time")}
          onOpenSMS={() => openTab("sms")}
          isAdmin={isAdmin}
        />
      </div>

      {selectedStudentId && (
        <StudentDetailPanel
          studentId={selectedStudentId}
          studentName={studentData?.name ?? "학생"}
          studentLabel={studentLabel}
          activeTab={activeTab}
          onClose={closePanel}
          onTabChange={setActiveTab}
        />
      )}
    </>
  );
}
