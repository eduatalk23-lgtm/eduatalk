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
} from "@/app/(student)/actions/planGroupActions";
import type { AcademySchedule, Academy } from "@/lib/types/plan";
import { Trash2, Pencil, X } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

type AcademyScheduleManagementProps = {
  studentId: string;
  onAddRequest?: () => void;
  isAddingAcademy?: boolean;
};

const weekdayLabels = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

type AcademyWithSchedules = Academy & {
  schedules: AcademySchedule[];
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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // 학생별 학원 목록 조회
      const { data: academiesData, error: academiesError } = await supabase
        .from("academies")
        .select("id,tenant_id,student_id,name,travel_time,created_at,updated_at")
        .eq("student_id", studentId)
        .order("name", { ascending: true });

      if (academiesError) {
        console.error("[AcademyScheduleManagement] 학원 조회 실패", academiesError);
        setAcademies([]);
        setLoading(false);
        return;
      }

      const academiesList = (academiesData as Academy[]) ?? [];

      // 각 학원의 일정 조회
      const academiesWithSchedules = await Promise.all(
        academiesList.map(async (academy) => {
          const { data: schedulesData, error: schedulesError } = await supabase
            .from("academy_schedules")
            .select(
              "id,tenant_id,student_id,academy_id,day_of_week,start_time,end_time,academy_name,subject,created_at,updated_at"
            )
            .eq("academy_id", academy.id)
            .order("day_of_week", { ascending: true })
            .order("start_time", { ascending: true });

          if (schedulesError) {
            console.error(`[AcademyScheduleManagement] 학원 일정 조회 실패 (academy: ${academy.id})`, schedulesError);
            return { ...academy, schedules: [] };
          }

          return {
            ...academy,
            schedules: (schedulesData as AcademySchedule[]) ?? [],
          };
        })
      );

      setAcademies(academiesWithSchedules);
      
      // 첫 번째 학원을 기본 선택
      if (academiesWithSchedules.length > 0 && !selectedAcademyId) {
        setSelectedAcademyId(academiesWithSchedules[0].id);
      }
    } catch (error: any) {
      console.error("학원 일정 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  // 학원 추가
  const handleAddAcademy = async () => {
    if (!newAcademyName.trim()) {
      alert("학원 이름을 입력해주세요.");
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

        await loadData();
      } catch (error: any) {
        alert(error.message || "학원 추가에 실패했습니다.");
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
      alert("학원 이름을 입력해주세요.");
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

        await loadData();
      } catch (error: any) {
        alert(error.message || "학원 수정에 실패했습니다.");
      }
    });
  };

  // 학원 삭제
  const handleDeleteAcademy = async (academyId: string) => {
    if (!confirm("이 학원과 모든 일정을 삭제하시겠습니까?")) return;

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("academy_id", academyId);

        await deleteAcademy(formData);

        if (selectedAcademyId === academyId) {
          setSelectedAcademyId(null);
        }

        await loadData();
      } catch (error: any) {
        alert(error.message || "학원 삭제에 실패했습니다.");
      }
    });
  };

  // 학원 일정 추가
  const handleAddSchedule = async () => {
    if (!selectedAcademyId) {
      alert("학원을 선택해주세요.");
      return;
    }

    if (selectedDays.length === 0) {
      alert("요일을 선택해주세요.");
      return;
    }

    if (!scheduleSubject.trim()) {
      alert("과목을 입력해주세요.");
      return;
    }

    if (scheduleStartTime >= scheduleEndTime) {
      alert("종료 시간은 시작 시간보다 늦어야 합니다.");
      return;
    }

    const selectedAcademy = academies.find((a) => a.id === selectedAcademyId);
    if (!selectedAcademy) return;

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

        await loadData();
      } catch (error: any) {
        alert(error.message || "학원 일정 추가에 실패했습니다.");
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
      alert("요일과 과목을 입력해주세요.");
      return;
    }

    if (scheduleStartTime >= scheduleEndTime) {
      alert("종료 시간은 시작 시간보다 늦어야 합니다.");
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

        await loadData();
      } catch (error: any) {
        alert(error.message || "학원 일정 수정에 실패했습니다.");
      }
    });
  };

  // 학원 일정 삭제
  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!confirm("이 학원 일정을 삭제하시겠습니까?")) return;

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("schedule_id", scheduleId);

        await deleteAcademySchedule(formData);

        await loadData();
      } catch (error: any) {
        alert(error.message || "학원 일정 삭제에 실패했습니다.");
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

  const selectedAcademy = academies.find((a) => a.id === selectedAcademyId);
  const selectedAcademySchedules = selectedAcademy?.schedules ?? [];

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
        <p className="text-sm text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <p className="font-medium">📌 학원 단위로 관리합니다.</p>
        <p className="mt-1 text-xs text-blue-700">
          학원을 등록하고, 각 학원에 대해 요일별 일정을 설정할 수 있습니다.
        </p>
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
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          {academies.length > 0 && (
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">학원 목록</h3>
            </div>
          )}

        {/* 학원 추가/수정 폼 */}
        {(isAddingAcademy || editingAcademyId) && (
          <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h4 className="mb-3 text-sm font-semibold text-gray-900">
              {editingAcademyId ? "학원 수정" : "학원 추가"}
            </h4>
            <div className="mb-3 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  학원 이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                  placeholder="예: 수학 학원"
                  value={newAcademyName}
                  onChange={(e) => setNewAcademyName(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  이동시간 (분) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
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
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
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
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                취소
              </button>
            </div>
          </div>
        )}

        {/* 학원 목록 */}
        {academies.length > 0 ? (
          <div className="space-y-2">
            {academies.map((academy) => (
              <div
                key={academy.id}
                className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                  selectedAcademyId === academy.id
                    ? "border-gray-900 bg-gray-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedAcademyId(academy.id)}
                      className="text-sm font-medium text-gray-900 hover:text-gray-700"
                    >
                      {academy.name}
                    </button>
                    {selectedAcademyId === academy.id && (
                      <span className="text-xs text-gray-500">(선택됨)</span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    이동시간: {academy.travel_time}분 | 일정: {academy.schedules.length}개
                  </div>
                </div>
                <div className="ml-4 flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleStartEditAcademy(academy)}
                    disabled={isPending || editingAcademyId !== null}
                    className="rounded p-1 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                    title="수정"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteAcademy(academy.id)}
                    disabled={isPending || editingAcademyId !== null}
                    className="rounded p-1 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    title="삭제"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">등록된 학원이 없습니다. 위에서 학원을 추가해주세요.</p>
        )}
        </div>
      )}

      {/* 선택된 학원의 일정 관리 */}
      {selectedAcademy && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{selectedAcademy.name}</h3>
              <p className="mt-1 text-xs text-gray-500">이동시간: {selectedAcademy.travel_time}분</p>
            </div>
            {!isAddingSchedule && !editingScheduleId && (
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
                className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Plus className="h-4 w-4" />
                일정 추가
              </button>
            )}
          </div>

          {/* 일정 추가/수정 폼 */}
          {(isAddingSchedule || editingScheduleId) && (
            <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h4 className="mb-3 text-sm font-semibold text-gray-900">
                {editingScheduleId ? "일정 수정" : "일정 추가"}
              </h4>
              <div className="mb-3 space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-medium text-gray-700">
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
                            ? "border-gray-900 bg-gray-900 text-white"
                            : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">
                      시작 시간 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                      value={scheduleStartTime}
                      onChange={(e) => setScheduleStartTime(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">
                      종료 시간 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                      value={scheduleEndTime}
                      onChange={(e) => setScheduleEndTime(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">
                      과목 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
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
                  className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
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
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  취소
                </button>
              </div>
            </div>
          )}

          {/* 일정 목록 (요일별 그룹화) */}
          {selectedAcademySchedules.length > 0 ? (
            <div className="space-y-3">
              {Object.entries(schedulesByDay).map(([day, daySchedules]) => (
                <div key={day} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <h4 className="mb-2 text-sm font-semibold text-gray-900">
                    {weekdayLabels[Number(day)]}
                  </h4>
                  <div className="space-y-2">
                    {daySchedules.map((schedule) => (
                      <div
                        key={schedule.id}
                        className="flex items-center justify-between rounded border border-gray-200 bg-white px-3 py-2"
                      >
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            {schedule.start_time} ~ {schedule.end_time}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            {schedule.subject}
                          </div>
                        </div>
                        <div className="ml-4 flex gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEditSchedule(schedule)}
                            disabled={isPending || editingScheduleId !== null}
                            className="rounded p-1 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                            title="수정"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSchedule(schedule.id)}
                            disabled={isPending || editingScheduleId !== null}
                            className="rounded p-1 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                            title="삭제"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">등록된 일정이 없습니다. 위에서 일정을 추가해주세요.</p>
          )}
        </div>
        )}

        {!selectedAcademy && academies.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
            <p className="text-sm text-gray-500">위에서 학원을 선택해주세요.</p>
          </div>
        )}
      )}
    </div>
  );
}
