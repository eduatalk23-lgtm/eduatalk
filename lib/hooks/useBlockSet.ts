"use client";

/**
 * 블록 세트 관리 훅
 *
 * UI 컴포넌트에서 블록 세트 관련 비즈니스 로직을 분리했습니다.
 * Step1BasicInfo 등에서 사용합니다.
 */

import { useState, useCallback, useTransition } from "react";
import {
  createBlockSet,
  getBlockSets,
  updateBlockSet,
  addBlock,
  deleteBlock,
} from "@/lib/domains/block/actions";
import { isSuccessResponse } from "@/lib/types/actionResponse";

export type BlockSetItem = {
  id: string;
  name: string;
  blocks?: Array<{
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
  }>;
};

export type BlockSetMode = "select" | "create" | "edit";

export type TimeBlock = {
  day: number;
  startTime: string;
  endTime: string;
};

export type UseBlockSetOptions = {
  initialBlockSets?: BlockSetItem[];
  onBlockSetCreated?: (blockSet: { id: string; name: string }) => void;
  onBlockSetsLoaded?: (blockSets: BlockSetItem[]) => void;
};

export type UseBlockSetReturn = {
  // 상태
  blockSets: BlockSetItem[];
  mode: BlockSetMode;
  selectedBlockSetId: string | null;
  editingBlockSetId: string | null;
  isPending: boolean;
  isLoading: boolean;

  // 생성/수정 관련 상태
  newBlockSetName: string;
  editingBlockSetName: string;
  selectedWeekdays: number[];
  blockStartTime: string;
  blockEndTime: string;
  addedBlocks: TimeBlock[];

  // 액션
  setMode: (mode: BlockSetMode) => void;
  selectBlockSet: (id: string) => void;
  loadBlockSets: () => Promise<void>;
  createNewBlockSet: () => Promise<{ success: boolean; error?: string }>;
  updateExistingBlockSet: () => Promise<{ success: boolean; error?: string }>;
  startEdit: (blockSet: BlockSetItem) => void;
  cancelEdit: () => void;

  // 블록 관리
  setNewBlockSetName: (name: string) => void;
  setEditingBlockSetName: (name: string) => void;
  setSelectedWeekdays: (days: number[]) => void;
  setBlockStartTime: (time: string) => void;
  setBlockEndTime: (time: string) => void;
  addTimeBlock: () => void;
  removeTimeBlock: (index: number) => void;
  clearAddedBlocks: () => void;
};

/**
 * 블록 세트 관리 훅
 */
