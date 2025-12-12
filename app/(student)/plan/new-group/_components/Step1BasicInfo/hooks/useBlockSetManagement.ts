import { useState, useTransition, useEffect } from "react";
import {
  createBlockSet,
  getBlockSets,
  updateBlockSet,
} from "@/app/actions/blockSets";
import { addBlock, deleteBlock } from "@/app/actions/blocks";
import {
  createTenantBlockSet,
  getTenantBlockSets,
  updateTenantBlockSet,
  addTenantBlock,
  deleteTenantBlock,
} from "@/app/(admin)/actions/tenantBlockSets";
import {
  toPlanGroupError,
  PlanGroupErrorCodes,
} from "@/lib/errors/planGroupErrors";
import { WizardData } from "../../PlanGroupWizard";

type UseBlockSetManagementProps = {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  blockSets: Array<{
    id: string;
    name: string;
    blocks?: Array<{
      id: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
    }>;
  }>;
  onBlockSetCreated?: (blockSet: { id: string; name: string }) => void;
  onBlockSetsLoaded?: (
    blockSets: Array<{
      id: string;
      name: string;
      blocks?: Array<{
        id: string;
        day_of_week: number;
        start_time: string;
        end_time: string;
      }>;
    }>
  ) => void;
  isTemplateMode?: boolean;
  isCampMode?: boolean;
  templateId?: string;
};

