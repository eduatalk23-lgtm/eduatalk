"use client";

import { useState, useTransition, useCallback } from "react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import Button from "@/components/atoms/Button";
import SchoolSelect from "@/components/ui/SchoolSelect";
import { useToast } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/cn";
import {
  borderInput,
  bgSurface,
  textPrimary,
  textSecondary,
} from "@/lib/utils/darkMode";
import { LEAD_SOURCE_LABELS } from "@/lib/domains/crm/constants";
import { createLead, updateLead } from "@/lib/domains/crm/actions/leads";
import type {
  SalesLeadWithRelations,
  LeadSource,
  Program,
  RegistrationChecklist,
} from "@/lib/domains/crm/types";

type Division = "고등부" | "중등부";

type LeadFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: SalesLeadWithRelations | null;
  programs: Program[];
  adminUsers: { id: string; name: string }[];
  displaySchoolName?: string | null;
};

/** division + displayGrade(1~3) → DB student_grade(7~12) */
function toDbGrade(
  division: Division,
  displayGrade: string
): number | undefined {
  const g = parseInt(displayGrade, 10);
  if (isNaN(g) || g < 1 || g > 3) return undefined;
  return division === "중등부" ? g + 6 : g + 9;
}

/** DB student_grade(7~12) → { division, displayGrade } */
function fromDbGrade(
  grade: number
): { division: Division; displayGrade: string } {
  if (grade >= 10) {
    return { division: "고등부", displayGrade: String(grade - 9) };
  }
  return { division: "중등부", displayGrade: String(grade - 6) };
}

function initDivision(lead?: SalesLeadWithRelations | null): Division {
  if (lead?.student_grade) {
    return fromDbGrade(lead.student_grade).division;
  }
  return "고등부";
}

function initDisplayGrade(lead?: SalesLeadWithRelations | null): string {
  if (lead?.student_grade) {
    return fromDbGrade(lead.student_grade).displayGrade;
  }
  return "";
}

