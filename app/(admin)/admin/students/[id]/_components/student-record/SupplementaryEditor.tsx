"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addAwardAction,
  removeAwardAction,
  addVolunteerAction,
  removeVolunteerAction,
  addDisciplinaryAction,
  removeDisciplinaryAction,
} from "@/lib/domains/student-record/actions/supplementary";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import type { RecordAward, RecordVolunteer, RecordDisciplinary } from "@/lib/domains/student-record";

const B = "border border-gray-400 dark:border-gray-500";
const TH = `${B} px-2 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)]`;
const TD = `${B} px-2 py-1 text-sm text-[var(--text-secondary)]`;
const TD_P = `${B} px-2 py-1 text-sm text-[var(--text-primary)]`;

type SupplementaryEditorProps = {
  awards: RecordAward[];
  volunteer: RecordVolunteer[];
  disciplinary: RecordDisciplinary[];
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
  /** 표시할 섹션 (미지정 시 데이터가 있거나 배열이 전달된 섹션만) */
  show?: ("awards" | "volunteer" | "disciplinary")[];
};

export function SupplementaryEditor({
  awards,
  volunteer,
  disciplinary,
  studentId,
  schoolYear,
  tenantId,
  grade,
  show,
}: SupplementaryEditorProps) {
  // show가 지정되면 해당 섹션만, 미지정이면 전부
  const showAwards = show ? show.includes("awards") : true;
  const showVolunteer = show ? show.includes("volunteer") : true;
  const showDisciplinary = show ? show.includes("disciplinary") : true;

  return (
    <div className="flex flex-col gap-6">
      {showAwards && <AwardSection awards={awards} studentId={studentId} schoolYear={schoolYear} tenantId={tenantId} grade={grade} />}
      {showVolunteer && <VolunteerSection volunteer={volunteer} studentId={studentId} schoolYear={schoolYear} tenantId={tenantId} grade={grade} />}
      {showDisciplinary && <DisciplinarySection disciplinary={disciplinary} studentId={studentId} schoolYear={schoolYear} tenantId={tenantId} grade={grade} />}
    </div>
  );
}

// ============================================
// 수상
// ============================================

function AwardSection({
  awards, studentId, schoolYear, tenantId, grade,
}: { awards: RecordAward[]; studentId: string; schoolYear: number; tenantId: string; grade: number }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [level, setLevel] = useState("");
  const [date, setDate] = useState("");
  const [awardingBody, setAwardingBody] = useState("");
  const [participants, setParticipants] = useState("");
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: studentRecordKeys.supplementaryTab(studentId, schoolYear) });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("수상명을 입력해주세요.");
      const result = await addAwardAction({
        student_id: studentId, school_year: schoolYear, tenant_id: tenantId, grade,
        award_name: name.trim(), award_level: level.trim() || null, award_date: date || null,
        awarding_body: awardingBody.trim() || null, participants: participants.trim() || null,
      });
      if (!result.success) throw new Error("error" in result ? result.error : "추가 실패");
    },
    onSuccess: () => { invalidate(); setShowForm(false); setName(""); setLevel(""); setDate(""); setAwardingBody(""); setParticipants(""); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const r = await removeAwardAction(id); if (!r.success) throw new Error("삭제 실패"); },
    onSuccess: invalidate,
  });

  return (
    <div>
      <h4 className="mb-2 text-xs font-bold text-[var(--text-primary)]">수상 ({awards.length}건)</h4>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className={TH}>학년</th>
              <th className={TH}>학기</th>
              <th className={TH}>수 상 명</th>
              <th className={TH}>등급(위)</th>
              <th className={TH}>수상연월일</th>
              <th className={TH}>수여기관</th>
              <th className={TH}>참가대상(참가인원)</th>
            </tr>
          </thead>
          <tbody>
            {awards.length === 0 && (
              <tr><td colSpan={7} className={`${TD} text-center text-[var(--text-tertiary)]`}>해당 사항 없음</td></tr>
            )}
            {awards.map((a) => {
              const semester = a.award_date ? (new Date(a.award_date).getMonth() < 7 ? 1 : 2) : null;
              return (
                <tr key={a.id} className="group">
                  <td className={`${TD} text-center`}>{a.grade}</td>
                  <td className={`${TD} text-center`}>{semester ?? "-"}</td>
                  <td className={TD_P}>{a.award_name}</td>
                  <td className={TD}>{a.award_level ?? "-"}</td>
                  <td className={TD}>{a.award_date ?? "-"}</td>
                  <td className={TD}>{a.awarding_body ?? "-"}</td>
                  <td className={`${TD} relative`}>
                    {a.participants ?? "-"}
                    <button
                      onClick={() => { if (confirm("삭제하시겠습니까?")) deleteMutation.mutate(a.id); }}
                      className="absolute right-1 top-1/2 -translate-y-1/2 rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-500 invisible transition-all hover:bg-red-100 hover:text-red-700 group-hover:visible dark:bg-red-950/30 dark:hover:bg-red-950/50"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showForm ? (
        <div className="mt-2 flex flex-col gap-2 border border-gray-300 p-2 dark:border-gray-600">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="수상명 *" className="border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-900" />
            <input value={level} onChange={(e) => setLevel(e.target.value)} placeholder="등급(위)" className="border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-900" />
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-900" />
            <input value={awardingBody} onChange={(e) => setAwardingBody(e.target.value)} placeholder="수여기관" className="border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-900" />
            <input value={participants} onChange={(e) => setParticipants(e.target.value)} placeholder="참가대상(인원)" className="border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-900" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => addMutation.mutate()} disabled={addMutation.isPending} className="bg-indigo-600 px-3 py-1 text-xs text-white hover:bg-indigo-700 disabled:opacity-50">추가</button>
            <button onClick={() => setShowForm(false)} className="text-xs text-[var(--text-tertiary)]">취소</button>
          </div>
          {addMutation.isError && <p className="text-xs text-red-600">{addMutation.error.message}</p>}
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} className="mt-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">+ 수상 추가</button>
      )}
    </div>
  );
}

