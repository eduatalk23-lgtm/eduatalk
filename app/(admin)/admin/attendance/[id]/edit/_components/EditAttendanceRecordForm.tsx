"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAttendanceRecord } from "@/app/(admin)/actions/attendanceActions";
import type { UpdateAttendanceRecordRequest } from "@/lib/types/attendance";
import Button from "@/components/atoms/Button";
import Input from "@/components/atoms/Input";
import Label from "@/components/atoms/Label";
import { Card, CardContent, CardHeader } from "@/components/molecules/Card";

type CheckInMethod = "manual" | "qr" | "location" | "auto";
type AttendanceStatus = "present" | "absent" | "late" | "early_leave" | "excused";

type EditAttendanceRecordFormProps = {
  recordId: string;
  initialData: {
    check_in_time?: string | null;
    check_out_time?: string | null;
    check_in_method?: string | null;
    check_out_method?: string | null;
    status?: string;
    notes?: string | null;
  };
};

export function EditAttendanceRecordForm({
  recordId,
  initialData,
}: EditAttendanceRecordFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  
  // datetime-local 형식으로 변환 (YYYY-MM-DDTHH:mm)
  const formatDateTimeLocal = (isoString: string | null | undefined): string => {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch {
      return "";
    }
  };
  
  // 타입 가드 함수
  const isValidCheckInMethod = (value: string | null | undefined): value is CheckInMethod | null => {
    if (!value) return true; // null 허용
    return ["manual", "qr", "location", "auto"].includes(value);
  };

  const isValidStatus = (value: string | null | undefined): value is AttendanceStatus => {
    if (!value) return false;
    return ["present", "absent", "late", "early_leave", "excused"].includes(value);
  };

  const [formData, setFormData] = useState<UpdateAttendanceRecordRequest>({
    check_in_time: formatDateTimeLocal(initialData.check_in_time),
    check_out_time: formatDateTimeLocal(initialData.check_out_time),
    check_in_method: isValidCheckInMethod(initialData.check_in_method) 
      ? (initialData.check_in_method as CheckInMethod | null)
      : null,
    check_out_method: isValidCheckInMethod(initialData.check_out_method)
      ? (initialData.check_out_method as CheckInMethod | null)
      : null,
    status: isValidStatus(initialData.status) 
      ? initialData.status 
      : "present",
    notes: initialData.notes || "",
    reason: "", // 필수
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!formData.reason.trim()) {
      setError("수정 사유를 입력해주세요.");
      return;
    }
    
    // datetime-local을 ISO 형식으로 변환
    const submitData: UpdateAttendanceRecordRequest = {
      ...formData,
      check_in_time: formData.check_in_time
        ? new Date(formData.check_in_time).toISOString()
        : null,
      check_out_time: formData.check_out_time
        ? new Date(formData.check_out_time).toISOString()
        : null,
    };
    
    startTransition(async () => {
      const result = await updateAttendanceRecord(recordId, submitData);
      if (result.success) {
        router.push(`/admin/attendance`);
        router.refresh();
      } else {
        setError(result.error || "수정에 실패했습니다.");
      }
    });
  };
  
  return (
    <Card>
      <CardHeader title="출석 기록 수정" />
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* 시간 입력 필드 */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="check_in_time">입실 시간</Label>
              <Input
                id="check_in_time"
                type="datetime-local"
                value={formData.check_in_time || ""}
                onChange={(e) =>
                  setFormData({ ...formData, check_in_time: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="check_out_time">퇴실 시간</Label>
              <Input
                id="check_out_time"
                type="datetime-local"
                value={formData.check_out_time || ""}
                onChange={(e) =>
                  setFormData({ ...formData, check_out_time: e.target.value })
                }
              />
            </div>
          </div>
          
          {/* 방법 선택 */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="check_in_method">입실 방법</Label>
              <select
                id="check_in_method"
                value={formData.check_in_method || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    check_in_method: e.target.value || null,
                  } as UpdateAttendanceRecordRequest)
                }
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900/20 dark:focus:ring-gray-100/20"
              >
                <option value="">선택 안 함</option>
                <option value="manual">수동</option>
                <option value="qr">QR 코드</option>
                <option value="location">위치</option>
                <option value="auto">자동</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="check_out_method">퇴실 방법</Label>
              <select
                id="check_out_method"
                value={formData.check_out_method || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    check_out_method: e.target.value || null,
                  } as UpdateAttendanceRecordRequest)
                }
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900/20 dark:focus:ring-gray-100/20"
              >
                <option value="">선택 안 함</option>
                <option value="manual">수동</option>
                <option value="qr">QR 코드</option>
                <option value="location">위치</option>
                <option value="auto">자동</option>
              </select>
            </div>
          </div>
          
          {/* 상태 선택 */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="status">출석 상태</Label>
            <select
              id="status"
              value={formData.status || ""}
              onChange={(e) => {
                const value = e.target.value;
                if (isValidStatus(value)) {
                  setFormData({ ...formData, status: value });
                } else {
                  setFormData({ ...formData, status: "present" });
                }
              }}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900/20 dark:focus:ring-gray-100/20"
            >
              <option value="present">출석</option>
              <option value="absent">결석</option>
              <option value="late">지각</option>
              <option value="early_leave">조퇴</option>
              <option value="excused">공결</option>
            </select>
          </div>
          
          {/* 메모 */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="notes">메모</Label>
            <textarea
              id="notes"
              value={formData.notes || ""}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900/20 dark:focus:ring-gray-100/20"
              rows={3}
            />
          </div>
          
          {/* 수정 사유 (필수) */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="reason">
              수정 사유 <span className="text-red-500">*</span>
            </Label>
            <textarea
              id="reason"
              value={formData.reason}
              onChange={(e) =>
                setFormData({ ...formData, reason: e.target.value })
              }
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900/20 dark:focus:ring-gray-100/20"
              rows={3}
              required
              placeholder="수정 사유를 입력해주세요."
            />
          </div>
          
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-800 dark:text-red-200">
              {error}
            </div>
          )}
          
          <div className="flex gap-3">
            <Button type="submit" disabled={isPending} isLoading={isPending}>
              {isPending ? "수정 중..." : "수정하기"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isPending}
            >
              취소
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

