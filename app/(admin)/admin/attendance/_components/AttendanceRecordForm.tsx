"use client";

import { useState, useTransition } from "react";
import { recordAttendanceAction } from "@/app/(admin)/actions/attendanceActions";
import Button from "@/components/atoms/Button";
import Input from "@/components/atoms/Input";
import Label from "@/components/atoms/Label";
import Select from "@/components/atoms/Select";
import type { AttendanceStatus, CheckMethod } from "@/lib/domains/attendance/types";
import {
  ATTENDANCE_STATUS_LABELS,
  CHECK_METHOD_LABELS,
} from "@/lib/domains/attendance/types";

type AttendanceRecordFormProps = {
  studentId: string;
  studentName: string;
  defaultDate?: string;
  onSuccess?: () => void;
};

export function AttendanceRecordForm({
  studentId,
  studentName,
  defaultDate,
  onSuccess,
}: AttendanceRecordFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 오늘 날짜를 기본값으로 사용
  const today = defaultDate || new Date().toISOString().slice(0, 10);

  const [formData, setFormData] = useState({
    attendance_date: today,
    check_in_time: "",
    check_out_time: "",
    check_in_method: "manual" as CheckMethod | "",
    check_out_method: "manual" as CheckMethod | "",
    status: "present" as AttendanceStatus,
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      try {
        const result = await recordAttendanceAction({
          student_id: studentId,
          attendance_date: formData.attendance_date,
          check_in_time: formData.check_in_time || null,
          check_out_time: formData.check_out_time || null,
          check_in_method: formData.check_in_method || null,
          check_out_method: formData.check_out_method || null,
          status: formData.status,
          notes: formData.notes || null,
        });

        if (result.success) {
          setSuccess(true);
          if (onSuccess) {
            onSuccess();
          }
          // 폼 초기화
          setTimeout(() => {
            setFormData({
              attendance_date: today,
              check_in_time: "",
              check_out_time: "",
              check_in_method: "manual",
              check_out_method: "manual",
              status: "present",
              notes: "",
            });
            setSuccess(false);
          }, 2000);
        } else {
          setError(result.error || "출석 기록 저장에 실패했습니다.");
        }
      } catch (err: any) {
        setError(err.message || "출석 기록 저장 중 오류가 발생했습니다.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="student_name">학생</Label>
        <Input
          id="student_name"
          value={studentName}
          disabled
          className="bg-gray-50"
        />
      </div>

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

      <div>
        <Label htmlFor="notes">비고</Label>
        <textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          rows={3}
        />
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-green-50 p-3 text-sm text-green-600">
          출석 기록이 저장되었습니다.
        </div>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? "저장 중..." : "저장"}
      </Button>
    </form>
  );
}

type AttendanceRecordFormWithStudentSelectProps = {
  students: Array<{ id: string; name: string | null }>;
  defaultDate?: string;
  onSuccess?: () => void;
};

export function AttendanceRecordFormWithStudentSelect({
  students,
  defaultDate,
  onSuccess,
}: AttendanceRecordFormWithStudentSelectProps) {
  const [selectedStudentId, setSelectedStudentId] = useState(
    students[0]?.id || ""
  );

  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  if (!selectedStudent) {
    return (
      <p className="text-sm text-gray-500">등록된 학생이 없습니다.</p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="student_select">학생 선택 *</Label>
        <Select
          id="student_select"
          value={selectedStudentId}
          onChange={(e) => setSelectedStudentId(e.target.value)}
          required
        >
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.name || "이름 없음"}
            </option>
          ))}
        </Select>
      </div>
      <AttendanceRecordForm
        studentId={selectedStudentId}
        studentName={selectedStudent.name || ""}
        defaultDate={defaultDate}
        onSuccess={onSuccess}
      />
    </div>
  );
}

