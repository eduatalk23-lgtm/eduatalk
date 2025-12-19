"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { sendCampInvitationsAction } from "@/app/(admin)/actions/campTemplateActions";
import { useToast } from "@/components/ui/ToastProvider";
import { filterStudents, extractUniqueGrades, extractUniqueClasses, type Student, type StudentFilter } from "@/lib/utils/studentFilterUtils";
import { ProgressBar } from "@/components/atoms/ProgressBar";

type StudentInvitationFormProps = {
  templateId: string;
  templateStatus?: "draft" | "active" | "archived";
  onInvitationSent?: () => void;
};

export function StudentInvitationForm({ templateId, templateStatus, onInvitationSent }: StudentInvitationFormProps) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<StudentFilter>({
    search: "",
    grade: "",
    class: "",
    isActive: "all",
  });
  const [loading, setLoading] = useState(true);
  
  // 발송 진행 상황 상태
  const [sendingProgress, setSendingProgress] = useState<{
    isSending: boolean;
    total: number;
    processed: number;
    success: number;
    failed: number;
    failedStudents: Array<{ id: string; name: string; error: string }>;
  } | null>(null);

  // 학생 목록 로드 (useCallback으로 메모이제이션)
  const loadStudents = useCallback(async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      
      // 1. 모든 학생 목록 조회 (phone 컬럼은 students 테이블에 없으므로 제거)
      const { data: allStudents, error: studentsError } = await supabase
        .from("students")
        .select("id, name, grade, class, division, is_active")
        .order("name", { ascending: true })
        .limit(100);

      // 에러 체크: null이 아니고, 실제로 에러 속성이 있는지 확인
      if (studentsError && (studentsError.message || studentsError.code || Object.keys(studentsError).length > 0)) {
        // 에러 객체의 속성을 안전하게 추출하여 로깅
        const errorInfo: Record<string, unknown> = {};
        
        // 기본 속성 추출
        if (studentsError.message) {
          errorInfo.message = studentsError.message;
        }
        if (studentsError.code) {
          errorInfo.code = studentsError.code;
        }
        if (studentsError.details) {
          errorInfo.details = studentsError.details;
        }
        if (studentsError.hint) {
          errorInfo.hint = studentsError.hint;
        }
        
        // 에러 객체의 모든 열거 가능한 속성 추출
        try {
          Object.keys(studentsError).forEach((key) => {
            const value = (studentsError as Record<string, unknown>)[key];
            // 순환 참조 방지 및 직렬화 가능한 값만 포함
            if (value !== null && typeof value !== "function" && typeof value !== "object") {
              errorInfo[key] = value;
            } else if (typeof value === "object" && value !== null) {
              try {
                // 객체인 경우 JSON 직렬화 시도
                JSON.stringify(value);
                errorInfo[key] = value;
              } catch {
                // 직렬화 불가능한 경우 문자열로 변환
                errorInfo[key] = String(value);
              }
            }
          });
        } catch (e) {
          // 속성 추출 실패 시 최소한의 정보라도 로깅
          errorInfo.errorString = String(studentsError);
        }
        
        // 에러 타입 정보 추가
        errorInfo.errorType = typeof studentsError;
        errorInfo.errorConstructor = studentsError.constructor?.name || "Unknown";
        errorInfo.keys = Object.keys(studentsError);
        errorInfo.allProperties = Object.getOwnPropertyNames(studentsError);
        
        // 직렬화 시도 (디버깅용)
        try {
          errorInfo.serialized = JSON.stringify(studentsError, Object.getOwnPropertyNames(studentsError));
        } catch (e) {
          errorInfo.serialized = "직렬화 실패: " + (e instanceof Error ? e.message : String(e));
        }
        
        // 개별 속성을 먼저 로깅 (가장 중요)
        console.error("학생 목록 조회 실패 - 메시지:", studentsError.message || "없음");
        console.error("학생 목록 조회 실패 - 코드:", studentsError.code || "없음");
        console.error("학생 목록 조회 실패 - 상세 정보:", errorInfo);
        console.error("학생 목록 조회 실패 - 원본 에러 객체:", studentsError);
        
        // 에러 메시지가 있는 경우 사용, 없으면 기본 메시지
        const errorMessage = studentsError.message 
          ? `학생 목록을 불러오는데 실패했습니다: ${studentsError.message}`
          : studentsError.code
          ? `학생 목록을 불러오는데 실패했습니다 (코드: ${studentsError.code})`
          : "학생 목록을 불러오는데 실패했습니다.";
        
        toast.showError(errorMessage);
        setLoading(false);
        return;
      }

      // 데이터가 null인 경우 처리
      if (allStudents === null) {
        console.warn("학생 목록이 null로 반환되었습니다.");
        setStudents([]);
        setLoading(false);
        return;
      }

      // 2. 이미 초대된 학생 ID 조회
      const { data: invitations, error: invitationsError } = await supabase
        .from("camp_invitations")
        .select("student_id")
        .eq("camp_template_id", templateId);

      if (invitationsError) {
        // 에러 객체의 세부 정보를 포함하여 로깅
        const errorDetails = {
          message: invitationsError.message,
          code: invitationsError.code,
          details: invitationsError.details,
          hint: invitationsError.hint,
          error: invitationsError,
        };
        console.error("초대 목록 조회 실패:", errorDetails);
        // 초대 목록 조회 실패해도 학생 목록은 표시
      }

      // 3. 이미 초대된 학생 ID Set 생성
      const invitedStudentIds = new Set(
        (invitations || []).map((inv) => inv.student_id)
      );

      // 4. 이미 초대되지 않은 학생만 필터링
      const availableStudents = (allStudents || []).filter(
        (student) => !invitedStudentIds.has(student.id)
      );

      // 5. 전화번호 정보 별도 조회 (student_profiles 테이블에서)
      const studentIds = availableStudents.map((s) => s.id);
      let phoneDataMap = new Map<string, {
        phone: string | null;
        mother_phone: string | null;
        father_phone: string | null;
      }>();
      
      if (studentIds.length > 0) {
        try {
          // student_profiles 테이블에서 전화번호 조회
          const { data: profilesData, error: profilesError } = await supabase
            .from("student_profiles")
            .select("id, phone, mother_phone, father_phone")
            .in("id", studentIds);

          if (profilesError) {
            console.warn("전화번호 조회 실패 (계속 진행):", profilesError);
            // 전화번호 조회 실패해도 학생 목록은 표시
          } else if (profilesData) {
            phoneDataMap = new Map(
              profilesData.map((profile) => [
                profile.id,
                {
                  phone: profile.phone ?? null,
                  mother_phone: profile.mother_phone ?? null,
                  father_phone: profile.father_phone ?? null,
                },
              ])
            );
          }
        } catch (phoneError) {
          console.warn("전화번호 조회 중 오류 발생 (계속 진행):", phoneError);
          // 전화번호 조회 실패해도 학생 목록은 표시
        }
      }

      // 6. 전화번호 정보를 학생 정보와 병합
      const studentsWithPhones: Student[] = availableStudents.map((student) => {
        const phoneData = phoneDataMap.get(student.id);
        return {
          id: student.id,
          name: student.name,
          grade: student.grade,
          class: student.class,
          division: student.division,
          phone: phoneData?.phone ?? null,
          mother_phone: phoneData?.mother_phone ?? null,
          father_phone: phoneData?.father_phone ?? null,
          is_active: student.is_active,
        };
      });

      setStudents(studentsWithPhones);
    } catch (error) {
      console.error("학생 목록 로드 실패:", error);
      toast.showError("학생 목록을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [templateId, toast]);

  // 초기 로드
  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  // 필터링된 학생 목록 (공통 유틸리티 함수 사용)
  const filteredStudents = filterStudents(students, filter);
  
  // 고유 학년 목록 추출
  const uniqueGrades = extractUniqueGrades(students);
  
  // 고유 반 목록 추출
  const uniqueClasses = extractUniqueClasses(students);

  const handleToggleStudent = (studentId: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedStudentIds.size === filteredStudents.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(filteredStudents.map((s) => s.id)));
    }
  };

  // 학년별 일괄 선택
  const handleSelectByGrade = (grade: string) => {
    const gradeStudents = filteredStudents.filter((s) => s.grade === grade);
    const gradeStudentIds = new Set(gradeStudents.map((s) => s.id));
    
    // 해당 학년의 모든 학생이 이미 선택되어 있는지 확인
    const allSelected = gradeStudentIds.size > 0 && 
      Array.from(gradeStudentIds).every((id) => selectedStudentIds.has(id));
    
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        // 모두 선택되어 있으면 해제
        gradeStudentIds.forEach((id) => next.delete(id));
      } else {
        // 일부만 선택되어 있거나 선택되지 않았으면 모두 선택
        gradeStudentIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  // 반별 일괄 선택
  const handleSelectByClass = (classValue: string) => {
    const classStudents = filteredStudents.filter((s) => s.class === classValue);
    const classStudentIds = new Set(classStudents.map((s) => s.id));
    
    // 해당 반의 모든 학생이 이미 선택되어 있는지 확인
    const allSelected = classStudentIds.size > 0 && 
      Array.from(classStudentIds).every((id) => selectedStudentIds.has(id));
    
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        // 모두 선택되어 있으면 해제
        classStudentIds.forEach((id) => next.delete(id));
      } else {
        // 일부만 선택되어 있거나 선택되지 않았으면 모두 선택
        classStudentIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleSendInvitations = async () => {
    // 활성 상태가 아니면 초대 발송 불가
    if (templateStatus !== "active") {
      const statusMessage = 
        templateStatus === "archived" 
          ? "보관된 템플릿에는 초대를 발송할 수 없습니다."
          : templateStatus === "draft"
          ? "초안 상태의 템플릿에는 초대를 발송할 수 없습니다. 템플릿을 활성화한 후 초대를 발송해주세요."
          : "활성 상태의 템플릿만 초대를 발송할 수 있습니다.";
      toast.showError(statusMessage);
      return;
    }
    
    if (selectedStudentIds.size === 0) {
      toast.showError("최소 1명 이상의 학생을 선택해주세요.");
      return;
    }

    // 선택된 학생 ID를 미리 저장 (비동기 처리 중 값이 변경될 수 있음)
    const sentStudentIds = Array.from(selectedStudentIds);
    const studentMap = new Map(students.map((s) => [s.id, s]));

    // 진행 상황 초기화
    setSendingProgress({
      isSending: true,
      total: sentStudentIds.length,
      processed: 0,
      success: 0,
      failed: 0,
      failedStudents: [],
    });

    // 배치 크기 설정 (10명씩 처리)
    const BATCH_SIZE = 10;
    const batches: string[][] = [];
    
    for (let i = 0; i < sentStudentIds.length; i += BATCH_SIZE) {
      batches.push(sentStudentIds.slice(i, i + BATCH_SIZE));
    }

    let totalSuccess = 0;
    let totalFailed = 0;
    const failedStudents: Array<{ id: string; name: string; error: string }> = [];

    // 배치별로 순차 처리
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      try {
        const result = await sendCampInvitationsAction(templateId, batch);
        
        if (result.success) {
          const successCount = result.count || batch.length;
          totalSuccess += successCount;
          
          // 실패한 학생이 있는 경우 (일부만 성공)
          if (successCount < batch.length) {
            const failedCount = batch.length - successCount;
            totalFailed += failedCount;
            
            // 실패한 학생 정보 수집 (정확한 실패 학생 ID는 서버에서 반환하지 않으므로 추정)
            batch.forEach((studentId) => {
              const student = studentMap.get(studentId);
              if (student) {
                failedStudents.push({
                  id: studentId,
                  name: student.name,
                  error: "초대 발송 실패 (이미 초대되었거나 오류 발생)",
                });
              }
            });
          }
        } else {
          // 배치 전체 실패
          totalFailed += batch.length;
          batch.forEach((studentId) => {
            const student = studentMap.get(studentId);
            if (student) {
              failedStudents.push({
                id: studentId,
                name: student.name,
                error: result.error || "초대 발송 실패",
              });
            }
          });
        }
      } catch (error) {
        // 배치 전체 실패
        totalFailed += batch.length;
        const errorMessage = error instanceof Error ? error.message : "초대 발송 실패";
        batch.forEach((studentId) => {
          const student = studentMap.get(studentId);
          if (student) {
            failedStudents.push({
              id: studentId,
              name: student.name,
              error: errorMessage,
            });
          }
        });
      }

      // 진행 상황 업데이트
      setSendingProgress((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          processed: (i + 1) * BATCH_SIZE > sentStudentIds.length ? sentStudentIds.length : (i + 1) * BATCH_SIZE,
          success: totalSuccess,
          failed: totalFailed,
          failedStudents,
        };
      });

      // 배치 간 짧은 지연 (서버 부하 방지)
      if (i < batches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // 발송 완료
    setSendingProgress((prev) => {
      if (!prev) return null;
      return { ...prev, isSending: false };
    });

    // 결과 메시지 표시
    if (totalSuccess > 0) {
      toast.showSuccess(
        `${totalSuccess}명의 학생에게 초대를 발송했습니다.${totalFailed > 0 ? ` (실패: ${totalFailed}명)` : ""}`
      );
    }

    if (totalFailed > 0 && totalSuccess === 0) {
      toast.showError(`${totalFailed}명의 학생 초대 발송에 실패했습니다.`);
    }

    // 성공한 학생만 목록에서 제거
    const successfulStudentIds = sentStudentIds.filter((id) => {
      return !failedStudents.some((f) => f.id === id);
    });

    // 선택 초기화
    setSelectedStudentIds(new Set());
    
    // 성공한 학생을 목록에서 즉시 제거
    setStudents((prevStudents) =>
      prevStudents.filter((student) => !successfulStudentIds.includes(student.id))
    );
    
    // 상위 컴포넌트에 알림
    if (totalSuccess > 0) {
      onInvitationSent?.();
    }
  };

  const isActive = templateStatus === "active";
  const isDisabled = !isActive;

  if (loading) {
    return <div className="text-sm text-gray-700">학생 목록을 불러오는 중...</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 활성 상태가 아닐 때 안내 메시지 */}
      {!isActive && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">
            {templateStatus === "draft" 
              ? "⚠️ 초안 상태의 템플릿입니다. 템플릿을 활성화한 후 초대를 발송할 수 있습니다."
              : templateStatus === "archived"
              ? "⚠️ 보관된 템플릿입니다. 활성화된 템플릿만 초대를 발송할 수 있습니다."
              : "⚠️ 활성 상태의 템플릿만 초대를 발송할 수 있습니다."}
          </p>
        </div>
      )}

      {/* 필터 및 선택 */}
      <div className="flex flex-col gap-3">
        {/* 검색 필터 */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="이름, 전화번호, 학년, 반 검색..."
            value={filter.search || ""}
            onChange={(e) => setFilter((prev) => ({ ...prev, search: e.target.value }))}
            disabled={isDisabled}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
          />
          <button
            type="button"
            onClick={handleSelectAll}
            disabled={isDisabled}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
          >
            {selectedStudentIds.size === filteredStudents.length ? "전체 해제" : "전체 선택"}
          </button>
        </div>
        
        {/* 고급 필터 (학년, 반) */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="filter-grade" className="block text-sm font-medium text-gray-700">
                학년
              </label>
              {filter.grade && (
                <button
                  type="button"
                  onClick={() => handleSelectByGrade(filter.grade!)}
                  disabled={isDisabled}
                  className="text-xs text-indigo-600 hover:text-indigo-700 disabled:text-gray-400"
                >
                  {(() => {
                    const gradeStudents = filteredStudents.filter((s) => s.grade === filter.grade);
                    const allSelected = gradeStudents.length > 0 && 
                      gradeStudents.every((s) => selectedStudentIds.has(s.id));
                    return allSelected ? "해제" : "전체 선택";
                  })()}
                </button>
              )}
            </div>
            <select
              id="filter-grade"
              value={filter.grade || ""}
              onChange={(e) => setFilter((prev) => ({ ...prev, grade: e.target.value || undefined }))}
              disabled={isDisabled}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
            >
              <option value="">전체</option>
              {uniqueGrades.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}학년
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="filter-class" className="block text-sm font-medium text-gray-700">
                반
              </label>
              {filter.class && (
                <button
                  type="button"
                  onClick={() => handleSelectByClass(filter.class!)}
                  disabled={isDisabled}
                  className="text-xs text-indigo-600 hover:text-indigo-700 disabled:text-gray-400"
                >
                  {(() => {
                    const classStudents = filteredStudents.filter((s) => s.class === filter.class);
                    const allSelected = classStudents.length > 0 && 
                      classStudents.every((s) => selectedStudentIds.has(s.id));
                    return allSelected ? "해제" : "전체 선택";
                  })()}
                </button>
              )}
            </div>
            <select
              id="filter-class"
              value={filter.class || ""}
              onChange={(e) => setFilter((prev) => ({ ...prev, class: e.target.value || undefined }))}
              disabled={isDisabled}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
            >
              <option value="">전체</option>
              {uniqueClasses.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}반
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 선택된 학생 수 */}
        {selectedStudentIds.size > 0 && (
          <div className="text-sm text-gray-800">
            {selectedStudentIds.size}명 선택됨
          </div>
        )}
      </div>

      {/* 학생 목록 */}
      <div className="max-h-96 overflow-y-auto rounded-lg border border-gray-200">
        {filteredStudents.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-700">
            {filter.search || filter.grade || filter.class ? "필터 조건에 맞는 학생이 없습니다." : "학생이 없습니다."}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredStudents.map((student) => (
              <label
                key={student.id}
                className="flex cursor-pointer items-center gap-3 p-3 hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={selectedStudentIds.has(student.id)}
                  onChange={() => handleToggleStudent(student.id)}
                  disabled={isDisabled}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{student.name}</div>
                  <div className="text-xs text-gray-700">
                    {student.grade}학년 {student.class}반
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* 발송 진행 상황 */}
      {sendingProgress && (
        <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">초대 발송 진행 중</h3>
            <span className="text-xs text-gray-600">
              {sendingProgress.processed} / {sendingProgress.total}
            </span>
          </div>
          <ProgressBar
            value={sendingProgress.processed}
            max={sendingProgress.total}
            showValue
            autoColor
            height="md"
          />
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="text-green-600">
              성공: {sendingProgress.success}명
            </div>
            <div className="text-red-600">
              실패: {sendingProgress.failed}명
            </div>
          </div>
          {sendingProgress.failedStudents.length > 0 && (
            <div className="mt-2 max-h-32 overflow-y-auto rounded border border-red-200 bg-red-50 p-2">
              <div className="text-xs font-semibold text-red-800 mb-1">실패한 학생:</div>
              <div className="space-y-1">
                {sendingProgress.failedStudents.map((failed) => (
                  <div key={failed.id} className="text-xs text-red-700">
                    {failed.name}: {failed.error}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 발송 버튼 */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSendInvitations}
          disabled={sendingProgress?.isSending || selectedStudentIds.size === 0 || isDisabled}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400"
        >
          {sendingProgress?.isSending ? "발송 중..." : `초대 발송 (${selectedStudentIds.size}명)`}
        </button>
      </div>
    </div>
  );
}

