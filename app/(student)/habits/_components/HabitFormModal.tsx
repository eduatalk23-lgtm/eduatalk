"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import * as Icons from "lucide-react";
import { X, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/ToastProvider";
import { createHabit, updateHabit } from "@/lib/domains/habit";
import {
  HABIT_ICONS,
  HABIT_COLORS,
  WEEKDAY_LABELS,
  type FrequencyType,
  type HabitWithLogs,
} from "@/lib/domains/habit/types";

interface HabitFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  habit: HabitWithLogs | null;
  studentId: string;
  tenantId: string;
}

export function HabitFormModal({
  open,
  onOpenChange,
  habit,
  studentId,
  tenantId,
}: HabitFormModalProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();

  const isEditing = !!habit;

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("Check");
  const [color, setColor] = useState("#3B82F6");
  const [frequencyType, setFrequencyType] = useState<FrequencyType>("daily");
  const [frequencyDays, setFrequencyDays] = useState<number[]>([]);
  const [targetCount, setTargetCount] = useState(1);

  // Reset form when opening/closing or habit changes
  useEffect(() => {
    if (open && habit) {
      setTitle(habit.title);
      setDescription(habit.description || "");
      setIcon(habit.icon);
      setColor(habit.color);
      setFrequencyType(habit.frequencyType);
      setFrequencyDays(habit.frequencyDays);
      setTargetCount(habit.targetCount);
    } else if (open && !habit) {
      setTitle("");
      setDescription("");
      setIcon("Check");
      setColor("#3B82F6");
      setFrequencyType("daily");
      setFrequencyDays([]);
      setTargetCount(1);
    }
  }, [open, habit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      showToast("습관 이름을 입력해주세요.", "error");
      return;
    }

    startTransition(async () => {
      if (isEditing) {
        const result = await updateHabit(habit.id, {
          title: title.trim(),
          description: description.trim() || null,
          icon,
          color,
          frequencyType,
          frequencyDays,
          targetCount,
        });

        if (result.success) {
          showToast("습관이 수정되었습니다.", "success");
          onOpenChange(false);
          router.refresh();
        } else {
          showToast(result.error || "수정 실패", "error");
        }
      } else {
        const result = await createHabit({
          tenantId,
          studentId,
          title: title.trim(),
          description: description.trim() || undefined,
          icon,
          color,
          frequencyType,
          frequencyDays,
          targetCount,
        });

        if (result.success) {
          showToast("새 습관이 추가되었습니다.", "success");
          onOpenChange(false);
          router.refresh();
        } else {
          showToast(result.error || "생성 실패", "error");
        }
      }
    });
  };

  const toggleFrequencyDay = (day: number) => {
    setFrequencyDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">
            {isEditing ? "습관 수정" : "새 습관 추가"}
          </h2>
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              습관 이름 *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 물 3잔 마시기"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              설명 (선택)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="습관에 대한 메모"
              rows={2}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>

          {/* Icon */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              아이콘
            </label>
            <div className="grid grid-cols-6 gap-2">
              {HABIT_ICONS.map(({ name, label }) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const IconComponent = (Icons as any)[name];
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setIcon(name)}
                    className={cn(
                      "flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all",
                      icon === name
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                    title={label}
                  >
                    <IconComponent className="w-5 h-5" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              색상
            </label>
            <div className="flex gap-2 flex-wrap">
              {HABIT_COLORS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setColor(value)}
                  className={cn(
                    "w-8 h-8 rounded-full transition-all",
                    color === value ? "ring-2 ring-offset-2 ring-gray-400" : ""
                  )}
                  style={{ backgroundColor: value }}
                  title={label}
                />
              ))}
            </div>
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              빈도
            </label>
            <div className="flex gap-2 mb-3">
              {(["daily", "weekly", "custom"] as FrequencyType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFrequencyType(type)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                    frequencyType === type
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  )}
                >
                  {type === "daily" ? "매일" : type === "weekly" ? "매주" : "특정 요일"}
                </button>
              ))}
            </div>

            {frequencyType === "custom" && (
              <div className="flex gap-2">
                {WEEKDAY_LABELS.map((label, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => toggleFrequencyDay(index)}
                    className={cn(
                      "w-10 h-10 rounded-full text-sm font-medium transition-all",
                      frequencyDays.includes(index)
                        ? "bg-blue-500 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Target Count */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              하루 목표 횟수
            </label>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setTargetCount(Math.max(1, targetCount - 1))}
                className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
              >
                -
              </button>
              <span className="text-2xl font-bold w-12 text-center">{targetCount}</span>
              <button
                type="button"
                onClick={() => setTargetCount(Math.min(99, targetCount + 1))}
                className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
              >
                +
              </button>
              <span className="text-gray-500">회</span>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                처리 중...
              </>
            ) : isEditing ? (
              "수정하기"
            ) : (
              "추가하기"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