export function LeadFormDialog({
  open,
  onOpenChange,
  lead,
  programs,
  adminUsers,
  displaySchoolName,
}: LeadFormDialogProps) {
  const isEdit = !!lead;
  const { showSuccess, showError } = useToast();
  const [isPending, startTransition] = useTransition();

  const [contactName, setContactName] = useState(lead?.contact_name ?? "");
  const [contactPhone, setContactPhone] = useState(lead?.contact_phone ?? "");
  const [studentName, setStudentName] = useState(lead?.student_name ?? "");
  const [division, setDivision] = useState<Division>(initDivision(lead));
  const [displayGrade, setDisplayGrade] = useState(initDisplayGrade(lead));
  const [studentSchool, setStudentSchool] = useState(
    lead?.student_school_name ?? ""
  );
  const [region, setRegion] = useState(lead?.region ?? "");
  const [leadSource, setLeadSource] = useState<LeadSource>(
    (lead?.lead_source as LeadSource) ?? "homepage"
  );
  const [programId, setProgramId] = useState(lead?.program_id ?? "");
  const [assignedTo, setAssignedTo] = useState(lead?.assigned_to ?? "");
  const [notes, setNotes] = useState(lead?.notes ?? "");

  // 체크리스트
  const existingChecklist =
    lead?.registration_checklist as RegistrationChecklist | null;
  const [registered, setRegistered] = useState(
    existingChecklist?.registered ?? false
  );
  const [documents, setDocuments] = useState(
    existingChecklist?.documents ?? false
  );
  const [smsSent, setSmsSent] = useState(
    existingChecklist?.sms_sent ?? false
  );
  const [payment, setPayment] = useState(
    existingChecklist?.payment ?? false
  );

  // 학교 표시/편집 토글 (학생 상세 페이지와 동일 패턴)
  const [isEditingSchool, setIsEditingSchool] = useState(!isEdit);
  const [selectedSchoolName, setSelectedSchoolName] = useState<string | null>(
    null
  );
  const currentSchoolName = selectedSchoolName ?? displaySchoolName;

  const handleSchoolSelect = useCallback(
    (school: { id: string; name: string; type?: string | null }) => {
      setStudentSchool(school.id || school.name);
      setSelectedSchoolName(school.name);
      setIsEditingSchool(false);
    },
    []
  );

  const inputClass = cn(
    "w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2",
    borderInput,
    bgSurface,
    textPrimary,
    "focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-800"
  );

  const handleDivisionChange = useCallback((newDivision: Division) => {
    setDivision(newDivision);
    setStudentSchool("");
    setSelectedSchoolName(null);
    setIsEditingSchool(true);
  }, []);

  const schoolType: "중학교" | "고등학교" =
    division === "중등부" ? "중학교" : "고등학교";

  const handleSubmit = () => {
    if (!contactName.trim()) {
      showError("문의자 이름을 입력해주세요.");
      return;
    }

    const dbGrade = displayGrade
      ? toDbGrade(division, displayGrade)
      : undefined;

    const hasChecklist = registered || documents || smsSent || payment;

    startTransition(async () => {
      const payload = {
        contact_name: contactName.trim(),
        contact_phone: contactPhone.trim() || null,
        student_name: studentName.trim() || null,
        student_grade: dbGrade ?? null,
        student_school_name: studentSchool.trim() || null,
        region: region.trim() || null,
        lead_source: leadSource,
        program_id: programId || null,
        assigned_to: assignedTo || null,
        notes: notes.trim() || null,
        ...(hasChecklist && {
          registration_checklist: {
            registered,
            documents,
            sms_sent: smsSent,
            payment,
          },
        }),
      };

      const result = isEdit
        ? await updateLead(lead.id, payload)
        : await createLead(payload);

      if (result.success) {
        showSuccess(isEdit ? "리드가 수정되었습니다." : "리드가 생성되었습니다.");
        onOpenChange(false);
      } else {
        showError(result.error ?? "처리에 실패했습니다.");
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "리드 수정" : "새 리드 등록"}
      size="lg"
    >
      <DialogContent className="overflow-y-auto max-h-[70vh]">
        <div className="flex flex-col gap-4">
          {/* Row 1: 문의자명, 연락처 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className={cn("text-sm font-medium", textSecondary)}>
                문의자명 *
              </label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className={inputClass}
                placeholder="문의자 이름"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={cn("text-sm font-medium", textSecondary)}>
                연락처
              </label>
              <input
                type="text"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className={inputClass}
                placeholder="010-0000-0000"
              />
            </div>
          </div>

          {/* Row 2: 학생명 */}
          <div className="flex flex-col gap-1">
            <label className={cn("text-sm font-medium", textSecondary)}>
              학생명
            </label>
            <input
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className={inputClass}
              placeholder="학생 이름"
            />
          </div>

          {/* Row 3: 구분, 학년, 학교 */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-[1fr_1fr_2fr]">
            <div className="flex flex-col gap-1">
              <label className={cn("text-sm font-medium", textSecondary)}>
                구분
              </label>
              <select
                value={division}
                onChange={(e) =>
                  handleDivisionChange(e.target.value as Division)
                }
                className={inputClass}
              >
                <option value="고등부">고등부</option>
                <option value="중등부">중등부</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={cn("text-sm font-medium", textSecondary)}>
                학년
              </label>
              <select
                value={displayGrade}
                onChange={(e) => setDisplayGrade(e.target.value)}
                className={inputClass}
              >
                <option value="">선택</option>
                <option value="1">1학년</option>
                <option value="2">2학년</option>
                <option value="3">3학년</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={cn("text-sm font-medium", textSecondary)}>
                학교
              </label>
              {isEditingSchool ? (
                <div className="flex flex-col gap-1.5">
                  <SchoolSelect
                    value={studentSchool}
                    onChange={setStudentSchool}
                    onSchoolSelect={handleSchoolSelect}
                    type={schoolType}
                    placeholder={`${schoolType}를 검색하세요`}
                    className="w-full"
                  />
                  {isEdit && (
                    <button
                      type="button"
                      onClick={() => setIsEditingSchool(false)}
                      className={cn("text-xs", textSecondary, "hover:underline self-start")}
                    >
                      취소
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className={cn(inputClass, "flex-1 truncate")}>
                    {currentSchoolName || "학교 미등록"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEditingSchool(true)}
                    className={cn(
                      "shrink-0 rounded-lg border px-3 py-2 text-sm font-medium",
                      borderInput,
                      textPrimary,
                      "hover:bg-gray-50 dark:hover:bg-gray-800"
                    )}
                  >
                    변경
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Row 4: 지역, 유입경로, 프로그램 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label className={cn("text-sm font-medium", textSecondary)}>
                지역
              </label>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className={inputClass}
                placeholder="지역"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={cn("text-sm font-medium", textSecondary)}>
                유입경로 *
              </label>
              <select
                value={leadSource}
                onChange={(e) => setLeadSource(e.target.value as LeadSource)}
                className={inputClass}
              >
                {Object.entries(LEAD_SOURCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={cn("text-sm font-medium", textSecondary)}>
                프로그램
              </label>
              <select
                value={programId}
                onChange={(e) => setProgramId(e.target.value)}
                className={inputClass}
              >
                <option value="">선택 안함</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 5: 담당자 */}
          <div className="flex flex-col gap-1">
            <label className={cn("text-sm font-medium", textSecondary)}>
              담당자
            </label>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className={inputClass}
            >
              <option value="">미배정</option>
              {adminUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          {/* Row 6: 비고 */}
          <div className="flex flex-col gap-1">
            <label className={cn("text-sm font-medium", textSecondary)}>
              비고
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={cn(inputClass, "min-h-[80px]")}
              placeholder="추가 메모"
            />
          </div>

          {/* Row 7: 체크리스트 */}
          <div className="flex flex-col gap-2">
            <label className={cn("text-sm font-medium", textSecondary)}>
              체크리스트
            </label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={registered}
                  onChange={(e) => setRegistered(e.target.checked)}
                  className="rounded"
                />
                <span className={textPrimary}>등록</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={documents}
                  onChange={(e) => setDocuments(e.target.checked)}
                  className="rounded"
                />
                <span className={textPrimary}>서류</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={smsSent}
                  onChange={(e) => setSmsSent(e.target.checked)}
                  className="rounded"
                />
                <span className={textPrimary}>문자</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={payment}
                  onChange={(e) => setPayment(e.target.checked)}
                  className="rounded"
                />
                <span className={textPrimary}>결제</span>
              </label>
            </div>
          </div>
        </div>
      </DialogContent>
      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isPending}
        >
          취소
        </Button>
        <Button variant="primary" onClick={handleSubmit} isLoading={isPending}>
          {isEdit ? "수정" : "등록"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
