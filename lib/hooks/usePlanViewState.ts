"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type { PlanGroup } from "@/app/(student)/today/_utils/planGroupUtils";

export type ViewMode = "single" | "daily";

type UsePlanViewStateOptions = {
  initialMode?: ViewMode;
  initialSelectedPlanNumber?: number | null;
  groups: PlanGroup[];
  planDate: string;
};

type UsePlanViewStateReturn = {
  // 상태
  viewMode: ViewMode;
  selectedPlanNumber: number | null;
  selectedPlanId: string | null;

  // 핸들러
  handleViewDetail: (planId: string) => void;
  handleSelectPlan: (planNumber: number | null) => void;
  handleSelectPlanById: (planId: string) => void;
  handleModeChange: (mode: ViewMode) => void;
};

/**
 * PlanView 선택 및 뷰 모드 상태 관리 Hook
 *
 * - viewMode (single/daily) 관리
 * - 선택된 플랜 (planNumber, planId) 관리
 * - groups 변경 시 선택 동기화
 *
 * 참고: planDate 관리는 컴포넌트에서 직접 처리 (순환 의존성 방지)
 */
export function usePlanViewState({
  initialMode = "daily",
  initialSelectedPlanNumber = null,
  groups,
  planDate,
}: UsePlanViewStateOptions): UsePlanViewStateReturn {
  // 뷰 모드 상태
  const [viewMode, setViewMode] = useState<ViewMode>(initialMode);

  // 선택된 플랜 상태
  const [selectedPlanNumber, setSelectedPlanNumber] = useState<number | null>(
    initialSelectedPlanNumber
  );
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  // 사용자 선택 추적 refs
  const lastUserSelectedPlanNumber = useRef<number | null>(null);
  const lastUserSelectedPlanId = useRef<string | null>(null);
  const lastPlanDate = useRef<string>(planDate);
  const prevGroupsKey = useRef<string>("");

  // groups 키 계산 (변경 감지용)
  const groupsKey = useMemo(() => {
    return groups.map((g) => g.plan.id).join(",");
  }, [groups]);

  // planDate 변경 시 선택 초기화
  useEffect(() => {
    if (planDate !== lastPlanDate.current) {
      lastPlanDate.current = planDate;
      lastUserSelectedPlanNumber.current = null;
      lastUserSelectedPlanId.current = null;
      if (groups.length > 0) {
        setSelectedPlanNumber(groups[0]?.planNumber ?? null);
        setSelectedPlanId(groups[0]?.plan.id ?? null);
      } else {
        setSelectedPlanNumber(null);
        setSelectedPlanId(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planDate]);

  // groups 변경 시 선택 동기화
  useEffect(() => {
    // planDate 변경은 위의 useEffect에서 처리
    if (planDate !== lastPlanDate.current) {
      prevGroupsKey.current = groupsKey;
      return;
    }

    // groupsKey가 변경되지 않았으면 실행하지 않음
    if (groupsKey === prevGroupsKey.current) {
      return;
    }
    prevGroupsKey.current = groupsKey;

    // 사용자 선택이 유효하면 유지
    if (lastUserSelectedPlanId.current !== null) {
      if (groups.some((g) => g.plan.id === lastUserSelectedPlanId.current)) {
        return;
      }
    }
    if (lastUserSelectedPlanNumber.current !== null) {
      if (groups.some((g) => g.planNumber === lastUserSelectedPlanNumber.current)) {
        return;
      }
    }

    // 그룹이 없으면 null로 설정
    if (groups.length === 0) {
      if (selectedPlanNumber !== null) {
        setSelectedPlanNumber(null);
      }
      if (selectedPlanId !== null) {
        setSelectedPlanId(null);
      }
      return;
    }

    // 현재 선택이 유효한지 확인
    const isValidSelection = selectedPlanId
      ? groups.some((g) => g.plan.id === selectedPlanId)
      : selectedPlanNumber !== null
      ? groups.some((g) => g.planNumber === selectedPlanNumber)
      : groups.length > 0;

    if (!isValidSelection) {
      setSelectedPlanNumber(groups[0]?.planNumber ?? null);
      setSelectedPlanId(groups[0]?.plan.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupsKey, planDate]);

  // 플랜 상세 보기 (daily → single 전환)
  const handleViewDetail = useCallback(
    (planId: string) => {
      const selectedGroup = groups.find((g) => g.plan.id === planId);
      if (selectedGroup) {
        const planNumber = selectedGroup.planNumber;
        lastUserSelectedPlanNumber.current = planNumber;
        lastUserSelectedPlanId.current = planId;
        setSelectedPlanNumber(planNumber);
        setSelectedPlanId(planId);
        setViewMode("single");
      } else if (groups.length > 0) {
        const planNumber = groups[0].planNumber;
        const firstPlanId = groups[0].plan.id;
        lastUserSelectedPlanNumber.current = planNumber;
        lastUserSelectedPlanId.current = firstPlanId;
        setSelectedPlanNumber(planNumber);
        setSelectedPlanId(firstPlanId);
        setViewMode("single");
      }
    },
    [groups]
  );

  // planNumber로 플랜 선택
  const handleSelectPlan = useCallback(
    (planNumber: number | null) => {
      lastUserSelectedPlanNumber.current = planNumber;
      setSelectedPlanNumber(planNumber);
      const selectedGroup = groups.find((g) => g.planNumber === planNumber);
      if (selectedGroup) {
        lastUserSelectedPlanId.current = selectedGroup.plan.id;
        setSelectedPlanId(selectedGroup.plan.id);
      } else if (planNumber === null) {
        lastUserSelectedPlanId.current = null;
        setSelectedPlanId(null);
      }
    },
    [groups]
  );

  // planId로 플랜 선택
  const handleSelectPlanById = useCallback(
    (planId: string) => {
      const selectedGroup = groups.find((g) => g.plan.id === planId);
      if (selectedGroup) {
        const planNumber = selectedGroup.planNumber;
        lastUserSelectedPlanNumber.current = planNumber;
        lastUserSelectedPlanId.current = planId;
        setSelectedPlanNumber(planNumber);
        setSelectedPlanId(planId);
      }
    },
    [groups]
  );

  // 뷰 모드 변경
  const handleModeChange = useCallback(
    (mode: ViewMode) => {
      setViewMode(mode);
      if (mode === "single" && !selectedPlanNumber && groups.length > 0) {
        setSelectedPlanNumber(groups[0]?.planNumber ?? null);
        setSelectedPlanId(groups[0]?.plan.id ?? null);
      }
    },
    [groups, selectedPlanNumber]
  );

  return {
    viewMode,
    selectedPlanNumber,
    selectedPlanId,
    handleViewDetail,
    handleSelectPlan,
    handleSelectPlanById,
    handleModeChange,
  };
}
