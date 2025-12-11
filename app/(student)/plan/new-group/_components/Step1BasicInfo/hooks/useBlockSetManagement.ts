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

    startTransition(() => {
      (async () => {
        try {
          if (isTemplateMode) {
            const templateFormData = new FormData();
            templateFormData.append("name", newBlockSetName.trim());

            console.log("[Step1BasicInfo] 테넌트 블록 세트 생성:", {
              name: newBlockSetName.trim(),
            });

            const templateResult = await createTenantBlockSet(templateFormData);
            const templateBlockSetId = templateResult.blockSetId;
            const templateBlockSetName = templateResult.name;

            console.log("[Step1BasicInfo] 테넌트 블록 세트 생성 성공:", {
              block_set_id: templateBlockSetId,
              name: templateBlockSetName,
            });

            if (addedBlocks.length > 0) {
              for (const block of addedBlocks) {
                const blockFormData = new FormData();
                blockFormData.append("day", String(block.day));
                blockFormData.append("start_time", block.startTime);
                blockFormData.append("end_time", block.endTime);
                blockFormData.append("block_set_id", templateBlockSetId);

                try {
                  await addTenantBlock(blockFormData);
                } catch (error) {
                  const planGroupError = toPlanGroupError(
                    error,
                    PlanGroupErrorCodes.BLOCK_SET_NOT_FOUND,
                    { day: block.day }
                  );
                  console.error(
                    `[Step1BasicInfo] 테넌트 블록 추가 실패 (요일 ${block.day}):`,
                    planGroupError
                  );
                }
              }
            }

            console.log("[Step1BasicInfo] 최신 블록 세트 목록 조회");
            const latestBlockSets = await getTenantBlockSets();
            console.log("[Step1BasicInfo] 최신 블록 세트 목록 조회 결과:", {
              count: latestBlockSets.length,
              block_set_ids: latestBlockSets.map((bs) => bs.id),
            });
            if (onBlockSetsLoaded) {
              onBlockSetsLoaded(latestBlockSets);
            }

            onUpdate({ block_set_id: templateBlockSetId });

            setNewBlockSetName("");
            setBlockSetMode("select");
            setAddedBlocks([]);
            setBlockStartTime("");
            setBlockEndTime("");
            setSelectedWeekdays([]);
            setCurrentPage(1);
            return;
          }

          // 일반 모드
          const formData = new FormData();
          formData.append("name", newBlockSetName.trim());
          const result = await createBlockSet(formData);
          const blockSetId = result.blockSetId;
          const blockSetName = result.name;

          if (addedBlocks.length > 0) {
            for (const block of addedBlocks) {
              const blockFormData = new FormData();
              blockFormData.append("day", String(block.day));
              blockFormData.append("start_time", block.startTime);
              blockFormData.append("end_time", block.endTime);
              blockFormData.append("block_set_id", blockSetId);

              try {
                await addBlock(blockFormData);
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

          const newBlockSet = { id: blockSetId, name: blockSetName };
          if (onBlockSetCreated) {
            onBlockSetCreated(newBlockSet);
          }

          onUpdate({ block_set_id: blockSetId });

          setNewBlockSetName("");
          setBlockSetMode("select");
          setAddedBlocks([]);
          setBlockStartTime("");
          setBlockEndTime("");
          setSelectedWeekdays([]);
          setCurrentPage(1);
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
          if (isTemplateMode) {
            const latestBlockSets = await getTenantBlockSets();
            if (onBlockSetsLoaded) {
              onBlockSetsLoaded(latestBlockSets);
            }
          } else {
            const latestBlockSets = await getBlockSets();
            if (onBlockSetsLoaded) {
              onBlockSetsLoaded(latestBlockSets);
            }
          }
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
          if (isTemplateMode) {
            for (const day of selectedWeekdays) {
              const blockFormData = new FormData();
              blockFormData.append("day", String(day));
              blockFormData.append("start_time", blockStartTime);
              blockFormData.append("end_time", blockEndTime);
              blockFormData.append("block_set_id", editingBlockSetId);

              try {
                await addTenantBlock(blockFormData);
              } catch (error) {
                const planGroupError = toPlanGroupError(
                  error,
                  PlanGroupErrorCodes.BLOCK_SET_NOT_FOUND,
                  { day }
                );
                console.error(
                  `[Step1BasicInfo] 테넌트 블록 추가 실패 (요일 ${day}):`,
                  planGroupError
                );
              }
            }

            const latestBlockSets = await getTenantBlockSets();
            if (onBlockSetsLoaded) {
              onBlockSetsLoaded(latestBlockSets);
            }
          } else {
            for (const day of selectedWeekdays) {
              const blockFormData = new FormData();
              blockFormData.append("day", String(day));
              blockFormData.append("start_time", blockStartTime);
              blockFormData.append("end_time", blockEndTime);
              blockFormData.append("block_set_id", editingBlockSetId);

              try {
                await addBlock(blockFormData);
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

            const latestBlockSets = await getBlockSets();
            if (onBlockSetsLoaded) {
              onBlockSetsLoaded(latestBlockSets);
            }
          }

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

          if (isTemplateMode) {
            await deleteTenantBlock(blockFormData);

            const latestBlockSets = await getTenantBlockSets();
            if (onBlockSetsLoaded) {
              onBlockSetsLoaded(latestBlockSets);
            }
          } else {
            await deleteBlock(blockFormData);

            const latestBlockSets = await getBlockSets();
            if (onBlockSetsLoaded) {
              onBlockSetsLoaded(latestBlockSets);
            }
          }
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

          if (isTemplateMode) {
            await updateTenantBlockSet(formData);

            const latestBlockSets = await getTenantBlockSets();
            if (onBlockSetsLoaded) {
              onBlockSetsLoaded(latestBlockSets);
            }

            const updatedSet = latestBlockSets.find(
              (set) => set.id === editingBlockSetId
            );
            if (updatedSet) {
              onUpdate({ block_set_id: updatedSet.id });
            }
          } else {
            await updateBlockSet(formData);

            const latestBlockSets = await getBlockSets();
            if (onBlockSetsLoaded) {
              onBlockSetsLoaded(latestBlockSets);
            }

            const updatedSet = latestBlockSets.find(
              (set) => set.id === editingBlockSetId
            );
            if (updatedSet) {
              onUpdate({ block_set_id: updatedSet.id });
            }
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
