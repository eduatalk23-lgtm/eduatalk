"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveRoadmapItemAction } from "@/lib/domains/student-record/actions/storyline";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import type { Storyline } from "@/lib/domains/student-record";

const AREA_OPTIONS: { value: string; label: string }[] = [
  { value: "autonomy", label: "자율·자치" },
  { value: "club", label: "동아리" },
  { value: "career", label: "진로" },
  { value: "setek", label: "세특" },
  { value: "personal_setek", label: "개인세특" },
  { value: "reading", label: "독서" },
  { value: "course_selection", label: "교과선택" },
  { value: "competition", label: "대회" },
  { value: "external", label: "외부활동" },
  { value: "volunteer", label: "봉사" },
  { value: "general", label: "기타" },
];

interface AddRoadmapFormProps {
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
  storylines: Storyline[];
  sortOrder: number;
  onClose: () => void;
}

export function AddRoadmapForm({
  studentId,
  schoolYear,
  tenantId,
  grade,
  storylines,
  sortOrder,
  onClose,
}: AddRoadmapFormProps) {
  const [area, setArea] = useState<string>("setek");
  const [targetGrade, setTargetGrade] = useState(grade);
  const [semester, setSemester] = useState<number | null>(null);
  const [planContent, setPlanContent] = useState("");
  const [storylineId, setStorylineId] = useState<string>("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!planContent.trim()) throw new Error("계획 내용을 입력해주세요.");
      const result = await saveRoadmapItemAction({
        student_id: studentId,
        school_year: schoolYear,
        tenant_id: tenantId,
        grade: targetGrade,
        semester,
        area,
        plan_content: planContent.trim(),
        storyline_id: storylineId || null,
        sort_order: sortOrder,
      });
      if (!result.success) throw new Error("error" in result ? result.error : "저장 실패");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.storylineTab(studentId) });
      onClose();
    },
  });

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-800 dark:bg-indigo-950/20">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--text-primary)]">로드맵 항목 추가</span>
        <button onClick={onClose} className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">취소</button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <select
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="rounded-md border border-border bg-white px-2 py-2 text-sm dark:border-border dark:bg-bg-primary"
          >
            {AREA_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            value={targetGrade}
            onChange={(e) => setTargetGrade(Number(e.target.value))}
            className="rounded-md border border-border bg-white px-2 py-2 text-sm dark:border-border dark:bg-bg-primary"
          >
            <option value={1}>1학년</option>
            <option value={2}>2학년</option>
            <option value={3}>3학년</option>
          </select>
          <select
            value={semester ?? ""}
            onChange={(e) => setSemester(e.target.value ? Number(e.target.value) : null)}
            className="rounded-md border border-border bg-white px-2 py-2 text-sm dark:border-border dark:bg-bg-primary"
          >
            <option value="">학기 미지정</option>
            <option value={1}>1학기</option>
            <option value={2}>2학기</option>
          </select>
          <select
            value={storylineId}
            onChange={(e) => setStorylineId(e.target.value)}
            className="rounded-md border border-border bg-white px-2 py-2 text-sm dark:border-border dark:bg-bg-primary"
          >
            <option value="">스토리라인 미연결</option>
            {storylines.map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        </div>

        <textarea
          value={planContent}
          onChange={(e) => setPlanContent(e.target.value)}
          rows={2}
          placeholder="계획 내용을 입력하세요... *"
          className="w-full resize-y rounded-md border border-border bg-white p-3 text-sm placeholder:text-text-tertiary focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-border dark:bg-bg-primary"
        />

        <div className="flex justify-end">
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {mutation.isPending ? "추가 중..." : "추가"}
          </button>
        </div>
        {mutation.isError && <p className="text-xs text-red-600">{mutation.error.message}</p>}
      </div>
    </div>
  );
}
