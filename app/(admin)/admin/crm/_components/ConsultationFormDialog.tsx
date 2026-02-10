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
import {
  LEAD_SOURCE_LABELS,
  CONSULTATION_RESULT_LABELS,
  CALLER_TYPE_LABELS,
} from "@/lib/domains/crm/constants";
import {
  createConsultationRecord,
  lookupLeadByPhone,
} from "@/lib/domains/crm/actions/consultations";
import { createLead, updateLead } from "@/lib/domains/crm/actions/leads";
import type {
  CallerType,
  ConsultationResult,
  LeadSource,
  Program,
  SalesLead,
  RegistrationChecklist,
} from "@/lib/domains/crm/types";

type Division = "고등부" | "중등부";

type ConsultationFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programs: Program[];
  adminUsers: { id: string; name: string }[];
  currentUserId: string;
};

/** division + displayGrade(1~3) → DB student_grade(7~12) */
function toDbGrade(division: Division, displayGrade: string): number | undefined {
  const g = parseInt(displayGrade, 10);
  if (isNaN(g) || g < 1 || g > 3) return undefined;
  return division === "중등부" ? g + 6 : g + 9;
}

/** DB student_grade(7~12) → { division, displayGrade } */
function fromDbGrade(grade: number): { division: Division; displayGrade: string } {
  if (grade >= 10) {
    return { division: "고등부", displayGrade: String(grade - 9) };
  }
  return { division: "중등부", displayGrade: String(grade - 6) };
}

