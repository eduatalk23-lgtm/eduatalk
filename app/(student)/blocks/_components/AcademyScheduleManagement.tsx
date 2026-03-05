"use client";

import { useEffect, useState, useTransition } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  createAcademy,
  updateAcademy,
  deleteAcademy,
  addAcademySchedule,
  updateAcademySchedule,
  deleteAcademySchedule
} from "@/lib/domains/plan";
import type { AcademySchedule } from "@/lib/types/plan";
import { Trash2, Pencil, Plus } from "lucide-react";
import { EmptyState } from "@/components/molecules/EmptyState";
import { validateAcademyScheduleOverlap } from "@/lib/validation/scheduleValidator";
import { SuspenseFallback } from "@/components/ui/LoadingSkeleton";
import { useToast } from "@/components/ui/ToastProvider";
import { ConfirmDialog } from "@/components/ui/Dialog";

type AcademyScheduleManagementProps = {
  studentId: string;
  onAddRequest?: () => void;
  isAddingAcademy?: boolean;
};

const weekdayLabels = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

type AcademyWithSchedules = {
  name: string;
  travel_time: number;
  schedules: AcademySchedule[];
};

// 학원 카드 스타일 상수
const getAcademyCardClassName = (isSelected: boolean, isChecked: boolean) => {
  const baseClasses = "flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors cursor-pointer";
  const selectedClasses = "border-gray-900 dark:border-gray-400 bg-gray-50 dark:bg-gray-700";
  const checkedClasses = "border-indigo-500 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30";
  const unselectedClasses = "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700";

  if (isChecked) return `${baseClasses} ${checkedClasses}`;
  return `${baseClasses} ${isSelected ? selectedClasses : unselectedClasses}`;
};