// ============================================
// 봉사
// ============================================

function VolunteerSection({
  volunteer, studentId, schoolYear, tenantId, grade,
}: { volunteer: RecordVolunteer[]; studentId: string; schoolYear: number; tenantId: string; grade: number }) {
  const [showForm, setShowForm] = useState(false);
  const [description, setDescription] = useState("");
  const [hours, setHours] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: studentRecordKeys.supplementaryTab(studentId, schoolYear) });
  const totalHours = volunteer.reduce((sum, v) => sum + (v.hours ?? 0), 0);

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!hours || parseFloat(hours) <= 0) throw new Error("봉사 시간을 입력해주세요.");
      const result = await addVolunteerAction({
        student_id: studentId, school_year: schoolYear, tenant_id: tenantId, grade,
        description: description.trim() || null, hours: parseFloat(hours),
        activity_date: date || null, location: location.trim() || null,
      });
      if (!result.success) throw new Error("error" in result ? result.error : "추가 실패");
    },
    onSuccess: () => { invalidate(); setShowForm(false); setDescription(""); setHours(""); setDate(""); setLocation(""); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const r = await removeVolunteerAction(id); if (!r.success) throw new Error("삭제 실패"); },
    onSuccess: invalidate,
  });

  return (
    <div>
      <h4 className="mb-2 text-xs font-bold text-[var(--text-primary)]">
        &lt; 봉사활동실적 &gt; <span className="ml-1 font-normal text-[var(--text-tertiary)]">({volunteer.length}건) 총 {totalHours}시간</span>
      </h4>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className={TH}>학년</th>
              <th className={TH}>일자 또는 기간</th>
              <th className={TH}>장소 또는 주관기관명</th>
              <th className={TH}>활동내용</th>
              <th className={TH}>시간</th>
              <th className={TH}>누계시간</th>
            </tr>
          </thead>
          <tbody>
            {volunteer.length === 0 && (
              <tr><td colSpan={6} className={`${TD} text-center text-[var(--text-tertiary)]`}>해당 사항 없음</td></tr>
            )}
            {volunteer.map((v) => (
              <tr key={v.id} className="group">
                <td className={`${TD} text-center`}>{v.grade}</td>
                <td className={TD}>{v.activity_date ?? "-"}</td>
                <td className={TD}>{v.location ?? "-"}</td>
                <td className={TD_P}>{v.description ?? "-"}</td>
                <td className={`${B} px-2 py-1 text-right text-sm text-[var(--text-primary)]`}>{v.hours}</td>
                <td className={`${B} px-2 py-1 text-right text-sm text-[var(--text-secondary)] relative`}>
                  {v.cumulative_hours ?? "-"}
                  <button
                    onClick={() => { if (confirm("삭제하시겠습니까?")) deleteMutation.mutate(v.id); }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-500 invisible transition-all hover:bg-red-100 hover:text-red-700 group-hover:visible dark:bg-red-950/30 dark:hover:bg-red-950/50"
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm ? (
        <div className="mt-2 flex flex-col gap-2 border border-gray-300 p-2 dark:border-gray-600">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <input value={date} onChange={(e) => setDate(e.target.value)} type="date" className="border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-900" />
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="장소" className="border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-900" />
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="활동 내용" className="border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-900" />
            <input type="number" step="0.5" min="0" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="시간 *" className="border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-900" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => addMutation.mutate()} disabled={addMutation.isPending} className="bg-indigo-600 px-3 py-1 text-xs text-white hover:bg-indigo-700 disabled:opacity-50">추가</button>
            <button onClick={() => setShowForm(false)} className="text-xs text-[var(--text-tertiary)]">취소</button>
          </div>
          {addMutation.isError && <p className="text-xs text-red-600">{addMutation.error.message}</p>}
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} className="mt-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">+ 봉사 추가</button>
      )}
    </div>
  );
}