export function ConsultationFormDialog({
  open,
  onOpenChange,
  programs,
  adminUsers,
  currentUserId,
}: ConsultationFormDialogProps) {
  const { showSuccess, showError } = useToast();
  const [isPending, startTransition] = useTransition();

  // Form state
  const [activityDate, setActivityDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [contactPhone, setContactPhone] = useState("");
  const [contactName, setContactName] = useState("");
  const [callerType, setCallerType] = useState<CallerType>("mother");
  const [studentName, setStudentName] = useState("");
  const [division, setDivision] = useState<Division>("고등부");
  const [displayGrade, setDisplayGrade] = useState("");
  const [studentSchool, setStudentSchool] = useState("");
  const [region, setRegion] = useState("");
  const [leadSource, setLeadSource] = useState<LeadSource>("phone_inbound");
  const [programId, setProgramId] = useState("");
  const [performedBy, setPerformedBy] = useState(() => {
    const match = adminUsers.find((u) => u.id === currentUserId);
    return match ? currentUserId : adminUsers[0]?.id ?? currentUserId;
  });
  const [consultationResult, setConsultationResult] =
    useState<ConsultationResult | "">("");
  const [description, setDescription] = useState("");
  const [registered, setRegistered] = useState(false);
  const [documents, setDocuments] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [payment, setPayment] = useState(false);

  // Lead lookup state
  const [matchedLead, setMatchedLead] = useState<SalesLead | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);

  const inputClass = cn(
    "w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2",
    borderInput,
    bgSurface,
    textPrimary,
    "focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-800"
  );

  const handlePhoneBlur = useCallback(async () => {
    const phone = contactPhone.trim();
    if (!phone || phone.length < 8) {
      setMatchedLead(null);
      return;
    }

    setIsLookingUp(true);
    try {
      const result = await lookupLeadByPhone(phone);
      if (result.success && result.data) {
        setMatchedLead(result.data);
        if (result.data.contact_name && result.data.contact_name !== "미확인")
          setContactName(result.data.contact_name);
        if (result.data.student_name)
          setStudentName(result.data.student_name);
        if (result.data.student_grade) {
          const converted = fromDbGrade(result.data.student_grade);
          setDivision(converted.division);
          setDisplayGrade(converted.displayGrade);
        }
        if (result.data.student_school_name)
          setStudentSchool(result.data.student_school_name);
        if (result.data.region) setRegion(result.data.region);
        if (result.data.lead_source)
          setLeadSource(result.data.lead_source as LeadSource);
        if (result.data.program_id) setProgramId(result.data.program_id);
        // 기존 리드의 체크리스트 반영
        const existingChecklist =
          result.data.registration_checklist as RegistrationChecklist | null;
        if (existingChecklist) {
          setRegistered(existingChecklist.registered ?? false);
          setDocuments(existingChecklist.documents ?? false);
          setSmsSent(existingChecklist.sms_sent ?? false);
          setPayment(existingChecklist.payment ?? false);
        }
      } else {
        setMatchedLead(null);
      }
    } catch {
      setMatchedLead(null);
    } finally {
      setIsLookingUp(false);
    }
  }, [contactPhone]);

  const resetForm = useCallback(() => {
    setActivityDate(new Date().toISOString().slice(0, 10));
    setContactPhone("");
    setContactName("");
    setCallerType("mother");
    setStudentName("");
    setDivision("고등부");
    setDisplayGrade("");
    setStudentSchool("");
    setRegion("");
    setLeadSource("phone_inbound");
    setProgramId("");
    const match = adminUsers.find((u) => u.id === currentUserId);
    setPerformedBy(match ? currentUserId : adminUsers[0]?.id ?? currentUserId);
    setConsultationResult("");
    setDescription("");
    setRegistered(false);
    setDocuments(false);
    setSmsSent(false);
    setPayment(false);
    setMatchedLead(null);
  }, [adminUsers, currentUserId]);

  const handleOpenChange = useCallback(
    (v: boolean) => {
      if (!v) resetForm();
      onOpenChange(v);
    },
    [resetForm, onOpenChange]
  );

  const handleDivisionChange = useCallback((newDivision: Division) => {
    setDivision(newDivision);
    setStudentSchool(""); // 구분 변경 시 학교 초기화
  }, []);

  const handleSubmit = () => {
    if (isLookingUp) {
      showError("전화번호 검색 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    if (!contactPhone.trim()) {
      showError("전화번호를 입력해주세요.");
      return;
    }

    // 체크리스트: 하나라도 true인 경우에만 전송
    const hasChecklist = registered || documents || smsSent || payment;

    // division + displayGrade → DB grade
    const dbGrade = displayGrade
      ? toDbGrade(division, displayGrade)
      : undefined;

    startTransition(async () => {
      if (consultationResult) {
        // 상담 결과 선택됨 → 리드 + 활동 기록 (기존 흐름)
        const result = await createConsultationRecord({
          contactPhone: contactPhone.trim(),
          contactName: contactName.trim() || undefined,
          studentName: studentName.trim() || undefined,
          studentGrade: dbGrade,
          studentSchool: studentSchool.trim() || undefined,
          region: region.trim() || undefined,
          callerType,
          leadSource,
          programId: programId || undefined,
          performedBy: performedBy || undefined,
          consultationResult,
          description: description.trim() || undefined,
          activityDate: activityDate
            ? `${activityDate}T${new Date().toTimeString().slice(0, 8)}`
            : undefined,
          checklist: hasChecklist
            ? { registered, documents, sms_sent: smsSent, payment }
            : undefined,
          existingLeadId: matchedLead?.id,
        });

        if (result.success) {
          showSuccess("상담 기록이 등록되었습니다.");
          resetForm();
          onOpenChange(false);
        } else {
          showError(result.error ?? "등록에 실패했습니다.");
        }
      } else {
        // 상담 결과 미선택 → 리드만 생성/업데이트
        const contactNameValue =
          contactName.trim() || studentName.trim() || "미확인";

        const leadPayload = {
          contact_name: contactNameValue,
          contact_phone: contactPhone.trim(),
          student_name: studentName.trim() || null,
          student_grade: dbGrade ?? null,
          student_school_name: studentSchool.trim() || null,
          region: region.trim() || null,
          lead_source: leadSource,
          program_id: programId || null,
          assigned_to: performedBy || null,
          notes: description.trim() || null,
          ...(hasChecklist && {
            registration_checklist: {
              registered,
              documents,
              sms_sent: smsSent,
              payment,
            },
          }),
        };

        const result = matchedLead
          ? await updateLead(matchedLead.id, leadPayload)
          : await createLead(leadPayload);

        if (result.success) {
          showSuccess(
            matchedLead
              ? "리드가 업데이트되었습니다."
              : "리드가 등록되었습니다."
          );
          resetForm();
          onOpenChange(false);
        } else {
          showError(result.error ?? "등록에 실패했습니다.");
        }
      }
    });
  };

  const schoolType: "중학교" | "고등학교" =
    division === "중등부" ? "중학교" : "고등학교";

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title="리드/상담 등록"
      size="2xl"
    >
      <DialogContent className="overflow-y-auto max-h-[70vh]">
        <div className="flex flex-col gap-4">
          {/* Row 1: 날짜 + 전화번호 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className={cn("text-sm font-medium", textSecondary)}>
                날짜 *
              </label>
              <input
                type="date"
                value={activityDate}
                onChange={(e) => setActivityDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={cn("text-sm font-medium", textSecondary)}>
                전화번호 *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={contactPhone}
                  onChange={(e) => {
                    setContactPhone(e.target.value);
                    if (matchedLead) setMatchedLead(null);
                  }}
                  onBlur={handlePhoneBlur}
                  className={inputClass}
                  placeholder="010-0000-0000"
                />
                {isLookingUp && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                    검색중...
                  </span>
                )}
              </div>
              {matchedLead && (
                <span className="text-xs text-blue-600 dark:text-blue-400">
                  기존 리드: {matchedLead.contact_name} (
                  {matchedLead.student_name ?? "학생 미등록"})
                </span>
              )}
            </div>
          </div>

          {/* Row 2: 문의자명, (내담자 - 상담시만), 학생이름 */}
          <div className={cn("grid grid-cols-1 gap-4", consultationResult ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
            <div className="flex flex-col gap-1">
              <label className={cn("text-sm font-medium", textSecondary)}>
                문의자명
              </label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className={inputClass}
                placeholder="보호자 이름"
              />
            </div>
            {consultationResult && (
              <div className="flex flex-col gap-1">
                <label className={cn("text-sm font-medium", textSecondary)}>
                  내담자
                </label>
                <select
                  value={callerType}
                  onChange={(e) => setCallerType(e.target.value as CallerType)}
                  className={inputClass}
                >
                  {Object.entries(CALLER_TYPE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <label className={cn("text-sm font-medium", textSecondary)}>
                학생이름
              </label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className={inputClass}
                placeholder="학생 이름"
              />
            </div>
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
              <SchoolSelect
                value={studentSchool}
                onChange={setStudentSchool}
                type={schoolType}
                placeholder={`${schoolType}를 검색하세요`}
                className="w-full"
              />
            </div>
          </div>

          {/* Row 4: 지역, 경로, 문의프로그램 */}
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
                경로 *
              </label>
              <select
                value={leadSource}
                onChange={(e) => setLeadSource(e.target.value as LeadSource)}
                className={inputClass}
              >
                {Object.entries(LEAD_SOURCE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={cn("text-sm font-medium", textSecondary)}>
                문의 프로그램
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

          {/* Row 5: 상담자, 상담결과 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className={cn("text-sm font-medium", textSecondary)}>
                상담자
              </label>
              <select
                value={performedBy}
                onChange={(e) => setPerformedBy(e.target.value)}
                className={inputClass}
              >
                {adminUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={cn("text-sm font-medium", textSecondary)}>
                상담결과
              </label>
              <select
                value={consultationResult}
                onChange={(e) =>
                  setConsultationResult(
                    e.target.value as ConsultationResult | ""
                  )
                }
                className={inputClass}
              >
                <option value="">선택 안함</option>
                {Object.entries(CONSULTATION_RESULT_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 6: 메모 / 상담내용 */}
          <div className="flex flex-col gap-1">
            <label className={cn("text-sm font-medium", textSecondary)}>
              {consultationResult ? "상담내용" : "메모"}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={cn(inputClass, "min-h-[80px]")}
              placeholder={consultationResult ? "상담 내용을 입력하세요..." : "특이사항, 문의 내용 등을 메모하세요..."}
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
          onClick={() => {
            resetForm();
            onOpenChange(false);
          }}
          disabled={isPending}
        >
          취소
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          isLoading={isPending}
          disabled={isLookingUp}
        >
          등록
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