export function useBlockSet(
  options: UseBlockSetOptions = {}
): UseBlockSetReturn {
  const {
    initialBlockSets = [],
    onBlockSetCreated,
    onBlockSetsLoaded,
  } = options;

  const [blockSets, setBlockSets] = useState<BlockSetItem[]>(initialBlockSets);
  const [mode, setMode] = useState<BlockSetMode>("select");
  const [selectedBlockSetId, setSelectedBlockSetId] = useState<string | null>(
    null
  );
  const [editingBlockSetId, setEditingBlockSetId] = useState<string | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  // 생성/수정 관련 상태
  const [newBlockSetName, setNewBlockSetName] = useState("");
  const [editingBlockSetName, setEditingBlockSetName] = useState("");
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);
  const [blockStartTime, setBlockStartTime] = useState("");
  const [blockEndTime, setBlockEndTime] = useState("");
  const [addedBlocks, setAddedBlocks] = useState<TimeBlock[]>([]);

  // 블록 세트 목록 로드
  const loadBlockSets = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getBlockSets();
      if (isSuccessResponse(result) && result.data) {
        setBlockSets(result.data);
        onBlockSetsLoaded?.(result.data);
      }
    } catch (error) {
      console.error("[useBlockSet] 블록 세트 로드 실패:", error);
    } finally {
      setIsLoading(false);
    }
  }, [onBlockSetsLoaded]);

  // 블록 세트 선택
  const selectBlockSet = useCallback((id: string) => {
    setSelectedBlockSetId(id);
  }, []);

  // 새 블록 세트 생성
  const createNewBlockSet = useCallback(async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    if (!newBlockSetName.trim()) {
      return { success: false, error: "블록 세트 이름을 입력해주세요." };
    }

    if (addedBlocks.length === 0) {
      return { success: false, error: "최소 하나의 시간 블록을 추가해주세요." };
    }

    return new Promise((resolve) => {
      startTransition(async () => {
        try {
          const formData = new FormData();
          formData.append("name", newBlockSetName);
          const result = await createBlockSet(formData);

          if (isSuccessResponse(result) && result.data) {
            const newBlockSet = {
              id: result.data.blockSetId,
              name: result.data.name,
              blocks: addedBlocks.map((block) => ({
                id: crypto.randomUUID(),
                day_of_week: block.day,
                start_time: block.startTime,
                end_time: block.endTime,
              })),
            };

            setBlockSets((prev) => [...prev, newBlockSet]);
            onBlockSetCreated?.({ id: result.data.blockSetId, name: result.data.name });
          }

          // 상태 초기화
          setNewBlockSetName("");
          setAddedBlocks([]);
          setSelectedWeekdays([]);
          setBlockStartTime("");
          setBlockEndTime("");
          setMode("select");

          resolve({ success: true });
        } catch (error) {
          console.error("[useBlockSet] 블록 세트 생성 실패:", error);
          resolve({ success: false, error: "생성 중 오류가 발생했습니다." });
        }
      });
    });
  }, [newBlockSetName, addedBlocks, onBlockSetCreated]);

  // 블록 세트 수정
  const updateExistingBlockSet = useCallback(async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    if (!editingBlockSetId) {
      return {
        success: false,
        error: "수정할 블록 세트가 선택되지 않았습니다.",
      };
    }

    if (!editingBlockSetName.trim()) {
      return { success: false, error: "블록 세트 이름을 입력해주세요." };
    }

    return new Promise((resolve) => {
      startTransition(async () => {
        try {
          const formData = new FormData();
          formData.append("id", editingBlockSetId);
          formData.append("name", editingBlockSetName);
          await updateBlockSet(formData);

          setBlockSets((prev) =>
            prev.map((bs) =>
              bs.id === editingBlockSetId
                ? { ...bs, name: editingBlockSetName }
                : bs
            )
          );

          // 상태 초기화
          setEditingBlockSetId(null);
          setEditingBlockSetName("");
          setMode("select");

          resolve({ success: true });
        } catch (error) {
          console.error("[useBlockSet] 블록 세트 수정 실패:", error);
          resolve({ success: false, error: "수정 중 오류가 발생했습니다." });
        }
      });
    });
  }, [editingBlockSetId, editingBlockSetName]);

  // 수정 시작
  const startEdit = useCallback((blockSet: BlockSetItem) => {
    setEditingBlockSetId(blockSet.id);
    setEditingBlockSetName(blockSet.name);
    setMode("edit");
  }, []);

  // 수정 취소
  const cancelEdit = useCallback(() => {
    setEditingBlockSetId(null);
    setEditingBlockSetName("");
    setNewBlockSetName("");
    setAddedBlocks([]);
    setSelectedWeekdays([]);
    setBlockStartTime("");
    setBlockEndTime("");
    setMode("select");
  }, []);

  // 시간 블록 추가
  const addTimeBlock = useCallback(() => {
    if (selectedWeekdays.length === 0 || !blockStartTime || !blockEndTime) {
      return;
    }

    const newBlocks = selectedWeekdays.map((day) => ({
      day,
      startTime: blockStartTime,
      endTime: blockEndTime,
    }));

    setAddedBlocks((prev) => [...prev, ...newBlocks]);
    setSelectedWeekdays([]);
    setBlockStartTime("");
    setBlockEndTime("");
  }, [selectedWeekdays, blockStartTime, blockEndTime]);

  // 시간 블록 제거
  const removeTimeBlock = useCallback((index: number) => {
    setAddedBlocks((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // 추가된 블록 초기화
  const clearAddedBlocks = useCallback(() => {
    setAddedBlocks([]);
  }, []);

  return {
    // 상태
    blockSets,
    mode,
    selectedBlockSetId,
    editingBlockSetId,
    isPending,
    isLoading,

    // 생성/수정 관련 상태
    newBlockSetName,
    editingBlockSetName,
    selectedWeekdays,
    blockStartTime,
    blockEndTime,
    addedBlocks,

    // 액션
    setMode,
    selectBlockSet,
    loadBlockSets,
    createNewBlockSet,
    updateExistingBlockSet,
    startEdit,
    cancelEdit,

    // 블록 관리
    setNewBlockSetName,
    setEditingBlockSetName,
    setSelectedWeekdays,
    setBlockStartTime,
    setBlockEndTime,
    addTimeBlock,
    removeTimeBlock,
    clearAddedBlocks,
  };
}
