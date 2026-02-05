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
import type { AcademySchedule, Academy } from "@/lib/types/plan";
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

type AcademyWithSchedules = Academy & {
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
  const [editingAcademyId, setEditingAcademyId] = useState<string | null>(null);
  const [newAcademyName, setNewAcademyName] = useState("");
  const [newAcademyTravelTime, setNewAcademyTravelTime] = useState("60");
  
  // 학원 일정 관리 상태
  const [selectedAcademyId, setSelectedAcademyId] = useState<string | null>(null);
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
  const [academyToDelete, setAcademyToDelete] = useState<string | null>(null);
  const [deleteScheduleConfirmOpen, setDeleteScheduleConfirmOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null);

  // 다중 선택 상태 (학원)
  const [selectedAcademyIds, setSelectedAcademyIds] = useState<string[]>([]);
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
      // 학원과 일정을 조인하여 한 번에 조회 (N+1 쿼리 방지)
      const { data: academiesWithSchedulesData, error: academiesError } = await supabase
        .from("academies")
        .select(`
          id, tenant_id, student_id, name, travel_time, created_at, updated_at,
          academy_schedules(id, tenant_id, student_id, academy_id, day_of_week, start_time, end_time, academy_name, subject, created_at, updated_at)
        `)
        .eq("student_id", studentId)
        .order("name", { ascending: true });

      if (academiesError) {
        console.error("[AcademyScheduleManagement] 학원 조회 실패", academiesError);
        setAcademies([]);
        setLoading(false);
        return;
      }

      // 조인 데이터를 기존 형식으로 변환
      type AcademyWithJoinedSchedules = Academy & {
        academy_schedules: AcademySchedule[] | null;
      };

      const academiesWithSchedules: AcademyWithSchedules[] = (
        (academiesWithSchedulesData as AcademyWithJoinedSchedules[] | null) ?? []
      ).map((academy) => {
        // 일정을 요일, 시작 시간 순으로 정렬
        const sortedSchedules = (academy.academy_schedules ?? []).sort((a, b) => {
          if (a.day_of_week !== b.day_of_week) {
            return a.day_of_week - b.day_of_week;
          }
          return a.start_time.localeCompare(b.start_time);
        });

        return {
          id: academy.id,
          tenant_id: academy.tenant_id,
          student_id: academy.student_id,
          name: academy.name,
          travel_time: academy.travel_time,
          created_at: academy.created_at,
          updated_at: academy.updated_at,
          schedules: sortedSchedules,
        };
      });

      setAcademies(academiesWithSchedules);

      // 첫 번째 학원을 기본 선택
      if (academiesWithSchedules.length > 0 && !selectedAcademyId) {
        setSelectedAcademyId(academiesWithSchedules[0].id);
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
  const handleStartEditAcademy = (academy: Academy) => {
    setEditingAcademyId(academy.id);
    setNewAcademyName(academy.name);
    setNewAcademyTravelTime(String(academy.travel_time));
    onAddRequest?.(); // isAddingAcademy가 false로 변경되도록 요청
  };

  // 학원 수정
  const handleUpdateAcademy = async () => {
    if (!editingAcademyId || !newAcademyName.trim()) {
      showWarning("학원 이름을 입력해주세요.");
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("academy_id", editingAcademyId);
        formData.append("name", newAcademyName.trim());
        formData.append("travel_time", newAcademyTravelTime);

        await updateAcademy(formData);

        setEditingAcademyId(null);
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
  const handleDeleteAcademyClick = (academyId: string) => {
    setAcademyToDelete(academyId);
    setDeleteAcademyConfirmOpen(true);
  };

  // 학원 삭제 확인
  const handleDeleteAcademyConfirm = () => {
    if (!academyToDelete) return;

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("academy_id", academyToDelete);

        await deleteAcademy(formData);

        if (selectedAcademyId === academyToDelete) {
          setSelectedAcademyId(null);
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
    if (!selectedAcademyId) {
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

    const selectedAcademy = academies.find((a) => a.id === selectedAcademyId);
    if (!selectedAcademy) return;

    // 겹침 검증
    const newSchedules = selectedDays.map((day) => ({
      day_of_week: day,
      start_time: scheduleStartTime,
      end_time: scheduleEndTime,
      academy_name: selectedAcademy.name,
      subject: scheduleSubject.trim(),
      travel_time: selectedAcademy.travel_time,
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
          formData.append("academy_name", selectedAcademy.name);
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

    const selectedAcademy = academies.find((a) => a.id === selectedAcademyId);
    if (!selectedAcademy) return;

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("schedule_id", editingScheduleId);
        formData.append("day_of_week", String(selectedDays[0])); // 수정 시에는 첫 번째 요일만
        formData.append("start_time", scheduleStartTime);
        formData.append("end_time", scheduleEndTime);
        formData.append("academy_name", selectedAcademy.name);
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
  const toggleAcademySelection = (academyId: string) => {
    setSelectedAcademyIds((prev) =>
      prev.includes(academyId)
        ? prev.filter((id) => id !== academyId)
        : [...prev, academyId]
    );
  };

  const selectAllAcademies = () => {
    setSelectedAcademyIds(academies.map((a) => a.id));
  };

  const clearAcademySelection = () => {
    setSelectedAcademyIds([]);
  };

  const isAllAcademiesSelected =
    academies.length > 0 && selectedAcademyIds.length === academies.length;
  const hasAcademySelection = selectedAcademyIds.length > 0;

  const handleBatchDeleteAcademyClick = () => {
    if (selectedAcademyIds.length === 0) return;
    setBatchDeleteAcademyConfirmOpen(true);
  };

  const handleBatchDeleteAcademyConfirm = () => {
    if (selectedAcademyIds.length === 0) return;

    startTransition(async () => {
      try {
        const results = await Promise.all(
          selectedAcademyIds.map(async (id) => {
            try {
              const formData = new FormData();
              formData.append("academy_id", id);
              await deleteAcademy(formData);
              return { success: true, id };
            } catch {
              return { success: false, id };
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
          // 선택된 학원이 삭제되었으면 선택 해제
          if (selectedAcademyId && selectedAcademyIds.includes(selectedAcademyId)) {
            setSelectedAcademyId(null);
          }
        }

        setSelectedAcademyIds([]);
        setBatchDeleteAcademyConfirmOpen(false);
        await loadData();
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "학원 삭제에 실패했습니다.";
        showError(errorMessage);
        setBatchDeleteAcademyConfirmOpen(false);
      }
    });
  };

  // 선택된 학원 정보 (다중 선택 핸들러에서 사용)
  const selectedAcademy = academies.find((a) => a.id === selectedAcademyId);
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
      {(academies.length > 0 || isAddingAcademy || editingAcademyId) && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <div className="flex flex-col gap-4">
            {academies.length > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">학원 목록</h3>
                  {hasAcademySelection && (
                    <span className="rounded-full bg-indigo-100 dark:bg-indigo-900 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-300">
                      {selectedAcademyIds.length}개 선택
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
                        {selectedAcademyIds.length}개 삭제
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            )}

            {/* 학원 추가/수정 폼 */}
            {(isAddingAcademy || editingAcademyId) && (
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 p-4">
                <div className="flex flex-col gap-3">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {editingAcademyId ? "학원 수정" : "학원 추가"}
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
                onClick={editingAcademyId ? handleUpdateAcademy : handleAddAcademy}
                disabled={isPending || !newAcademyName.trim()}
                className="rounded-lg bg-gray-900 dark:bg-gray-100 px-4 py-2 text-sm font-medium text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 disabled:cursor-not-allowed disabled:bg-gray-400 dark:disabled:bg-gray-500"
              >
                {isPending ? (editingAcademyId ? "수정 중..." : "추가 중...") : (editingAcademyId ? "수정" : "추가")}
              </button>
              <button
                type="button"
                onClick={() => {
                  onAddRequest?.(); // 상위 컴포넌트에 상태 토글 요청
                  setEditingAcademyId(null);
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
                key={academy.id}
                onClick={() => setSelectedAcademyId(academy.id)}
                className={getAcademyCardClassName(selectedAcademyId === academy.id, selectedAcademyIds.includes(academy.id))}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedAcademyId(academy.id);
                  }
                }}
                aria-label={`${academy.name} 선택`}
                aria-pressed={selectedAcademyId === academy.id}
              >
                {/* 체크박스 */}
                <div
                  className="pr-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={selectedAcademyIds.includes(academy.id)}
                    onChange={() => toggleAcademySelection(academy.id)}
                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {academy.name}
                    </span>
                    {selectedAcademyId === academy.id && (
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
                    disabled={isPending || editingAcademyId !== null}
                    className="rounded p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                    title="수정"
                    aria-label={`${academy.name} 수정`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteAcademyClick(academy.id)}
                    disabled={isPending || editingAcademyId !== null}
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
        description={`"${academies.find(a => a.id === academyToDelete)?.name ?? "학원"}" 및 모든 일정을 삭제하시겠습니까?`}
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
        title={`학원 ${selectedAcademyIds.length}개 삭제`}
        description={`선택한 ${selectedAcademyIds.length}개의 학원과 모든 일정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel={isPending ? "삭제 중..." : `${selectedAcademyIds.length}개 삭제`}
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