export default function AcademyScheduleManagement({
  studentId,
  onAddRequest,
  isAddingAcademy = false,
}: AcademyScheduleManagementProps) {
  const [academies, setAcademies] = useState<AcademyWithSchedules[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 학원 관리 상태
  const [editingAcademyName, setEditingAcademyName] = useState<string | null>(null);
  const [newAcademyName, setNewAcademyName] = useState("");
  const [newAcademyTravelTime, setNewAcademyTravelTime] = useState("60");

  // 학원 일정 관리 상태
  const [selectedAcademyName, setSelectedAcademyName] = useState<string | null>(null);
  const [isAddingSchedule, setIsAddingSchedule] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [scheduleStartTime, setScheduleStartTime] = useState("09:00");
  const [scheduleEndTime, setScheduleEndTime] = useState("10:00");
  const [scheduleSubject, setScheduleSubject] = useState("");
  
  const [isPending, startTransition] = useTransition();

  // Toast & Confirm Dialog
  const { showWarning, showError, showSuccess } = useToast();
  const [deleteAcademyConfirmOpen, setDeleteAcademyConfirmOpen] = useState(false);
  const [academyToDelete, setAcademyToDelete] = useState<string | null>(null); // academy name
  const [deleteScheduleConfirmOpen, setDeleteScheduleConfirmOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null);

  // 다중 선택 상태 (학원 - name 기반)
  const [selectedAcademyNames, setSelectedAcademyNames] = useState<string[]>([]);
  const [batchDeleteAcademyConfirmOpen, setBatchDeleteAcademyConfirmOpen] = useState(false);

  // 다중 선택 상태 (일정)
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<string[]>([]);
  const [batchDeleteScheduleConfirmOpen, setBatchDeleteScheduleConfirmOpen] = useState(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const loadData = async () => {
    try {
      // 학원 일정 조회 (calendar_events 기반)
      const { data: calendarEvents } = await supabase
        .from("calendar_events")
        .select("id, tenant_id, student_id, label, event_subtype, title, day_of_week, start_time, end_time, metadata, created_at, updated_at")
        .eq("student_id", studentId)
        .eq("label", "학원")
        .is("deleted_at", null);

      // calendar_events에서 주간 패턴 재구성 → AcademySchedule 형태로 변환
      const schedulePatterns: Map<string, AcademySchedule> = new Map();
      for (const ev of calendarEvents ?? []) {
        if (ev.day_of_week == null || !ev.start_time || !ev.end_time) continue;
        let academyName: string | null = null;
        let subject: string | null = null;
        if (ev.title) {
          const match = ev.title.match(/^(.+?)\s*\((.+)\)$/);
          if (match) {
            academyName = match[1].trim();
            subject = match[2].trim();
          } else {
            academyName = ev.title;
          }
        }
        const key = `${ev.day_of_week}-${ev.start_time}-${ev.end_time}-${academyName ?? ""}`;
        if (!schedulePatterns.has(key)) {
          schedulePatterns.set(key, {
            id: ev.id,
            tenant_id: ev.tenant_id,
            student_id: ev.student_id,
            day_of_week: ev.day_of_week,
            start_time: ev.start_time,
            end_time: ev.end_time,
            academy_name: academyName,
            subject,
            created_at: ev.created_at,
            updated_at: ev.updated_at,
          } as AcademySchedule);
        }
      }
      const allSchedules = Array.from(schedulePatterns.values());

      // 학원명 기준 그룹핑 → 가상 학원 목록 도출
      const academyMap = new Map<string, { travel_time: number; schedules: AcademySchedule[] }>();
      for (const schedule of allSchedules) {
        const name = schedule.academy_name || "학원";
        const existing = academyMap.get(name);
        if (!existing) {
          // travel_time은 calendar_events의 metadata에서 추출 (첫 이벤트 기준)
          const ev = (calendarEvents ?? []).find(
            (e) => e.title?.startsWith(name) && e.metadata
          );
          const travelTime =
            (ev?.metadata as Record<string, unknown> | null)?.travel_time as number | undefined;
          academyMap.set(name, {
            travel_time: travelTime ?? 60,
            schedules: [schedule],
          });
        } else {
          existing.schedules.push(schedule);
        }
      }

      // 정렬
      const academiesWithSchedules: AcademyWithSchedules[] = Array.from(
        academyMap.entries()
      )
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, info]) => ({
          name,
          travel_time: info.travel_time,
          schedules: info.schedules.sort((a, b) => {
            if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
            return a.start_time.localeCompare(b.start_time);
          }),
        }));

      setAcademies(academiesWithSchedules);

      // 첫 번째 학원을 기본 선택
      if (academiesWithSchedules.length > 0 && !selectedAcademyName) {
        setSelectedAcademyName(academiesWithSchedules[0].name);
      }
    } catch (error: unknown) {
      console.error("학원 일정 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  // 학원 추가
  const handleAddAcademy = async () => {
    if (!newAcademyName.trim()) {
      showWarning("학원 이름을 입력해주세요.");
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("name", newAcademyName.trim());
        formData.append("travel_time", newAcademyTravelTime);

        await createAcademy(formData);

        setNewAcademyName("");
        setNewAcademyTravelTime("60");
        onAddRequest?.(); // 상위 컴포넌트에 상태 토글 요청

        showSuccess("학원이 추가되었습니다.");
        await loadData();
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "학원 추가에 실패했습니다.";
        showError(errorMessage);
      }
    });
  };

  // 학원 수정 시작
  const handleStartEditAcademy = (academy: AcademyWithSchedules) => {
    setEditingAcademyName(academy.name);
    setNewAcademyName(academy.name);
    setNewAcademyTravelTime(String(academy.travel_time));
    onAddRequest?.(); // isAddingAcademy가 false로 변경되도록 요청
  };

  // 학원 수정
  const handleUpdateAcademy = async () => {
    if (!editingAcademyName || !newAcademyName.trim()) {
      showWarning("학원 이름을 입력해주세요.");
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("academy_name", editingAcademyName);
        formData.append("name", newAcademyName.trim());
        formData.append("travel_time", newAcademyTravelTime);

        await updateAcademy(formData);

        // 이름이 변경된 경우 선택 상태 업데이트
        if (selectedAcademyName === editingAcademyName) {
          setSelectedAcademyName(newAcademyName.trim());
        }

        setEditingAcademyName(null);
        setNewAcademyName("");
        setNewAcademyTravelTime("60");

        showSuccess("학원이 수정되었습니다.");
        await loadData();
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "학원 수정에 실패했습니다.";
        showError(errorMessage);
      }
    });
  };

  // 학원 삭제 클릭
  const handleDeleteAcademyClick = (academyName: string) => {
    setAcademyToDelete(academyName);
    setDeleteAcademyConfirmOpen(true);
  };

  // 학원 삭제 확인
  const handleDeleteAcademyConfirm = () => {
    if (!academyToDelete) return;

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("academy_name", academyToDelete);

        await deleteAcademy(formData);

        if (selectedAcademyName === academyToDelete) {
          setSelectedAcademyName(null);
        }

        showSuccess("학원이 삭제되었습니다.");
        await loadData();
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "학원 삭제에 실패했습니다.";
        showError(errorMessage);
      } finally {
        setDeleteAcademyConfirmOpen(false);
        setAcademyToDelete(null);
      }
    });
  };

  // 학원 일정 추가
  const handleAddSchedule = async () => {
    if (!selectedAcademyName) {
      showWarning("학원을 선택해주세요.");
      return;
    }

    if (selectedDays.length === 0) {
      showWarning("요일을 선택해주세요.");
      return;
    }

    if (!scheduleSubject.trim()) {
      showWarning("과목을 입력해주세요.");
      return;
    }

    if (scheduleStartTime >= scheduleEndTime) {
      showWarning("종료 시간은 시작 시간보다 늦어야 합니다.");
      return;
    }

    const curAcademy = academies.find((a) => a.name === selectedAcademyName);
    if (!curAcademy) return;

    // 겹침 검증
    const newSchedules = selectedDays.map((day) => ({
      day_of_week: day,
      start_time: scheduleStartTime,
      end_time: scheduleEndTime,
      academy_name: curAcademy.name,
      subject: scheduleSubject.trim(),
      travel_time: curAcademy.travel_time,
    }));

    // 기존 일정과 겹침 확인
    for (const newSchedule of newSchedules) {
      const validation = validateAcademyScheduleOverlap(
        newSchedule,
        selectedAcademySchedules.map(s => ({
          day_of_week: s.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time,
          academy_name: s.academy_name ?? undefined,
          subject: s.subject ?? undefined,
          travel_time: s.travel_time ?? undefined,
        }))
      );
      if (!validation.isValid) {
        showWarning(
          `${weekdayLabels[newSchedule.day_of_week]}에 겹치는 학원 일정이 있습니다. 시간을 조정해주세요.`
        );
        return;
      }
    }

    startTransition(async () => {
      try {
        // 선택한 모든 요일에 대해 일정 추가
        for (const day of selectedDays) {
          const formData = new FormData();
          formData.append("day_of_week", String(day));
          formData.append("start_time", scheduleStartTime);
          formData.append("end_time", scheduleEndTime);
          formData.append("academy_name", curAcademy.name);
          formData.append("subject", scheduleSubject.trim());

          await addAcademySchedule(formData);
        }

        // 폼 초기화
        setSelectedDays([]);
        setScheduleStartTime("09:00");
        setScheduleEndTime("10:00");
        setScheduleSubject("");
        setIsAddingSchedule(false);

        showSuccess(`${selectedDays.length}개의 일정이 추가되었습니다.`);
        await loadData();
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "학원 일정 추가에 실패했습니다.";
        showError(errorMessage);
      }
    });
  };

  // 학원 일정 수정 시작
  const handleStartEditSchedule = (schedule: AcademySchedule) => {
    setEditingScheduleId(schedule.id);
    setSelectedDays([schedule.day_of_week]);
    setScheduleStartTime(schedule.start_time);
    setScheduleEndTime(schedule.end_time);
    setScheduleSubject(schedule.subject || "");
    setIsAddingSchedule(false);
  };

  // 학원 일정 수정
  const handleUpdateSchedule = async () => {
    if (!editingScheduleId || selectedDays.length === 0 || !scheduleSubject.trim()) {
      showWarning("요일과 과목을 입력해주세요.");
      return;
    }

    if (scheduleStartTime >= scheduleEndTime) {
      showWarning("종료 시간은 시작 시간보다 늦어야 합니다.");
      return;
    }

    const curAcademy = academies.find((a) => a.name === selectedAcademyName);
    if (!curAcademy) return;

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("schedule_id", editingScheduleId);
        formData.append("day_of_week", String(selectedDays[0])); // 수정 시에는 첫 번째 요일만
        formData.append("start_time", scheduleStartTime);
        formData.append("end_time", scheduleEndTime);
        formData.append("academy_name", curAcademy.name);
        formData.append("subject", scheduleSubject.trim());

        await updateAcademySchedule(formData);

        // 폼 초기화
        setEditingScheduleId(null);
        setSelectedDays([]);
        setScheduleStartTime("09:00");
        setScheduleEndTime("10:00");
        setScheduleSubject("");

        showSuccess("일정이 수정되었습니다.");
        await loadData();
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "학원 일정 수정에 실패했습니다.";
        showError(errorMessage);
      }
    });
  };

  // 학원 일정 삭제 클릭
  const handleDeleteScheduleClick = (scheduleId: string) => {
    setScheduleToDelete(scheduleId);
    setDeleteScheduleConfirmOpen(true);
  };

  // 학원 일정 삭제 확인
  const handleDeleteScheduleConfirm = () => {
    if (!scheduleToDelete) return;

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("schedule_id", scheduleToDelete);

        await deleteAcademySchedule(formData);

        showSuccess("일정이 삭제되었습니다.");
        await loadData();
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "학원 일정 삭제에 실패했습니다.";
        showError(errorMessage);
      } finally {
        setDeleteScheduleConfirmOpen(false);
        setScheduleToDelete(null);
      }
    });
  };

  // ========== 다중 선택 핸들러 (학원) ==========
  const toggleAcademySelection = (name: string) => {
    setSelectedAcademyNames((prev) =>
      prev.includes(name)
        ? prev.filter((n) => n !== name)
        : [...prev, name]
    );
  };

  const selectAllAcademies = () => {
    setSelectedAcademyNames(academies.map((a) => a.name));
  };

  const clearAcademySelection = () => {
    setSelectedAcademyNames([]);
  };

  const isAllAcademiesSelected =
    academies.length > 0 && selectedAcademyNames.length === academies.length;
  const hasAcademySelection = selectedAcademyNames.length > 0;

  const handleBatchDeleteAcademyClick = () => {
    if (selectedAcademyNames.length === 0) return;
    setBatchDeleteAcademyConfirmOpen(true);
  };

  const handleBatchDeleteAcademyConfirm = () => {
    if (selectedAcademyNames.length === 0) return;

    startTransition(async () => {
      try {
        const results = await Promise.all(
          selectedAcademyNames.map(async (name) => {
            try {
              const formData = new FormData();
              formData.append("academy_name", name);
              await deleteAcademy(formData);
              return { success: true, name };
            } catch {
              return { success: false, name };
            }
          })
        );

        const successCount = results.filter((r) => r.success).length;
        const failCount = results.length - successCount;

        if (failCount > 0) {
          showError(`${failCount}개 학원 삭제 실패`);
        }

        if (successCount > 0) {
          showSuccess(`${successCount}개 학원이 삭제되었습니다.`);
          if (selectedAcademyName && selectedAcademyNames.includes(selectedAcademyName)) {
            setSelectedAcademyName(null);
          }
        }

        setSelectedAcademyNames([]);
        setBatchDeleteAcademyConfirmOpen(false);
        await loadData();
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "학원 삭제에 실패했습니다.";
        showError(errorMessage);
        setBatchDeleteAcademyConfirmOpen(false);
      }
    });
  };

  // 선택된 학원 정보
  const selectedAcademy = academies.find((a) => a.name === selectedAcademyName);
  const selectedAcademySchedules = selectedAcademy?.schedules ?? [];

  // ========== 다중 선택 핸들러 (일정) ==========
  const toggleScheduleSelection = (scheduleId: string) => {
    setSelectedScheduleIds((prev) =>
      prev.includes(scheduleId)
        ? prev.filter((id) => id !== scheduleId)
        : [...prev, scheduleId]
    );
  };

  const selectAllSchedulesInCurrentAcademy = () => {
    if (!selectedAcademy) return;
    const scheduleIds = selectedAcademy.schedules.map((s) => s.id);
    setSelectedScheduleIds((prev) => [...new Set([...prev, ...scheduleIds])]);
  };

  const clearScheduleSelection = () => {
    setSelectedScheduleIds([]);
  };

  const currentAcademyScheduleIds = selectedAcademy?.schedules.map((s) => s.id) ?? [];
  const selectedSchedulesInCurrentAcademy = selectedScheduleIds.filter((id) =>
    currentAcademyScheduleIds.includes(id)
  );
  const isAllSchedulesInCurrentAcademySelected =
    currentAcademyScheduleIds.length > 0 &&
    selectedSchedulesInCurrentAcademy.length === currentAcademyScheduleIds.length;

  const handleBatchDeleteScheduleClick = () => {
    if (selectedScheduleIds.length === 0) return;
    setBatchDeleteScheduleConfirmOpen(true);
  };

  const handleBatchDeleteScheduleConfirm = () => {
    if (selectedScheduleIds.length === 0) return;

    startTransition(async () => {
      try {
        const results = await Promise.all(
          selectedScheduleIds.map(async (id) => {
            try {
              const formData = new FormData();
              formData.append("schedule_id", id);
              await deleteAcademySchedule(formData);
              return { success: true, id };
            } catch {
              return { success: false, id };
            }
          })
        );

        const successCount = results.filter((r) => r.success).length;
        const failCount = results.length - successCount;

        if (failCount > 0) {
          showError(`${failCount}개 일정 삭제 실패`);
        }

        if (successCount > 0) {
          showSuccess(`${successCount}개 일정이 삭제되었습니다.`);
        }

        setSelectedScheduleIds([]);
        setBatchDeleteScheduleConfirmOpen(false);
        await loadData();
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "일정 삭제에 실패했습니다.";
        showError(errorMessage);
        setBatchDeleteScheduleConfirmOpen(false);
      }
    });
  };

  // 요일 선택 토글
  const toggleDay = (day: number) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter((d) => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  // 요일별로 일정 그룹화
  const schedulesByDay = selectedAcademySchedules.reduce((acc, schedule) => {
    const day = schedule.day_of_week;
    if (!acc[day]) acc[day] = [];
    acc[day].push(schedule);
    return acc;
  }, {} as Record<number, AcademySchedule[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <SuspenseFallback />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 p-4 text-sm text-blue-800 dark:text-blue-300">
        <div className="flex flex-col gap-1">
          <p className="font-medium">📌 학원 단위로 관리합니다.</p>
          <p className="text-xs text-blue-700 dark:text-blue-400">
            학원을 등록하고, 각 학원에 대해 요일별 일정을 설정할 수 있습니다.
          </p>
        </div>
      </div>

      {/* 빈 상태 */}
      {academies.length === 0 && !isAddingAcademy && (
        <EmptyState
          title="등록된 학원이 없습니다"
          description="다니는 학원을 추가하고 일정을 관리하세요."
          icon="🏫"
        />
      )}

      {/* 학원 목록 및 관리 */}
      {(academies.length > 0 || isAddingAcademy || editingAcademyName) && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <div className="flex flex-col gap-4">
            {academies.length > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">학원 목록</h3>
                  {hasAcademySelection && (
                    <span className="rounded-full bg-indigo-100 dark:bg-indigo-900 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-300">
                      {selectedAcademyNames.length}개 선택
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {hasAcademySelection ? (
                    <>
                      <button
                        onClick={clearAcademySelection}
                        className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        선택 해제
                      </button>
                      <button
                        onClick={handleBatchDeleteAcademyClick}
                        disabled={isPending}
                        className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {selectedAcademyNames.length}개 삭제
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            )}

            {/* 학원 추가/수정 폼 */}
            {(isAddingAcademy || editingAcademyName) && (
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 p-4">
                <div className="flex flex-col gap-3">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {editingAcademyName ? "학원 수정" : "학원 추가"}
                  </h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                        학원 이름 <span className="text-red-500">*</span>
                      </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:border-gray-900 dark:focus:border-gray-400 focus:outline-none"
                  placeholder="예: 수학 학원"
                  value={newAcademyName}
                  onChange={(e) => setNewAcademyName(e.target.value)}
                />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                        이동시간 (분) <span className="text-red-500">*</span>
                      </label>
                <input
                  type="number"
                  min="0"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:border-gray-900 dark:focus:border-gray-400 focus:outline-none"
                  placeholder="60"
                  value={newAcademyTravelTime}
                  onChange={(e) => setNewAcademyTravelTime(e.target.value)}
                />
                    </div>
                  </div>
                  <div className="flex gap-2">
              <button
                type="button"
                onClick={editingAcademyName ? handleUpdateAcademy : handleAddAcademy}
                disabled={isPending || !newAcademyName.trim()}
                className="rounded-lg bg-gray-900 dark:bg-gray-100 px-4 py-2 text-sm font-medium text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 disabled:cursor-not-allowed disabled:bg-gray-400 dark:disabled:bg-gray-500"
              >
                {isPending ? (editingAcademyName ? "수정 중..." : "추가 중...") : (editingAcademyName ? "수정" : "추가")}
              </button>
              <button
                type="button"
                onClick={() => {
                  onAddRequest?.(); // 상위 컴포넌트에 상태 토글 요청
                  setEditingAcademyName(null);
                  setNewAcademyName("");
                  setNewAcademyTravelTime("60");
                }}
                disabled={isPending}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                취소
              </button>
                </div>
              </div>
              </div>
            )}

            {/* 학원 목록 */}
          {academies.length > 0 ? (
            <div className="flex flex-col gap-2">
              {/* 전체 선택 헤더 */}
              <div className="flex items-center gap-3 rounded-lg bg-gray-50 dark:bg-gray-700 px-4 py-2">
                <input
                  type="checkbox"
                  checked={isAllAcademiesSelected}
                  onChange={() =>
                    isAllAcademiesSelected ? clearAcademySelection() : selectAllAcademies()
                  }
                  className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {isAllAcademiesSelected ? "전체 선택 해제" : "전체 선택"}
                </span>
              </div>
            {academies.map((academy) => (
              <div
                key={academy.name}
                onClick={() => setSelectedAcademyName(academy.name)}
                className={getAcademyCardClassName(selectedAcademyName === academy.name, selectedAcademyNames.includes(academy.name))}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedAcademyName(academy.name);
                  }
                }}
                aria-label={`${academy.name} 선택`}
                aria-pressed={selectedAcademyName === academy.name}
              >
                {/* 체크박스 */}
                <div
                  className="pr-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={selectedAcademyNames.includes(academy.name)}
                    onChange={() => toggleAcademySelection(academy.name)}
                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {academy.name}
                    </span>
                    {selectedAcademyName === academy.name && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">(선택됨)</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    이동시간: {academy.travel_time}분 | 일정: {academy.schedules.length}개
                  </div>
                </div>
                <div
                  className="pl-4 flex gap-1"
                  onClick={(e) => e.stopPropagation()}
                  role="group"
                  aria-label="학원 관리"
                >
                  <button
                    type="button"
                    onClick={() => handleStartEditAcademy(academy)}
                    disabled={isPending || editingAcademyName !== null}
                    className="rounded p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                    title="수정"
                    aria-label={`${academy.name} 수정`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteAcademyClick(academy.name)}
                    disabled={isPending || editingAcademyName !== null}
                    className="rounded p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:cursor-not-allowed disabled:opacity-50"
                    title="삭제"
                    aria-label={`${academy.name} 삭제`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">등록된 학원이 없습니다. 위에서 학원을 추가해주세요.</p>
          )}

          {!selectedAcademy && academies.length > 0 && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">위에서 학원을 선택해주세요.</p>
            </div>
          )}
          </div>
        </div>
      )}

      {/* 선택된 학원의 일정 관리 */}
      {selectedAcademy && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{selectedAcademy.name}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">이동시간: {selectedAcademy.travel_time}분</p>
                </div>
                {selectedSchedulesInCurrentAcademy.length > 0 && (
                  <span className="rounded-full bg-indigo-100 dark:bg-indigo-900 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-300">
                    {selectedSchedulesInCurrentAcademy.length}개 선택
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectedSchedulesInCurrentAcademy.length > 0 ? (
                  <>
                    <button
                      onClick={clearScheduleSelection}
                      className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      선택 해제
                    </button>
                    <button
                      onClick={handleBatchDeleteScheduleClick}
                      disabled={isPending}
                      className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {selectedSchedulesInCurrentAcademy.length}개 삭제
                    </button>
                  </>
                ) : (
                  !isAddingSchedule && !editingScheduleId && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingSchedule(true);
                        setEditingScheduleId(null);
                        setSelectedDays([]);
                        setScheduleStartTime("09:00");
                        setScheduleEndTime("10:00");
                        setScheduleSubject("");
                      }}
                      className="flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
                    >
                      <Plus className="h-4 w-4" />
                      일정 추가
                    </button>
                  )
                )}
              </div>
            </div>

            {/* 일정 추가/수정 폼 */}
            {(isAddingSchedule || editingScheduleId) && (
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 p-4">
                <div className="flex flex-col gap-3">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {editingScheduleId ? "일정 수정" : "일정 추가"}
                  </h4>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                        요일 (다중 선택 가능) <span className="text-red-500">*</span>
                      </label>
                  <div className="flex flex-wrap gap-2">
                    {weekdayLabels.map((label, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => toggleDay(index)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                          selectedDays.includes(index)
                            ? "border-gray-900 dark:border-gray-400 bg-gray-900 dark:bg-gray-200 text-white dark:text-gray-900"
                            : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="flex flex-col gap-1">
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                        시작 시간 <span className="text-red-500">*</span>
                      </label>
                    <input
                      type="time"
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:border-gray-900 dark:focus:border-gray-400 focus:outline-none"
                      value={scheduleStartTime}
                      onChange={(e) => setScheduleStartTime(e.target.value)}
                    />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                        종료 시간 <span className="text-red-500">*</span>
                      </label>
                    <input
                      type="time"
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:border-gray-900 dark:focus:border-gray-400 focus:outline-none"
                      value={scheduleEndTime}
                      onChange={(e) => setScheduleEndTime(e.target.value)}
                    />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                        과목 <span className="text-red-500">*</span>
                      </label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:border-gray-900 dark:focus:border-gray-400 focus:outline-none"
                      placeholder="예: 수학"
                      value={scheduleSubject}
                      onChange={(e) => setScheduleSubject(e.target.value)}
                    />
                  </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={editingScheduleId ? handleUpdateSchedule : handleAddSchedule}
                    disabled={
                      isPending ||
                      selectedDays.length === 0 ||
                      !scheduleSubject.trim() ||
                      scheduleStartTime >= scheduleEndTime
                    }
                    className="rounded-lg bg-gray-900 dark:bg-gray-100 px-4 py-2 text-sm font-medium text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 disabled:cursor-not-allowed disabled:bg-gray-400 dark:disabled:bg-gray-500"
                  >
                    {isPending
                      ? editingScheduleId
                        ? "수정 중..."
                        : "추가 중..."
                      : editingScheduleId
                        ? "수정"
                        : "추가"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingSchedule(false);
                      setEditingScheduleId(null);
                      setSelectedDays([]);
                      setScheduleStartTime("09:00");
                      setScheduleEndTime("10:00");
                      setScheduleSubject("");
                    }}
                    disabled={isPending}
                    className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
            )}

          {/* 일정 목록 (요일별 그룹화) */}
          {selectedAcademySchedules.length > 0 ? (
            <div className="flex flex-col gap-3">
              {/* 전체 선택 헤더 */}
              <div className="flex items-center gap-3 rounded-lg bg-gray-100 dark:bg-gray-600 px-4 py-2">
                <input
                  type="checkbox"
                  checked={isAllSchedulesInCurrentAcademySelected}
                  onChange={() =>
                    isAllSchedulesInCurrentAcademySelected
                      ? clearScheduleSelection()
                      : selectAllSchedulesInCurrentAcademy()
                  }
                  className="h-4 w-4 rounded border-gray-300 dark:border-gray-500 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {isAllSchedulesInCurrentAcademySelected ? "전체 선택 해제" : "전체 선택"}
                </span>
              </div>
              {Object.entries(schedulesByDay).map(([day, daySchedules]) => (
                <div key={day} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 p-4">
                  <div className="flex flex-col gap-2">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {weekdayLabels[Number(day)]}
                    </h4>
                    <div className="flex flex-col gap-2">
                    {daySchedules.map((schedule) => (
                      <div
                        key={schedule.id}
                        className={`flex items-center justify-between rounded border px-3 py-2 ${
                          selectedScheduleIds.includes(schedule.id)
                            ? "border-indigo-500 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30"
                            : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
                        }`}
                      >
                        {/* 체크박스 */}
                        <div className="pr-3">
                          <input
                            type="checkbox"
                            checked={selectedScheduleIds.includes(schedule.id)}
                            onChange={() => toggleScheduleSelection(schedule.id)}
                            className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="flex-1">
                          <div className="flex flex-col gap-1">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {schedule.start_time} ~ {schedule.end_time}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {schedule.subject}
                            </div>
                          </div>
                        </div>
                        <div className="pl-4 flex gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEditSchedule(schedule)}
                            disabled={isPending || editingScheduleId !== null}
                            className="rounded p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                            title="수정"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteScheduleClick(schedule.id)}
                            disabled={isPending || editingScheduleId !== null}
                            className="rounded p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:cursor-not-allowed disabled:opacity-50"
                            title="삭제"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">등록된 일정이 없습니다. 위에서 일정을 추가해주세요.</p>
          )}
        </div>
        </div>
      )}

      {/* 학원 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        open={deleteAcademyConfirmOpen}
        onOpenChange={setDeleteAcademyConfirmOpen}
        title="학원 삭제"
        description={`"${academyToDelete ?? "학원"}" 및 모든 일정을 삭제하시겠습니까?`}
        confirmLabel="삭제"
        cancelLabel="취소"
        onConfirm={handleDeleteAcademyConfirm}
        variant="destructive"
        isLoading={isPending}
      />

      {/* 학원 일정 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        open={deleteScheduleConfirmOpen}
        onOpenChange={setDeleteScheduleConfirmOpen}
        title="일정 삭제"
        description={(() => {
          const schedule = selectedAcademySchedules.find(s => s.id === scheduleToDelete);
          if (!schedule) return "이 학원 일정을 삭제하시겠습니까?";
          return `${weekdayLabels[schedule.day_of_week]} ${schedule.start_time}~${schedule.end_time} (${schedule.subject}) 일정을 삭제하시겠습니까?`;
        })()}
        confirmLabel="삭제"
        cancelLabel="취소"
        onConfirm={handleDeleteScheduleConfirm}
        variant="destructive"
        isLoading={isPending}
      />

      {/* 학원 배치 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        open={batchDeleteAcademyConfirmOpen}
        onOpenChange={setBatchDeleteAcademyConfirmOpen}
        title={`학원 ${selectedAcademyNames.length}개 삭제`}
        description={`선택한 ${selectedAcademyNames.length}개의 학원과 모든 일정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel={isPending ? "삭제 중..." : `${selectedAcademyNames.length}개 삭제`}
        cancelLabel="취소"
        onConfirm={handleBatchDeleteAcademyConfirm}
        variant="destructive"
        isLoading={isPending}
      />

      {/* 일정 배치 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        open={batchDeleteScheduleConfirmOpen}
        onOpenChange={setBatchDeleteScheduleConfirmOpen}
        title={`일정 ${selectedScheduleIds.length}개 삭제`}
        description={`선택한 ${selectedScheduleIds.length}개의 일정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel={isPending ? "삭제 중..." : `${selectedScheduleIds.length}개 삭제`}
        cancelLabel="취소"
        onConfirm={handleBatchDeleteScheduleConfirm}
        variant="destructive"
        isLoading={isPending}
      />
    </div>
  );
}
