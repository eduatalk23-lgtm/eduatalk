"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { cn } from "@/lib/cn";
import type { AcademyWithSchedules } from "@/lib/domains/admin-plan/actions/timeManagement";
import {
  createAcademyForAdmin,
  updateAcademyForAdmin,
  deleteAcademyForAdmin,
  addAcademyScheduleForAdmin,
  updateAcademyScheduleForAdmin,
  deleteAcademyScheduleForAdmin,
} from "@/lib/domains/admin-plan/actions/timeManagement";

interface AdminAcademyManagementProps {
  studentId: string;
  initialAcademies: AcademyWithSchedules[];
}

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export function AdminAcademyManagement({
  studentId,
  initialAcademies,
}: AdminAcademyManagementProps) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [isPending, startTransition] = useTransition();

  const [academies, setAcademies] = useState(initialAcademies);
  const [expandedAcademyId, setExpandedAcademyId] = useState<string | null>(
    initialAcademies.length > 0 ? initialAcademies[0].id : null
  );

  // 학원 추가 상태
  const [isAddingAcademy, setIsAddingAcademy] = useState(false);
  const [newAcademyName, setNewAcademyName] = useState("");
  const [newAcademyTravelTime, setNewAcademyTravelTime] = useState(60);

  // 학원 수정 상태
  const [editingAcademyId, setEditingAcademyId] = useState<string | null>(null);
  const [editAcademyName, setEditAcademyName] = useState("");
  const [editAcademyTravelTime, setEditAcademyTravelTime] = useState(60);

  // 학원 삭제 상태
  const [deleteAcademyConfirmOpen, setDeleteAcademyConfirmOpen] = useState(false);
  const [deleteAcademyTargetId, setDeleteAcademyTargetId] = useState<string | null>(null);

  // 학원 다중 선택 상태
  const [selectedAcademyIds, setSelectedAcademyIds] = useState<string[]>([]);
  const [batchDeleteAcademyConfirmOpen, setBatchDeleteAcademyConfirmOpen] = useState(false);

  // 일정 추가 상태
  const [addingScheduleAcademyId, setAddingScheduleAcademyId] = useState<string | null>(null);
  const [newScheduleDayOfWeek, setNewScheduleDayOfWeek] = useState(1);
  const [newScheduleStartTime, setNewScheduleStartTime] = useState("14:00");
  const [newScheduleEndTime, setNewScheduleEndTime] = useState("16:00");
  const [newScheduleSubject, setNewScheduleSubject] = useState("");

  // 일정 수정 상태
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [editScheduleDayOfWeek, setEditScheduleDayOfWeek] = useState(1);
  const [editScheduleStartTime, setEditScheduleStartTime] = useState("");
  const [editScheduleEndTime, setEditScheduleEndTime] = useState("");
  const [editScheduleSubject, setEditScheduleSubject] = useState("");

  // 일정 삭제 상태
  const [deleteScheduleConfirmOpen, setDeleteScheduleConfirmOpen] = useState(false);
  const [deleteScheduleTargetId, setDeleteScheduleTargetId] = useState<string | null>(null);

  // 일정 다중 선택 상태 (학원별)
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<string[]>([]);
  const [batchDeleteScheduleConfirmOpen, setBatchDeleteScheduleConfirmOpen] = useState(false);

  // 학원 다중 선택 핸들러
  const toggleAcademySelection = (id: string) => {
    setSelectedAcademyIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAllAcademies = () => {
    setSelectedAcademyIds(academies.map((a) => a.id));
  };

  const clearAcademySelection = () => {
    setSelectedAcademyIds([]);
  };

  const isAllAcademiesSelected = academies.length > 0 && selectedAcademyIds.length === academies.length;
  const hasAcademySelection = selectedAcademyIds.length > 0;

  // 일정 다중 선택 핸들러 (특정 학원 내)
  const toggleScheduleSelection = (id: string) => {
    setSelectedScheduleIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAllSchedulesInAcademy = (academyId: string) => {
    const academy = academies.find((a) => a.id === academyId);
    if (academy) {
      const scheduleIds = academy.schedules.map((s) => s.id);
      setSelectedScheduleIds((prev) => [...new Set([...prev, ...scheduleIds])]);
    }
  };

  const clearScheduleSelectionInAcademy = (academyId: string) => {
    const academy = academies.find((a) => a.id === academyId);
    if (academy) {
      const scheduleIdsToRemove = new Set(academy.schedules.map((s) => s.id));
      setSelectedScheduleIds((prev) => prev.filter((id) => !scheduleIdsToRemove.has(id)));
    }
  };

  const clearAllScheduleSelection = () => {
    setSelectedScheduleIds([]);
  };

  const hasScheduleSelection = selectedScheduleIds.length > 0;

  const isAllSchedulesSelectedInAcademy = (academyId: string) => {
    const academy = academies.find((a) => a.id === academyId);
    if (!academy || academy.schedules.length === 0) return false;
    return academy.schedules.every((s) => selectedScheduleIds.includes(s.id));
  };

  // 학원 배치 삭제 핸들러
  const handleBatchDeleteAcademyClick = () => {
    if (selectedAcademyIds.length === 0) return;
    setBatchDeleteAcademyConfirmOpen(true);
  };

  const handleBatchDeleteAcademyConfirm = async () => {
    if (selectedAcademyIds.length === 0) return;

    startTransition(async () => {
      const results = await Promise.all(
        selectedAcademyIds.map((id) => deleteAcademyForAdmin(id))
      );

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.length - successCount;

      if (failCount > 0) {
        showError(`${failCount}개 학원 삭제 실패`);
      }

      if (successCount > 0) {
        showSuccess(`${successCount}개 학원이 삭제되었습니다.`);
        const successIds = selectedAcademyIds.filter((_, i) => results[i]?.success);
        setAcademies((prev) => prev.filter((a) => !successIds.includes(a.id)));
        if (expandedAcademyId && successIds.includes(expandedAcademyId)) {
          setExpandedAcademyId(null);
        }
      }

      setSelectedAcademyIds([]);
      setBatchDeleteAcademyConfirmOpen(false);
    });
  };

  // 일정 배치 삭제 핸들러
  const handleBatchDeleteScheduleClick = () => {
    if (selectedScheduleIds.length === 0) return;
    setBatchDeleteScheduleConfirmOpen(true);
  };

  const handleBatchDeleteScheduleConfirm = async () => {
    if (selectedScheduleIds.length === 0) return;

    startTransition(async () => {
      const results = await Promise.all(
        selectedScheduleIds.map((id) => deleteAcademyScheduleForAdmin(id))
      );

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.length - successCount;

      if (failCount > 0) {
        showError(`${failCount}개 일정 삭제 실패`);
      }

      if (successCount > 0) {
        showSuccess(`${successCount}개 일정이 삭제되었습니다.`);
        const successIds = new Set(selectedScheduleIds.filter((_, i) => results[i]?.success));
        setAcademies((prev) =>
          prev.map((a) => ({
            ...a,
            schedules: a.schedules.filter((s) => !successIds.has(s.id)),
          }))
        );
      }

      setSelectedScheduleIds([]);
      setBatchDeleteScheduleConfirmOpen(false);
    });
  };

  // 학원 추가
  const handleAddAcademy = async () => {
    if (!newAcademyName.trim()) {
      showError("학원명을 입력해주세요.");
      return;
    }

    startTransition(async () => {
      const result = await createAcademyForAdmin(studentId, {
        name: newAcademyName,
        travel_time: newAcademyTravelTime,
      });

      if (result.success && result.data) {
        showSuccess("학원이 추가되었습니다.");
        setAcademies((prev) => [...prev, { ...result.data!, schedules: [] }]);
        setIsAddingAcademy(false);
        setNewAcademyName("");
        setNewAcademyTravelTime(60);
        setExpandedAcademyId(result.data.id);
      } else {
        showError(result.error || "학원 추가에 실패했습니다.");
      }
    });
  };

  // 학원 수정
  const handleEditAcademy = (academy: AcademyWithSchedules) => {
    setEditingAcademyId(academy.id);
    setEditAcademyName(academy.name);
    setEditAcademyTravelTime(academy.travel_time);
  };

  const handleUpdateAcademy = async () => {
    if (!editingAcademyId || !editAcademyName.trim()) return;

    startTransition(async () => {
      const result = await updateAcademyForAdmin(editingAcademyId, {
        name: editAcademyName,
        travel_time: editAcademyTravelTime,
      });

      if (result.success) {
        showSuccess("학원이 수정되었습니다.");
        setAcademies((prev) =>
          prev.map((a) =>
            a.id === editingAcademyId
              ? { ...a, name: editAcademyName, travel_time: editAcademyTravelTime }
              : a
          )
        );
        setEditingAcademyId(null);
      } else {
        showError(result.error || "학원 수정에 실패했습니다.");
      }
    });
  };

  // 학원 개별 삭제
  const handleDeleteAcademyClick = (id: string) => {
    setDeleteAcademyTargetId(id);
    setDeleteAcademyConfirmOpen(true);
  };

  const handleDeleteAcademyConfirm = async () => {
    if (!deleteAcademyTargetId) return;

    startTransition(async () => {
      const result = await deleteAcademyForAdmin(deleteAcademyTargetId);

      if (result.success) {
        showSuccess("학원이 삭제되었습니다.");
        setAcademies((prev) => prev.filter((a) => a.id !== deleteAcademyTargetId));
        setSelectedAcademyIds((prev) => prev.filter((id) => id !== deleteAcademyTargetId));
        if (expandedAcademyId === deleteAcademyTargetId) {
          setExpandedAcademyId(null);
        }
      } else {
        showError(result.error || "학원 삭제에 실패했습니다.");
      }

      setDeleteAcademyConfirmOpen(false);
      setDeleteAcademyTargetId(null);
    });
  };

  // 일정 추가
  const handleAddSchedule = async () => {
    if (!addingScheduleAcademyId) return;

    if (newScheduleStartTime >= newScheduleEndTime) {
      showError("종료 시간은 시작 시간보다 이후여야 합니다.");
      return;
    }

    startTransition(async () => {
      const result = await addAcademyScheduleForAdmin(addingScheduleAcademyId, {
        day_of_week: newScheduleDayOfWeek,
        start_time: newScheduleStartTime,
        end_time: newScheduleEndTime,
        subject: newScheduleSubject || undefined,
      });

      if (result.success) {
        showSuccess("일정이 추가되었습니다.");
        setAddingScheduleAcademyId(null);
        setNewScheduleDayOfWeek(1);
        setNewScheduleStartTime("14:00");
        setNewScheduleEndTime("16:00");
        setNewScheduleSubject("");
        router.refresh();
      } else {
        showError(result.error || "일정 추가에 실패했습니다.");
      }
    });
  };

  // 일정 수정
  const handleEditSchedule = (schedule: AcademyWithSchedules["schedules"][0]) => {
    setEditingScheduleId(schedule.id);
    setEditScheduleDayOfWeek(schedule.day_of_week);
    setEditScheduleStartTime(schedule.start_time);
    setEditScheduleEndTime(schedule.end_time);
    setEditScheduleSubject(schedule.subject || "");
  };

  const handleUpdateSchedule = async () => {
    if (!editingScheduleId) return;

    if (editScheduleStartTime >= editScheduleEndTime) {
      showError("종료 시간은 시작 시간보다 이후여야 합니다.");
      return;
    }

    startTransition(async () => {
      const result = await updateAcademyScheduleForAdmin(editingScheduleId, {
        day_of_week: editScheduleDayOfWeek,
        start_time: editScheduleStartTime,
        end_time: editScheduleEndTime,
        subject: editScheduleSubject || null,
      });

      if (result.success) {
        showSuccess("일정이 수정되었습니다.");
        setEditingScheduleId(null);
        router.refresh();
      } else {
        showError(result.error || "일정 수정에 실패했습니다.");
      }
    });
  };

  // 일정 개별 삭제
  const handleDeleteScheduleClick = (id: string) => {
    setDeleteScheduleTargetId(id);
    setDeleteScheduleConfirmOpen(true);
  };

  const handleDeleteScheduleConfirm = async () => {
    if (!deleteScheduleTargetId) return;

    startTransition(async () => {
      const result = await deleteAcademyScheduleForAdmin(deleteScheduleTargetId);

      if (result.success) {
        showSuccess("일정이 삭제되었습니다.");
        setAcademies((prev) =>
          prev.map((a) => ({
            ...a,
            schedules: a.schedules.filter((s) => s.id !== deleteScheduleTargetId),
          }))
        );
        setSelectedScheduleIds((prev) => prev.filter((id) => id !== deleteScheduleTargetId));
      } else {
        showError(result.error || "일정 삭제에 실패했습니다.");
      }

      setDeleteScheduleConfirmOpen(false);
      setDeleteScheduleTargetId(null);
    });
  };

  const formatTime = (time: string) => {
    return time.slice(0, 5);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900">학원 일정</h3>
          {(hasAcademySelection || hasScheduleSelection) && (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
              {hasAcademySelection
                ? `학원 ${selectedAcademyIds.length}개`
                : `일정 ${selectedScheduleIds.length}개`}{" "}
              선택
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasAcademySelection ? (
            <>
              <button
                onClick={clearAcademySelection}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
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
          ) : hasScheduleSelection ? (
            <>
              <button
                onClick={clearAllScheduleSelection}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                선택 해제
              </button>
              <button
                onClick={handleBatchDeleteScheduleClick}
                disabled={isPending}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {selectedScheduleIds.length}개 삭제
              </button>
            </>
          ) : (
            !isAddingAcademy && (
              <button
                onClick={() => setIsAddingAcademy(true)}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
              >
                학원 추가
              </button>
            )
          )}
        </div>
      </div>

      {/* 학원 추가 폼 */}
      {isAddingAcademy && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  학원명
                </label>
                <input
                  type="text"
                  value={newAcademyName}
                  onChange={(e) => setNewAcademyName(e.target.value)}
                  placeholder="예: 대치 수학학원"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  이동 시간 (분)
                </label>
                <input
                  type="number"
                  value={newAcademyTravelTime}
                  onChange={(e) => setNewAcademyTravelTime(Number(e.target.value))}
                  min={0}
                  max={180}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsAddingAcademy(false);
                  setNewAcademyName("");
                  setNewAcademyTravelTime(60);
                }}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleAddAcademy}
                disabled={isPending || !newAcademyName.trim()}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {isPending ? "추가 중..." : "추가"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 학원 목록 */}
      {academies.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">
          등록된 학원이 없습니다.
        </p>
      ) : (
        <div className="space-y-3">
          {/* 전체 선택 헤더 */}
          <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2">
            <input
              type="checkbox"
              checked={isAllAcademiesSelected}
              onChange={() =>
                isAllAcademiesSelected ? clearAcademySelection() : selectAllAcademies()
              }
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-600">
              {isAllAcademiesSelected ? "전체 학원 선택 해제" : "전체 학원 선택"}
            </span>
          </div>

          {academies.map((academy) => (
            <div
              key={academy.id}
              className="overflow-hidden rounded-lg border border-gray-200"
            >
              {/* 학원 헤더 */}
              <div
                className={cn(
                  "flex cursor-pointer items-center gap-3 px-4 py-3",
                  expandedAcademyId === academy.id ? "bg-gray-50" : "hover:bg-gray-50"
                )}
              >
                {/* 학원 체크박스 */}
                <input
                  type="checkbox"
                  checked={selectedAcademyIds.includes(academy.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleAcademySelection(academy.id);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />

                <div
                  className="flex flex-1 items-center justify-between"
                  onClick={() =>
                    setExpandedAcademyId(
                      expandedAcademyId === academy.id ? null : academy.id
                    )
                  }
                >
                  {editingAcademyId === academy.id ? (
                    // 학원 수정 모드
                    <div
                      className="flex flex-1 items-center gap-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="text"
                        value={editAcademyName}
                        onChange={(e) => setEditAcademyName(e.target.value)}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                        placeholder="학원명"
                      />
                      <input
                        type="number"
                        value={editAcademyTravelTime}
                        onChange={(e) => setEditAcademyTravelTime(Number(e.target.value))}
                        min={0}
                        max={180}
                        className="w-20 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                      />
                      <span className="text-xs text-gray-500">분</span>
                      <button
                        onClick={handleUpdateAcademy}
                        disabled={isPending}
                        className="rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        저장
                      </button>
                      <button
                        onClick={() => setEditingAcademyId(null)}
                        className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                      >
                        취소
                      </button>
                    </div>
                  ) : (
                    // 학원 보기 모드
                    <>
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "text-sm transition-transform",
                            expandedAcademyId === academy.id ? "rotate-90" : "rotate-0"
                          )}
                        >
                          ▶
                        </span>
                        <span className="font-medium text-gray-900">{academy.name}</span>
                        <span className="text-xs text-gray-500">
                          이동시간 {academy.travel_time}분
                        </span>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                          {academy.schedules.length}개 일정
                        </span>
                      </div>
                      <div
                        className="flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => handleEditAcademy(academy)}
                          className="text-sm text-gray-500 hover:text-gray-700"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDeleteAcademyClick(academy.id)}
                          className="text-sm text-red-500 hover:text-red-700"
                        >
                          삭제
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* 일정 목록 (아코디언) */}
              {expandedAcademyId === academy.id && (
                <div className="border-t border-gray-200 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-700">일정 목록</span>
                      {academy.schedules.length > 0 && (
                        <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-500">
                          <input
                            type="checkbox"
                            checked={isAllSchedulesSelectedInAcademy(academy.id)}
                            onChange={() =>
                              isAllSchedulesSelectedInAcademy(academy.id)
                                ? clearScheduleSelectionInAcademy(academy.id)
                                : selectAllSchedulesInAcademy(academy.id)
                            }
                            className="h-3 w-3 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          전체 선택
                        </label>
                      )}
                    </div>
                    {addingScheduleAcademyId !== academy.id && (
                      <button
                        onClick={() => setAddingScheduleAcademyId(academy.id)}
                        className="text-sm text-indigo-600 hover:text-indigo-700"
                      >
                        + 일정 추가
                      </button>
                    )}
                  </div>

                  {/* 일정 추가 폼 */}
                  {addingScheduleAcademyId === academy.id && (
                    <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                      <div className="flex flex-col gap-3">
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-700">
                              요일
                            </label>
                            <select
                              value={newScheduleDayOfWeek}
                              onChange={(e) =>
                                setNewScheduleDayOfWeek(Number(e.target.value))
                              }
                              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                            >
                              {WEEKDAY_LABELS.map((label, idx) => (
                                <option key={idx} value={idx}>
                                  {label}요일
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-700">
                              시작
                            </label>
                            <input
                              type="time"
                              value={newScheduleStartTime}
                              onChange={(e) => setNewScheduleStartTime(e.target.value)}
                              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-700">
                              종료
                            </label>
                            <input
                              type="time"
                              value={newScheduleEndTime}
                              onChange={(e) => setNewScheduleEndTime(e.target.value)}
                              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-700">
                              과목
                            </label>
                            <input
                              type="text"
                              value={newScheduleSubject}
                              onChange={(e) => setNewScheduleSubject(e.target.value)}
                              placeholder="선택"
                              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setAddingScheduleAcademyId(null);
                              setNewScheduleDayOfWeek(1);
                              setNewScheduleStartTime("14:00");
                              setNewScheduleEndTime("16:00");
                              setNewScheduleSubject("");
                            }}
                            className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            취소
                          </button>
                          <button
                            onClick={handleAddSchedule}
                            disabled={isPending}
                            className="rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                          >
                            {isPending ? "추가 중..." : "추가"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 일정 목록 */}
                  {academy.schedules.length === 0 ? (
                    <p className="py-4 text-center text-sm text-gray-500">
                      등록된 일정이 없습니다.
                    </p>
                  ) : (
                    <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                      {academy.schedules.map((schedule) => (
                        <div
                          key={schedule.id}
                          className="flex items-center gap-3 px-3 py-2"
                        >
                          {/* 일정 체크박스 */}
                          <input
                            type="checkbox"
                            checked={selectedScheduleIds.includes(schedule.id)}
                            onChange={() => toggleScheduleSelection(schedule.id)}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />

                          {editingScheduleId === schedule.id ? (
                            // 일정 수정 모드
                            <div className="flex flex-1 flex-col gap-2">
                              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                                <select
                                  value={editScheduleDayOfWeek}
                                  onChange={(e) =>
                                    setEditScheduleDayOfWeek(Number(e.target.value))
                                  }
                                  className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                                >
                                  {WEEKDAY_LABELS.map((label, idx) => (
                                    <option key={idx} value={idx}>
                                      {label}요일
                                    </option>
                                  ))}
                                </select>
                                <input
                                  type="time"
                                  value={editScheduleStartTime}
                                  onChange={(e) =>
                                    setEditScheduleStartTime(e.target.value)
                                  }
                                  className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                                />
                                <input
                                  type="time"
                                  value={editScheduleEndTime}
                                  onChange={(e) => setEditScheduleEndTime(e.target.value)}
                                  className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                                />
                                <input
                                  type="text"
                                  value={editScheduleSubject}
                                  onChange={(e) => setEditScheduleSubject(e.target.value)}
                                  placeholder="과목"
                                  className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                                />
                              </div>
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => setEditingScheduleId(null)}
                                  className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                >
                                  취소
                                </button>
                                <button
                                  onClick={handleUpdateSchedule}
                                  disabled={isPending}
                                  className="rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                                >
                                  저장
                                </button>
                              </div>
                            </div>
                          ) : (
                            // 일정 보기 모드
                            <>
                              <div className="flex flex-1 items-center gap-3">
                                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                                  {WEEKDAY_LABELS[schedule.day_of_week]}
                                </span>
                                <span className="text-sm text-gray-900">
                                  {formatTime(schedule.start_time)} -{" "}
                                  {formatTime(schedule.end_time)}
                                </span>
                                {schedule.subject && (
                                  <span className="text-xs text-gray-500">
                                    {schedule.subject}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleEditSchedule(schedule)}
                                  className="text-xs text-gray-500 hover:text-gray-700"
                                >
                                  수정
                                </button>
                                <button
                                  onClick={() => handleDeleteScheduleClick(schedule.id)}
                                  className="text-xs text-red-500 hover:text-red-700"
                                >
                                  삭제
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 학원 개별 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        open={deleteAcademyConfirmOpen}
        onOpenChange={setDeleteAcademyConfirmOpen}
        title="학원 삭제"
        description="이 학원과 연결된 모든 일정이 함께 삭제됩니다. 계속하시겠습니까?"
        confirmLabel={isPending ? "삭제 중..." : "삭제"}
        cancelLabel="취소"
        onConfirm={handleDeleteAcademyConfirm}
        variant="destructive"
        isLoading={isPending}
      />

      {/* 학원 배치 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        open={batchDeleteAcademyConfirmOpen}
        onOpenChange={setBatchDeleteAcademyConfirmOpen}
        title={`학원 ${selectedAcademyIds.length}개 삭제`}
        description={`선택한 ${selectedAcademyIds.length}개의 학원과 모든 일정이 삭제됩니다. 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel={isPending ? "삭제 중..." : `${selectedAcademyIds.length}개 삭제`}
        cancelLabel="취소"
        onConfirm={handleBatchDeleteAcademyConfirm}
        variant="destructive"
        isLoading={isPending}
      />

      {/* 일정 개별 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        open={deleteScheduleConfirmOpen}
        onOpenChange={setDeleteScheduleConfirmOpen}
        title="일정 삭제"
        description="이 일정을 삭제하시겠습니까?"
        confirmLabel={isPending ? "삭제 중..." : "삭제"}
        cancelLabel="취소"
        onConfirm={handleDeleteScheduleConfirm}
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
