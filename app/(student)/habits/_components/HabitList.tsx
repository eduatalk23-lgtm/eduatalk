"use client";

import { useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import { HabitCard } from "./HabitCard";
import { HabitFormModal } from "./HabitFormModal";
import type { HabitWithLogs } from "@/lib/domains/habit/types";

interface HabitListProps {
  habits: HabitWithLogs[];
  studentId: string;
  tenantId: string;
  today: string;
}

export function HabitList({ habits, studentId, tenantId, today }: HabitListProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<HabitWithLogs | null>(null);

  const activeHabits = habits.filter((h) => h.status === "active");
  const pausedHabits = habits.filter((h) => h.status === "paused");
  const completedToday = activeHabits.filter(
    (h) => h.todayLog && h.todayLog.completedCount >= h.targetCount
  ).length;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5" />
          <h2 className="text-lg font-semibold">오늘의 습관</h2>
        </div>
        <div className="text-3xl font-bold mb-1">
          {completedToday} / {activeHabits.length}
        </div>
        <p className="text-white/80 text-sm">
          {completedToday === activeHabits.length
            ? "모든 습관을 완료했습니다!"
            : `${activeHabits.length - completedToday}개 남았습니다`}
        </p>
      </div>

      {/* Add Button */}
      <button
        onClick={() => {
          setEditingHabit(null);
          setIsModalOpen(true);
        }}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors"
      >
        <Plus className="w-5 h-5" />
        <span>새 습관 추가</span>
      </button>

      {/* Active Habits */}
      {activeHabits.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-500 px-1">활성 습관</h3>
          {activeHabits.map((habit) => (
            <HabitCard
              key={habit.id}
              habit={habit}
              today={today}
              onEdit={(h) => {
                setEditingHabit(h);
                setIsModalOpen(true);
              }}
            />
          ))}
        </div>
      )}

      {/* Paused Habits */}
      {pausedHabits.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-500 px-1">일시정지된 습관</h3>
          {pausedHabits.map((habit) => (
            <HabitCard
              key={habit.id}
              habit={habit}
              today={today}
              onEdit={(h) => {
                setEditingHabit(h);
                setIsModalOpen(true);
              }}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {habits.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Sparkles className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium mb-2">아직 습관이 없습니다</h3>
          <p className="text-sm">새 습관을 추가하여 매일 꾸준히 실천해보세요!</p>
        </div>
      )}

      {/* Modal */}
      <HabitFormModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        habit={editingHabit}
        studentId={studentId}
        tenantId={tenantId}
      />
    </div>
  );
}