// ============================================
// 징계
// ============================================

function DisciplinarySection({
  disciplinary, studentId, schoolYear, tenantId, grade,
}: { disciplinary: RecordDisciplinary[]; studentId: string; schoolYear: number; tenantId: string; grade: number }) {
  const [showForm, setShowForm] = useState(false);
  const [actionType, setActionType] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: studentRecordKeys.supplementaryTab(studentId, schoolYear) });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!actionType.trim()) throw new Error("조치 유형을 입력해주세요.");
      const result = await addDisciplinaryAction({
        student_id: studentId, school_year: schoolYear, tenant_id: tenantId, grade,
        action_type: actionType.trim(), decision_date: date || null, notes: notes.trim() || null,
      });
      if (!result.success) throw new Error("error" in result ? result.error : "추가 실패");
    },
    onSuccess: () => { invalidate(); setShowForm(false); setActionType(""); setDate(""); setNotes(""); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const r = await removeDisciplinaryAction(id); if (!r.success) throw new Error("삭제 실패"); },
    onSuccess: invalidate,
  });

  return (
    <div>
      <h4 className="mb-2 text-xs font-bold text-[var(--text-primary)]">징계 ({disciplinary.length}건)</h4>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className={TH}>조치 유형</th>
              <th className={TH}>결정일</th>
              <th className={TH}>비고</th>
            </tr>
          </thead>
          <tbody>
            {disciplinary.length === 0 && (
              <tr><td colSpan={3} className={`${TD} text-center text-[var(--text-tertiary)]`}>해당 사항 없음</td></tr>
            )}
            {disciplinary.map((d) => (
              <tr key={d.id} className="group">
                <td className={TD_P}>{d.action_type}</td>
                <td className={TD}>{d.decision_date ?? "-"}</td>
                <td className={`${TD} relative`}>
                  <span className="max-w-[200px] truncate">{d.notes ?? "-"}</span>
                  <button
                    onClick={() => { if (confirm("삭제하시겠습니까?")) deleteMutation.mutate(d.id); }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-500 invisible transition-all hover:bg-red-100 hover:text-red-700 group-hover:visible dark:bg-red-950/30 dark:hover:bg-red-950/50"
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm ? (
        <div className="mt-2 flex flex-col gap-2 border border-gray-300 p-2 dark:border-gray-600">
          <div className="grid grid-cols-3 gap-2">
            <input value={actionType} onChange={(e) => setActionType(e.target.value)} placeholder="조치 유형 *" className="border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-900" />
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-900" />
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="비고" className="border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-900" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => addMutation.mutate()} disabled={addMutation.isPending} className="bg-indigo-600 px-3 py-1 text-xs text-white hover:bg-indigo-700 disabled:opacity-50">추가</button>
            <button onClick={() => setShowForm(false)} className="text-xs text-[var(--text-tertiary)]">취소</button>
          </div>
          {addMutation.isError && <p className="text-xs text-red-600">{addMutation.error.message}</p>}
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} className="mt-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">+ 징계 추가</button>
      )}
    </div>
  );
}
