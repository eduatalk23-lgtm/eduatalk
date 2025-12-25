"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import Button from "@/components/atoms/Button";
import Input from "@/components/atoms/Input";
import Label from "@/components/atoms/Label";
import Select from "@/components/atoms/Select";
import { useRecordAttendance } from "@/lib/hooks/useAttendance";
import { useToast } from "@/components/ui/ToastProvider";
import type { AttendanceStatus, CheckMethod } from "@/lib/domains/attendance/types";
import {
  ATTENDANCE_STATUS_LABELS,
  CHECK_METHOD_LABELS,
} from "@/lib/domains/attendance/types";

type CampAttendanceInputModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
  defaultDate?: string;
  onSuccess?: () => void;
};

export function CampAttendanceInputModal({
  open,
  onOpenChange,
  studentId,
  studentName,
  defaultDate,
  onSuccess,
}: CampAttendanceInputModalProps) {
  const recordAttendance = useRecordAttendance();
  const { showSuccess, showError, showWarning } = useToast();

  const today = defaultDate || new Date().toISOString().slice(0, 10);

  const [formData, setFormData] = useState({
    attendance_date: today,
    check_in_time: "",
    check_out_time: "",
    check_in_method: "manual" as CheckMethod,
    check_out_method: "manual" as CheckMethod,
    status: "present" as AttendanceStatus,
    notes: "",
  });

  const resetForm = () => {
    setFormData({
      attendance_date: today,
      check_in_time: "",
      check_out_time: "",
      check_in_method: "manual",
      check_out_method: "manual",
      status: "present",
      notes: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      const result = await recordAttendance.mutateAsync({
        student_id: studentId,
        attendance_date: formData.attendance_date,
        check_in_time: formData.check_in_time || null,
        check_out_time: formData.check_out_time || null,
        check_in_method: formData.check_in_method || null,
        check_out_method: formData.check_out_method || null,
        status: formData.status,
        notes: formData.notes || null,
      });

      showSuccess("출석 기록이 저장되었습니다.");

      if (result.smsResult && !result.smsResult.success && !result.smsResult.skipped) {
        showWarning(`SMS 발송 실패: ${result.smsResult.error || "알 수 없는 오류"}`);
      }

      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "출석 기록 저장 중 오류가 발생했습니다.";
      showError(errorMessage);
    }
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={handleClose}
      title="출석 기록 추가"
      description={`${studentName} 학생의 출석을 기록합니다.`}
      size="md"
      showCloseButton
    >
      <form onSubmit={handleSubmit}>
        <DialogContent className="space-y-4 overflow-y-auto max-h-[60vh]">
          <div>
            <Label htmlFor="attendance_date">출석 날짜 *</Label>
            <Input
              id="attendance_date"
              type="date"
              value={formData.attendance_date}
              onChange={(e) =>
                setFormData({ ...formData, attendance_date: e.target.value })
              }
              required
            />
          </div>

          <div>
            <Label htmlFor="status">출석 상태 *</Label>
            <Select
              id="status"
              value={formData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value as AttendanceStatus })
              }
              required
            >
              {Object.entries(ATTENDANCE_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="check_in_time">입실 시간</Label>
              <Input
                id="check_in_time"
                type="time"
                value={formData.check_in_time}
                onChange={(e) =>
                  setFormData({ ...formData, check_in_time: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="check_out_time">퇴실 시간</Label>
              <Input
                id="check_out_time"
                type="time"
                value={formData.check_out_time}
                onChange={(e) =>
                  setFormData({ ...formData, check_out_time: e.target.value })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="check_in_method">입실 방법</Label>
              <Select
                id="check_in_method"
                value={formData.check_in_method}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    check_in_method: e.target.value as CheckMethod,
                  })
                }
              >
                {Object.entries(CHECK_METHOD_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="check_out_method">퇴실 방법</Label>
              <Select
                id="check_out_method"
                value={formData.check_out_method}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    check_out_method: e.target.value as CheckMethod,
                  })
                }
              >
                {Object.entries(CHECK_METHOD_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="notes">비고</Label>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              rows={3}
              placeholder="추가 메모를 입력하세요"
            />
          </div>
        </DialogContent>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={recordAttendance.isPending}
          >
            취소
          </Button>
          <Button type="submit" isLoading={recordAttendance.isPending}>
            저장
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
