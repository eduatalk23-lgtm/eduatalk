"use client";

// ============================================
// Agent 독립 페이지 클라이언트 컴포넌트
// 학생 선택 드롭다운 + 전폭 AgentChat
// ============================================

import { useState } from "react";
import { Bot } from "lucide-react";
import { AgentChat } from "@/components/agent/AgentChat";

interface StudentOption {
  id: string;
  name: string;
}

interface AgentPageClientProps {
  students: StudentOption[];
}

export function AgentPageClient({ students }: AgentPageClientProps) {
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(
    null,
  );

  return (
    <div className="flex flex-col h-full">
      {/* 학생 선택 바 */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[rgb(var(--color-secondary-200))] bg-[var(--background)]">
        <label
          htmlFor="student-select"
          className="text-sm font-medium text-[var(--color-text-secondary)] whitespace-nowrap"
        >
          학생 선택
        </label>
        <select
          id="student-select"
          value={selectedStudent?.id ?? ""}
          onChange={(e) => {
            const student = students.find((s) => s.id === e.target.value);
            if (student) {
              setSelectedStudent(student);
            } else {
              setSelectedStudent(null);
            }
          }}
          className="flex-1 max-w-xs rounded-lg border border-[rgb(var(--color-secondary-300))] bg-[var(--background)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary-500))]"
        >
          <option value="">학생을 선택하세요</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* 채팅 영역 */}
      <div className="flex-1 overflow-hidden">
        {selectedStudent ? (
          <AgentChat
            studentId={selectedStudent.id}
            studentName={selectedStudent.name}
            className="h-full"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-[rgb(var(--color-secondary-100))] flex items-center justify-center">
              <Bot className="w-8 h-8 text-[var(--color-text-tertiary)]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                학생을 선택하세요
              </p>
              <p className="text-xs text-[var(--color-text-tertiary)] pt-1">
                학생을 선택하면 AI 어시스턴트와 대화할 수 있습니다.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
