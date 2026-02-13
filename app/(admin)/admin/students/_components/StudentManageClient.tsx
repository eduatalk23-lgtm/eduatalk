"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/lib/hooks/useDebounce";
import {
  studentSearchQueryOptions,
  studentDetailQueryOptions,
} from "@/lib/query-options/students";
import { StudentSearchPanel } from "./StudentSearchPanel";
import { StudentFormPanel } from "./StudentFormPanel";
import { EnrollmentSlidePanel } from "./EnrollmentSlidePanel";
import { FamilySlidePanel } from "./FamilySlidePanel";
import { ConsultationSlidePanel } from "./ConsultationSlidePanel";

type FormMode = "register" | "selected";

type StudentManageClientProps = {
  isAdmin: boolean;
};

export function StudentManageClient({ isAdmin }: StudentManageClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    null
  );
  const [formMode, setFormMode] = useState<FormMode>("register");
  const [enrollmentPanelStudentId, setEnrollmentPanelStudentId] = useState<string | null>(null);
  const [isEnrollmentPanelOpen, setIsEnrollmentPanelOpen] = useState(false);
  const [familyPanelStudentId, setFamilyPanelStudentId] = useState<string | null>(null);
  const [isFamilyPanelOpen, setIsFamilyPanelOpen] = useState(false);
  const [consultationPanelStudentId, setConsultationPanelStudentId] = useState<string | null>(null);
  const [isConsultationPanelOpen, setIsConsultationPanelOpen] = useState(false);

  const debouncedQuery = useDebounce(searchQuery, 300);

  // 검색 쿼리
  const searchResult = useQuery(studentSearchQueryOptions(debouncedQuery));

  // 상세 조회 쿼리
  const detailResult = useQuery({
    ...studentDetailQueryOptions(selectedStudentId ?? ""),
    enabled: !!selectedStudentId,
    placeholderData: undefined, // 학생 전환 시 이전 캐시 데이터 표시 방지
  });

  const students = searchResult.data?.students ?? [];
  const total = searchResult.data?.total ?? 0;
  const studentData = detailResult.data?.data ?? null;
  const isDetailLoading = detailResult.isFetching; // isLoading 대신 isFetching 사용 (캐시 stale 포함)

  // 슬라이드 패널 타이틀용 학생 라벨: "고등부 1학년 김지혁 강릉명륜고등학교"
  const studentLabel = studentData
    ? [studentData.division, studentData.grade ? `${studentData.grade}학년` : null, studentData.name, studentData.school_name]
        .filter(Boolean)
        .join(" ")
    : undefined;

  // 학생 선택
  const handleSelectStudent = useCallback((studentId: string) => {
    setSelectedStudentId(studentId);
    setFormMode("selected");
  }, []);

  // 신규등록 모드
  const handleNewStudent = useCallback(() => {
    setSelectedStudentId(null);
    setFormMode("register");
  }, []);

  // 저장 완료 후
  const handleStudentSaved = useCallback((studentId: string) => {
    setSelectedStudentId(studentId);
    setFormMode("selected");
  }, []);

  // 삭제 완료 후
  const handleStudentDeleted = useCallback(() => {
    setSelectedStudentId(null);
    setFormMode("register");
  }, []);

  // 수강/수납 슬라이드 패널 열기/닫기
  const handleOpenEnrollment = useCallback(() => {
    if (selectedStudentId) {
      setEnrollmentPanelStudentId(selectedStudentId);
      setIsEnrollmentPanelOpen(true);
    }
  }, [selectedStudentId]);

  const handleCloseEnrollment = useCallback(() => {
    setIsEnrollmentPanelOpen(false);
  }, []);

  // 가족 슬라이드 패널 열기/닫기
  const handleOpenFamily = useCallback(() => {
    if (selectedStudentId) {
      setFamilyPanelStudentId(selectedStudentId);
      setIsFamilyPanelOpen(true);
    }
  }, [selectedStudentId]);

  const handleCloseFamily = useCallback(() => {
    setIsFamilyPanelOpen(false);
  }, []);

  // 상담 슬라이드 패널 열기/닫기
  const handleOpenConsultation = useCallback(() => {
    if (selectedStudentId) {
      setConsultationPanelStudentId(selectedStudentId);
      setIsConsultationPanelOpen(true);
    }
  }, [selectedStudentId]);

  const handleCloseConsultation = useCallback(() => {
    setIsConsultationPanelOpen(false);
  }, []);

  return (
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
        onOpenEnrollment={handleOpenEnrollment}
        onOpenFamily={handleOpenFamily}
        onOpenConsultation={handleOpenConsultation}
        isAdmin={isAdmin}
      />

      {enrollmentPanelStudentId && (
        <EnrollmentSlidePanel
          studentId={enrollmentPanelStudentId}
          studentLabel={studentLabel}
          isOpen={isEnrollmentPanelOpen}
          onClose={handleCloseEnrollment}
        />
      )}

      {familyPanelStudentId && (
        <FamilySlidePanel
          studentId={familyPanelStudentId}
          studentLabel={studentLabel}
          isOpen={isFamilyPanelOpen}
          onClose={handleCloseFamily}
        />
      )}

      {consultationPanelStudentId && (
        <ConsultationSlidePanel
          studentId={consultationPanelStudentId}
          studentLabel={studentLabel}
          isOpen={isConsultationPanelOpen}
          onClose={handleCloseConsultation}
        />
      )}
    </div>
  );
}
