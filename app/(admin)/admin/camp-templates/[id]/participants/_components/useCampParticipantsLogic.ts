"use client";

import { useState, useEffect, useTransition, useCallback, useRef, useMemo } from "react";
import { usePathname } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { loadCampParticipants, type Participant } from "@/lib/data/campParticipants";
import { batchUpdateCampPlanGroupStatus, bulkCreatePlanGroupsForCamp } from "@/app/(admin)/actions/campTemplateActions";
import type { SortColumn, SortOrder, StatusFilter, ParticipantsStats } from "./types";

export function useCampParticipantsLogic(templateId: string) {
  const toast = useToast();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortColumn | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<Set<string>>(new Set());

  // 마지막 로드 시간 추적 (중복 로드 방지)
  const lastLoadTimeRef = useRef<number>(0);
  const isLoadingRef = useRef<boolean>(false);

  // loadParticipants 함수를 useCallback으로 메모이제이션
  const loadParticipants = useCallback(async () => {
    // 중복 로드 방지: 1초 이내 재요청 차단
    const now = Date.now();
    if (isLoadingRef.current || (now - lastLoadTimeRef.current < 1000)) {
      return;
    }

    isLoadingRef.current = true;
    lastLoadTimeRef.current = now;

    try {
      setLoading(true);
      const participantsData = await loadCampParticipants(templateId);
      setParticipants(participantsData);
    } catch (error) {
      console.error("[CampParticipantsList] 참여자 목록 로드 실패:", {
        templateId,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      toast.showError(
        error instanceof Error
          ? `참여자 목록을 불러오는데 실패했습니다: ${error.message}`
          : "참여자 목록을 불러오는데 실패했습니다."
      );
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [templateId, toast]);

  // 초기 로드 및 templateId 변경 시
  useEffect(() => {
    loadParticipants();
  }, [loadParticipants]);

  // 페이지 포커스 시 자동 새로고침 (다른 페이지에서 돌아왔을 때)
  useEffect(() => {
    const handleFocus = () => {
      if (pathname?.includes('/participants') && !pathname?.includes('/participants/')) {
        const now = Date.now();
        if (now - lastLoadTimeRef.current > 5000) {
          loadParticipants();
        }
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [pathname, loadParticipants]);

  // 페이지 가시성 변경 시 (탭 전환 등)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - lastLoadTimeRef.current > 10000) {
          loadParticipants();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadParticipants]);

  // 필터링 및 정렬된 참여자 목록 (메모이제이션)
  const filteredParticipants = useMemo(() => {
    let filtered = participants.filter((p) => {
      if (statusFilter === "all") return true;
      if (statusFilter === "accepted") return p.invitation_status === "accepted";
      if (statusFilter === "pending") return p.invitation_status === "pending";
      if (statusFilter === "declined") return p.invitation_status === "declined";
      return true;
    });

    // 정렬 적용
    if (sortBy) {
      filtered = [...filtered].sort((a, b) => {
        let aValue: number | string | null = null;
        let bValue: number | string | null = null;

        switch (sortBy) {
          case "name":
            aValue = a.student_name;
            bValue = b.student_name;
            break;
          case "attendance_rate":
            aValue = a.attendance_rate ?? -1;
            bValue = b.attendance_rate ?? -1;
            break;
          case "study_minutes":
            aValue = a.study_minutes ?? -1;
            bValue = b.study_minutes ?? -1;
            break;
          case "plan_completion_rate":
            aValue = a.plan_completion_rate ?? -1;
            bValue = b.plan_completion_rate ?? -1;
            break;
        }

        if (aValue === null && bValue === null) return 0;
        if (aValue === null) return 1;
        if (bValue === null) return -1;

        if (typeof aValue === "string" && typeof bValue === "string") {
          const comparison = aValue.localeCompare(bValue, "ko");
          return sortOrder === "asc" ? comparison : -comparison;
        }

        const comparison = (aValue as number) - (bValue as number);
        return sortOrder === "asc" ? comparison : -comparison;
      });
    }

    return filtered;
  }, [participants, statusFilter, sortBy, sortOrder]);

  // 정렬 핸들러
  const handleSort = useCallback((column: SortColumn) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  }, [sortBy, sortOrder]);

  // 선택 가능한 참여자만 필터링 (플랜이 생성된 참여자만 활성화 가능) - 메모이제이션
  const selectableParticipants = useMemo(() => {
    return filteredParticipants.filter(
      (p) => p.plan_group_id !== null && p.hasPlans
    );
  }, [filteredParticipants]);

  // 플랜 그룹이 없는 참여자 (플랜 생성 대상) - 메모이제이션
  const participantsWithoutGroup = useMemo(() => {
    return filteredParticipants.filter(
      (p) => p.plan_group_id === null
    );
  }, [filteredParticipants]);

  // 전체 선택/해제 핸들러 (메모이제이션)
  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      const selectableIds = new Set<string>();
      filteredParticipants.forEach((p) => {
        const key = p.plan_group_id || p.invitation_id;
        selectableIds.add(key);
      });
      setSelectedParticipantIds(selectableIds);
    } else {
      setSelectedParticipantIds(new Set());
    }
  }, [filteredParticipants]);

  // 개별 선택/해제 핸들러 (메모이제이션)
  const handleToggleSelect = useCallback((participant: Participant) => {
    const key = participant.plan_group_id || participant.invitation_id;

    setSelectedParticipantIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // 필터 변경 시 선택 해제
  const prevStatusFilterRef = useRef<string>(statusFilter);
  useEffect(() => {
    if (prevStatusFilterRef.current !== statusFilter) {
      setSelectedParticipantIds(new Set());
      prevStatusFilterRef.current = statusFilter;
    }
  }, [statusFilter]);

  // 통계 (메모이제이션)
  const stats = useMemo<ParticipantsStats>(() => {
    return {
      total: participants.length,
      accepted: participants.filter((p) => p.display_status === "accepted").length,
      pending: participants.filter(
        (p) => p.display_status === "pending" || p.display_status === "submitted"
      ).length,
      declined: participants.filter((p) => p.display_status === "declined").length,
      withPlan: participants.filter((p) => p.plan_group_id !== null).length,
      needsAction: participants.filter(
        (p) => p.plan_group_id !== null && !p.hasPlans
      ).length,
    };
  }, [participants]);

  // 작업이 필요한 참여자 목록 (메모이제이션)
  const needsActionParticipants = useMemo(() => {
    return participants.filter(
      (p) => p.plan_group_id !== null && !p.hasPlans
    );
  }, [participants]);

  // 플랜 그룹 일괄 생성 핸들러
  const handleBulkCreatePlanGroups = useCallback(async () => {
    const selectedWithoutGroup = participants.filter((p) => {
      const key = p.plan_group_id || p.invitation_id;
      return selectedParticipantIds.has(key) && p.plan_group_id === null;
    });

    if (selectedWithoutGroup.length === 0) {
      toast.showError("플랜 그룹이 없는 참여자를 선택해주세요.");
      return;
    }

    const invitationIds = selectedWithoutGroup.map((p) => p.invitation_id);

    startTransition(async () => {
      try {
        const result = await bulkCreatePlanGroupsForCamp(templateId, invitationIds);

        if (result.success) {
          toast.showSuccess(
            `${result.successCount}명의 학생에게 플랜 그룹이 생성되었습니다.`
          );
          setSelectedParticipantIds(new Set());
          setTimeout(() => {
            loadParticipants();
          }, 500);
        } else {
          const errorMsg =
            result.errors && result.errors.length > 0
              ? `${result.failureCount}개 실패: ${result.errors[0].error}`
              : "플랜 그룹 일괄 생성에 실패했습니다.";
          toast.showError(errorMsg);

          if (result.successCount > 0) {
            setTimeout(() => {
              loadParticipants();
            }, 500);
          }
        }
      } catch (error) {
        console.error("플랜 그룹 일괄 생성 실패:", error);
        toast.showError(
          error instanceof Error ? error.message : "플랜 그룹 일괄 생성에 실패했습니다."
        );
      }
    });
  }, [participants, selectedParticipantIds, templateId, toast, loadParticipants]);

  // 일괄 작업: 선택된 참여자 중 플랜 그룹이 있는 참여자 필터링
  const getSelectedWithGroup = useCallback(() => {
    return participants.filter((p) => {
      const key = p.plan_group_id || p.invitation_id;
      return selectedParticipantIds.has(key) && p.plan_group_id !== null;
    });
  }, [participants, selectedParticipantIds]);

  // 일괄 작업: 선택된 참여자 중 플랜 그룹이 없는 참여자 필터링
  const getSelectedWithoutGroup = useCallback(() => {
    return participants.filter((p) => {
      const key = p.plan_group_id || p.invitation_id;
      return selectedParticipantIds.has(key) && p.plan_group_id === null;
    });
  }, [participants, selectedParticipantIds]);

  // 일괄 작업 확인 핸들러
  const handleBatchConfirm = useCallback(async (batchStatus: string, onClose: () => void) => {
    if (selectedParticipantIds.size === 0) {
      toast.showError("선택된 참여자가 없습니다.");
      onClose();
      return;
    }

    const groupIds = Array.from(selectedParticipantIds).filter((id) => {
      return participants.some((p) => p.plan_group_id === id);
    });

    startTransition(async () => {
      try {
        const result = await batchUpdateCampPlanGroupStatus(groupIds, batchStatus);

        if (result.success) {
          toast.showSuccess(
            `${result.successCount}개 플랜 그룹의 상태가 변경되었습니다.`
          );
          setSelectedParticipantIds(new Set());
          onClose();
          setTimeout(() => {
            loadParticipants();
          }, 500);
        } else {
          const errorMsg =
            result.errors && result.errors.length > 0
              ? `${result.failureCount}개 실패: ${result.errors[0].error}`
              : "일괄 작업에 실패했습니다.";
          toast.showError(errorMsg);

          if (result.successCount > 0) {
            const successIds = new Set(
              groupIds.filter(
                (id) => !result.errors?.some((e) => e.groupId === id)
              )
            );
            setSelectedParticipantIds(successIds);
            setTimeout(() => {
              loadParticipants();
            }, 500);
          }
        }
      } catch (error) {
        console.error("일괄 작업 실패:", error);
        toast.showError(
          error instanceof Error ? error.message : "일괄 작업에 실패했습니다."
        );
      }
    });
  }, [selectedParticipantIds, participants, toast, loadParticipants]);

  return {
    // 상태
    participants,
    loading,
    statusFilter,
    sortBy,
    sortOrder,
    selectedParticipantIds,
    isPending,
    filteredParticipants,
    selectableParticipants,
    participantsWithoutGroup,
    stats,
    needsActionParticipants,
    lastLoadTimeRef,
    
    // 액션
    setStatusFilter,
    handleSort,
    handleSelectAll,
    handleToggleSelect,
    loadParticipants,
    handleBulkCreatePlanGroups,
    getSelectedWithGroup,
    getSelectedWithoutGroup,
    handleBatchConfirm,
  };
}

