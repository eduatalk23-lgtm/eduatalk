"use client";

import Label from "@/components/atoms/Label";

type SchedulePickerProps = {
  sendType: "immediate" | "scheduled";
  scheduledDate: string;
  scheduledTime: string;
  onSendTypeChange: (type: "immediate" | "scheduled") => void;
  onScheduledDateChange: (date: string) => void;
  onScheduledTimeChange: (time: string) => void;
};

export function SchedulePicker({
  sendType,
  scheduledDate,
  scheduledTime,
  onSendTypeChange,
  onScheduledDateChange,
  onScheduledTimeChange,
}: SchedulePickerProps) {
  // 오늘 날짜 (min용)
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="flex flex-col gap-2">
      <Label>발송 시점</Label>
      <div className="flex flex-col gap-3">
        <div className="flex gap-4">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="sendType"
              value="immediate"
              checked={sendType === "immediate"}
              onChange={() => onSendTypeChange("immediate")}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700">즉시 발송</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="sendType"
              value="scheduled"
              checked={sendType === "scheduled"}
              onChange={() => onSendTypeChange("scheduled")}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700">예약 발송</span>
          </label>
        </div>

        {sendType === "scheduled" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => onScheduledDateChange(e.target.value)}
              min={today}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <input
              type="time"
              value={scheduledTime}
              onChange={(e) => onScheduledTimeChange(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <span className="text-xs text-gray-500">(KST)</span>
          </div>
        )}
      </div>
    </div>
  );
}
