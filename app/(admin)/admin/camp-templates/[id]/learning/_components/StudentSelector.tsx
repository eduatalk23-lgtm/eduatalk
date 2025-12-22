"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

type Participant = {
  id: string;
  name: string;
};

type StudentSelectorProps = {
  participants: Participant[];
  selectedStudentIds: string[];
  onSelectionChange: (studentIds: string[]) => void;
};

export function StudentSelector({
  participants,
  selectedStudentIds,
  onSelectionChange,
}: StudentSelectorProps) {
  const [localSelectedIds, setLocalSelectedIds] = useState<string[]>(selectedStudentIds);

  useEffect(() => {
    setLocalSelectedIds(selectedStudentIds);
  }, [selectedStudentIds]);

  const handleToggle = (studentId: string) => {
    const newSelected = localSelectedIds.includes(studentId)
      ? localSelectedIds.filter((id) => id !== studentId)
      : [...localSelectedIds, studentId];
    
    setLocalSelectedIds(newSelected);
    onSelectionChange(newSelected);
  };

  const handleSelectAll = () => {
    const allIds = participants.map((p) => p.id);
    setLocalSelectedIds(allIds);
    onSelectionChange(allIds);
  };

  const handleDeselectAll = () => {
    setLocalSelectedIds([]);
    onSelectionChange([]);
  };

  const isAllSelected = participants.length > 0 && localSelectedIds.length === participants.length;
  const isNoneSelected = localSelectedIds.length === 0;

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            학생 필터
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              disabled={isAllSelected}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                isAllSelected
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-blue-50 text-blue-700 hover:bg-blue-100"
              )}
            >
              전체 선택
            </button>
            <button
              type="button"
              onClick={handleDeselectAll}
              disabled={isNoneSelected}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                isNoneSelected
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-gray-50 text-gray-700 hover:bg-gray-100"
              )}
            >
              전체 해제
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {participants.map((participant) => {
            const isSelected = localSelectedIds.includes(participant.id);
            return (
              <button
                key={participant.id}
                type="button"
                onClick={() => handleToggle(participant.id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                  isSelected
                    ? "bg-blue-100 text-blue-800 hover:bg-blue-200"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                )}
              >
                {participant.name}
              </button>
            );
          })}
        </div>

        {localSelectedIds.length > 0 && (
          <p className="text-xs text-gray-500">
            {localSelectedIds.length}명 선택됨
          </p>
        )}
      </div>
    </Card>
  );
}