export function useBlockSetManagement({
  data,
  onUpdate,
  blockSets,
  onBlockSetCreated,
  onBlockSetsLoaded,
  isTemplateMode = false,
  isCampMode = false,
  templateId,
}: UseBlockSetManagementProps) {
  const [blockSetMode, setBlockSetMode] = useState<
    "select" | "create" | "edit"
  >("select");
  const [newBlockSetName, setNewBlockSetName] = useState("");
  const [editingBlockSetId, setEditingBlockSetId] = useState<string | null>(
    null
  );
  const [editingBlockSetName, setEditingBlockSetName] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isLoadingBlockSets, setIsLoadingBlockSets] = useState(false);
  const [showBlockSetDescDialog, setShowBlockSetDescDialog] = useState(false);

  // 페이징 상태
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // 시간 블록 추가 관련 상태 (생성 및 수정 공통)
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);
  const [blockStartTime, setBlockStartTime] = useState<string>("");
  const [blockEndTime, setBlockEndTime] = useState<string>("");
  const [addedBlocks, setAddedBlocks] = useState<
    Array<{ day: number; startTime: string; endTime: string }>
  >([]);

  // 초기 로드 시 블록 세트 목록 자동 로드
  useEffect(() => {
    if (
      blockSets.length === 0 &&
      !isLoadingBlockSets &&
      !isTemplateMode &&
      !templateId
    ) {
      handleLoadBlockSets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 템플릿 블록 세트 자동 선택
  useEffect(() => {
    if (data.block_set_id && blockSets && blockSets.length > 0) {
      const selectedSet = blockSets.find((set) => set.id === data.block_set_id);
      if (!selectedSet && isCampMode) {
        console.log(
          "[Step1BasicInfo] 템플릿 블록 세트를 찾을 수 없습니다:",
          data.block_set_id
        );
      }
    }
  }, [data.block_set_id, blockSets, isCampMode]);

  // 공통: 블록 세트 목록 새로고침 함수
  const refreshBlockSets = async () => {
    const latestBlockSets = isTemplateMode
      ? await getTenantBlockSets()
      : await getBlockSets();

    if (onBlockSetsLoaded) {
      onBlockSetsLoaded(latestBlockSets);
    }

    return latestBlockSets;
  };

  const toggleWeekday = (day: number) => {
    setSelectedWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const selectAllWeekdays = () => {
    setSelectedWeekdays([0, 1, 2, 3, 4, 5, 6]);
  };

  const selectWeekdays = () => {
    setSelectedWeekdays([1, 2, 3, 4, 5]); // 월~금
  };

  const selectWeekends = () => {
    setSelectedWeekdays([0, 6]); // 일, 토
  };

  const handleAddBlock = () => {
    if (selectedWeekdays.length === 0) {
      alert("추가할 요일을 최소 1개 이상 선택해주세요.");
      return;
    }
    if (!blockStartTime || !blockEndTime) {
      alert("시작 시간과 종료 시간을 입력해주세요.");
      return;
    }

    const newBlocks = selectedWeekdays.map((day) => ({
      day,
      startTime: blockStartTime,
      endTime: blockEndTime,
    }));
    setAddedBlocks([...addedBlocks, ...newBlocks]);
    setSelectedWeekdays([]);
    setBlockStartTime("");
    setBlockEndTime("");
  };

  const handleRemoveBlock = (index: number) => {
    setAddedBlocks(addedBlocks.filter((_, i) => i !== index));
  };

  const handleCreateBlockSet = () => {
    if (!newBlockSetName.trim()) {
      alert("블록 세트 이름을 입력해주세요.");
      return;
    }

    // 중복 호출 방지
    if (isPending) {
      return;
    }

    startTransition(() => {
      (async () => {
        try {
          let blockSetId: string;
          let blockSetName: string;

          // 1. 블록 세트 생성 (템플릿/일반 모드 분기)
          if (isTemplateMode) {
            const templateFormData = new FormData();
            templateFormData.append("name", newBlockSetName.trim());

            console.log("[Step1BasicInfo] 테넌트 블록 세트 생성:", {
              name: newBlockSetName.trim(),
            });

            const templateResult = await createTenantBlockSet(templateFormData);
            blockSetId = templateResult.blockSetId;
            blockSetName = templateResult.name;

            console.log("[Step1BasicInfo] 테넌트 블록 세트 생성 성공:", {
              block_set_id: blockSetId,
              name: blockSetName,
            });
          } else {
            const formData = new FormData();
            formData.append("name", newBlockSetName.trim());
            const result = await createBlockSet(formData);
            blockSetId = result.blockSetId;
            blockSetName = result.name;
          }

          // 2. 시간 블록 추가 (공통 로직)
          if (addedBlocks.length > 0) {
            for (const block of addedBlocks) {
              const blockFormData = new FormData();
              blockFormData.append("day", String(block.day));
              blockFormData.append("start_time", block.startTime);
              blockFormData.append("end_time", block.endTime);
              blockFormData.append("block_set_id", blockSetId);

              try {
                if (isTemplateMode) {
                  await addTenantBlock(blockFormData);
                } else {
                  await addBlock(blockFormData);
                }
              } catch (error) {
                const planGroupError = toPlanGroupError(
                  error,
                  PlanGroupErrorCodes.BLOCK_SET_NOT_FOUND,
                  { day: block.day }
                );
                console.error(
                  `[Step1BasicInfo] 블록 추가 실패 (요일 ${block.day}):`,
                  planGroupError
                );
              }
            }
          }

          // 3. 최신 블록 세트 목록 다시 불러오기 (공통 함수 사용)
          await refreshBlockSets();

          // 4. 새 블록 세트 선택 (onBlockSetsLoaded 이후에 한 번만 호출)
          // 상태 업데이트를 startTransition 밖에서 수행하여 불필요한 리렌더링 방지
          onUpdate({ block_set_id: blockSetId });

          // 5. 폼 초기화 (상태 업데이트를 한 번에 처리)
          startTransition(() => {
            setNewBlockSetName("");
            setBlockSetMode("select");
            setAddedBlocks([]);
            setBlockStartTime("");
            setBlockEndTime("");
            setSelectedWeekdays([]);
            setCurrentPage(1);
          });
        } catch (error) {
          alert(
            error instanceof Error
              ? error.message
              : "블록 세트 생성에 실패했습니다."
          );
        }
      })();
    });
  };

  const handleLoadBlockSets = () => {
    setIsLoadingBlockSets(true);
    startTransition(() => {
      (async () => {
        try {
          await refreshBlockSets();
          setBlockSetMode("select");
          setCurrentPage(1);
        } catch (error) {
          alert(
            error instanceof Error
              ? error.message
              : "블록 세트 목록을 불러오는데 실패했습니다."
          );
        } finally {
          setIsLoadingBlockSets(false);
        }
      })();
    });
  };

  const handleStartEdit = () => {
    if (!data.block_set_id) {
      alert("먼저 블록 세트를 선택해주세요.");
      return;
    }
    if (!blockSets || blockSets.length === 0) {
      alert("블록 세트 목록을 불러올 수 없습니다.");
      return;
    }
    const selectedSet = blockSets.find((set) => set.id === data.block_set_id);
    if (!selectedSet) {
      alert("선택된 블록 세트를 찾을 수 없습니다.");
      return;
    }
    setEditingBlockSetId(selectedSet.id);
    setEditingBlockSetName(selectedSet.name);
    setBlockSetMode("edit");
  };

  const handleAddBlocksToSet = () => {
    if (!editingBlockSetId) {
      alert("블록 세트를 선택해주세요.");
      return;
    }
    if (selectedWeekdays.length === 0) {
      alert("추가할 요일을 최소 1개 이상 선택해주세요.");
      return;
    }
    if (!blockStartTime || !blockEndTime) {
      alert("시작 시간과 종료 시간을 입력해주세요.");
      return;
    }

    startTransition(() => {
      (async () => {
        try {
          // 블록 추가 (템플릿/일반 모드 분기)
          for (const day of selectedWeekdays) {
            const blockFormData = new FormData();
            blockFormData.append("day", String(day));
            blockFormData.append("start_time", blockStartTime);
            blockFormData.append("end_time", blockEndTime);
            blockFormData.append("block_set_id", editingBlockSetId);

            try {
              if (isTemplateMode) {
                await addTenantBlock(blockFormData);
              } else {
                await addBlock(blockFormData);
              }
            } catch (error) {
              const planGroupError = toPlanGroupError(
                error,
                PlanGroupErrorCodes.BLOCK_SET_NOT_FOUND,
                { day }
              );
              console.error(
                `[Step1BasicInfo] 블록 추가 실패 (요일 ${day}):`,
                planGroupError
              );
            }
          }

          // 최신 블록 세트 목록 새로고침 (공통 함수 사용)
          await refreshBlockSets();

          setSelectedWeekdays([]);
          setBlockStartTime("");
          setBlockEndTime("");
        } catch (error) {
          alert(
            error instanceof Error ? error.message : "블록 추가에 실패했습니다."
          );
        }
      })();
    });
  };

  const handleDeleteBlock = async (blockId: string) => {
    if (!confirm("이 시간 블록을 삭제하시겠습니까?")) {
      return;
    }

    startTransition(() => {
      (async () => {
        try {
          const blockFormData = new FormData();
          blockFormData.append("id", blockId);

          // 블록 삭제 (템플릿/일반 모드 분기)
          if (isTemplateMode) {
            await deleteTenantBlock(blockFormData);
          } else {
            await deleteBlock(blockFormData);
          }

          // 최신 블록 세트 목록 새로고침 (공통 함수 사용)
          await refreshBlockSets();
        } catch (error) {
          alert(
            error instanceof Error ? error.message : "블록 삭제에 실패했습니다."
          );
        }
      })();
    });
  };

  const handleUpdateBlockSetName = () => {
    if (!editingBlockSetId || !editingBlockSetName.trim()) {
      alert("블록 세트 이름을 입력해주세요.");
      return;
    }

    startTransition(() => {
      (async () => {
        try {
          const formData = new FormData();
          formData.append("id", editingBlockSetId);
          formData.append("name", editingBlockSetName.trim());

          // 블록 세트 이름 업데이트 (템플릿/일반 모드 분기)
          if (isTemplateMode) {
            await updateTenantBlockSet(formData);
          } else {
            await updateBlockSet(formData);
          }

          // 최신 블록 세트 목록 새로고침 (공통 함수 사용)
          const latestBlockSets = await refreshBlockSets();

          // 업데이트된 블록 세트 찾아서 선택 유지
          const updatedSet = latestBlockSets.find(
            (set) => set.id === editingBlockSetId
          );
          if (updatedSet) {
            onUpdate({ block_set_id: updatedSet.id });
          }

          setBlockSetMode("select");
          setEditingBlockSetId(null);
          setEditingBlockSetName("");
        } catch (error) {
          alert(
            error instanceof Error
              ? error.message
              : "블록 세트 이름 수정에 실패했습니다."
          );
        }
      })();
    });
  };

  return {
    blockSetMode,
    setBlockSetMode,
    newBlockSetName,
    setNewBlockSetName,
    editingBlockSetId,
    setEditingBlockSetId,
    editingBlockSetName,
    setEditingBlockSetName,
    isPending,
    isLoadingBlockSets,
    showBlockSetDescDialog,
    setShowBlockSetDescDialog,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    selectedWeekdays,
    setSelectedWeekdays,
    blockStartTime,
    setBlockStartTime,
    blockEndTime,
    setBlockEndTime,
    addedBlocks,
    setAddedBlocks,
    toggleWeekday,
    selectAllWeekdays,
    selectWeekdays,
    selectWeekends,
    handleAddBlock,
    handleRemoveBlock,
    handleCreateBlockSet,
    handleLoadBlockSets,
    handleStartEdit,
    handleAddBlocksToSet,
    handleDeleteBlock,
    handleUpdateBlockSetName,
  };
}
