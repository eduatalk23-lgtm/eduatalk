import { useState, useTransition, useEffect } from "react";
import {
  createBlockSet,
  getBlockSets,
  updateBlockSet,
} from "@/app/actions/blockSets";
import { addBlock, deleteBlock, addBlocksToMultipleDays } from "@/app/actions/blocks";
import {
  createTenantBlockSet,
  getTenantBlockSets,
  updateTenantBlockSet,
  addTenantBlock,
  addTenantBlocksToMultipleDays,
  deleteTenantBlock,
} from "@/app/(admin)/actions/tenantBlockSets";
import {
  toPlanGroupError,
  PlanGroupErrorCodes,
} from "@/lib/errors/planGroupErrors";
import { WizardData } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
import { isSuccessResponse, isErrorResponse } from "@/lib/types/actionResponse";

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
    if (isTemplateMode) {
      // getTenantBlockSets는 ActionResponse를 반환하지 않음 (withErrorHandling 사용)
      const blockSets = await getTenantBlockSets();
      if (onBlockSetsLoaded) {
        onBlockSetsLoaded(blockSets);
      }
      return blockSets;
    } else {
      // getBlockSets는 ActionResponse를 반환함 (withActionResponse 사용)
      const result = await getBlockSets();
      if (isSuccessResponse(result) && result.data) {
        if (onBlockSetsLoaded) {
          onBlockSetsLoaded(result.data);
        }
        return result.data;
      }
      // 에러 발생 시 빈 배열 반환
      return [];
    }
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

            // createTenantBlockSet는 ActionResponse를 반환하지 않고 직접 객체를 반환
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
            if (!isSuccessResponse(result) || !result.data) {
              const errorMessage = isErrorResponse(result) ? (result.error || result.message) : "블록 세트 생성에 실패했습니다.";
              throw new Error(errorMessage);
            }
            // createBlockSet는 ActionResponse를 반환
            blockSetId = result.data.blockSetId;
            blockSetName = result.data.name;
          }

          // 2. 시간 블록 추가 (일괄 처리로 최적화)
          if (addedBlocks.length > 0) {
            // 같은 시간대를 가진 블록들을 그룹화
            const blocksByTime = addedBlocks.reduce((acc, block) => {
              const timeKey = `${block.startTime}-${block.endTime}`;
              if (!acc[timeKey]) {
                acc[timeKey] = {
                  startTime: block.startTime,
                  endTime: block.endTime,
                  days: [],
                };
              }
              acc[timeKey].days.push(block.day);
              return acc;
            }, {} as Record<string, { startTime: string; endTime: string; days: number[] }>);

            // 각 시간대별로 일괄 추가
            for (const timeKey in blocksByTime) {
              const { startTime, endTime, days } = blocksByTime[timeKey];
              
              try {
                if (isTemplateMode) {
                  const blockFormData = new FormData();
                  blockFormData.append("target_days", days.join(","));
                  blockFormData.append("start_time", startTime);
                  blockFormData.append("end_time", endTime);
                  blockFormData.append("block_set_id", blockSetId);
                  await addTenantBlocksToMultipleDays(blockFormData);
                } else {
                  const blockFormData = new FormData();
                  blockFormData.append("target_days", days.join(","));
                  blockFormData.append("start_time", startTime);
                  blockFormData.append("end_time", endTime);
                  blockFormData.append("block_set_id", blockSetId);
                  await addBlocksToMultipleDays(blockFormData);
                }
              } catch (error: unknown) {
                // INFO: 접두사가 있는 경우 부분 성공 메시지로 처리
                const errorMessage = error instanceof Error ? error.message : String(error);
                if (errorMessage.startsWith("INFO:")) {
                  console.log("[Step1BasicInfo] 블록 추가 부분 성공:", errorMessage);
                  // 부분 성공은 계속 진행
                } else {
                  const planGroupError = toPlanGroupError(
                    error,
                    PlanGroupErrorCodes.BLOCK_SET_NOT_FOUND,
                    { days: days.join(",") }
                  );
                  console.error(
                    `[Step1BasicInfo] 블록 추가 실패 (요일 ${days.join(",")}):`,
                    planGroupError
                  );
                  // 일부 실패해도 계속 진행 (부분 성공 허용)
                }
              }
            }
          }

          // 3. 최신 블록 세트 목록 다시 불러오기 (공통 함수 사용)
          const latestBlockSets = await refreshBlockSets();

          // 4. 새 블록 세트가 목록에 포함되었는지 확인 후 선택
          const newBlockSet = latestBlockSets.find(set => set.id === blockSetId);
          if (newBlockSet) {
            // 새로고침 완료 후 안전하게 선택
            onUpdate({ block_set_id: blockSetId });
          } else {
            console.warn("[Step1BasicInfo] 새로 생성된 블록 세트를 목록에서 찾을 수 없습니다:", blockSetId);
            // 목록 새로고침 후에도 없으면 사용자에게 알림
            alert("블록 세트가 생성되었지만 목록에 반영되지 않았습니다. 새로고침 버튼을 클릭해주세요.");
          }

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
          // 블록 일괄 추가 (템플릿/일반 모드 분기)
          const blockFormData = new FormData();
          blockFormData.append("target_days", selectedWeekdays.join(","));
          blockFormData.append("start_time", blockStartTime);
          blockFormData.append("end_time", blockEndTime);
          blockFormData.append("block_set_id", editingBlockSetId);

          try {
            if (isTemplateMode) {
              await addTenantBlocksToMultipleDays(blockFormData);
            } else {
              await addBlocksToMultipleDays(blockFormData);
            }
          } catch (error: unknown) {
            // INFO: 접두사가 있는 경우 부분 성공 메시지로 처리
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.startsWith("INFO:")) {
              console.log("[Step1BasicInfo] 블록 추가 부분 성공:", errorMessage);
              // 부분 성공은 계속 진행
            } else {
              const planGroupError = toPlanGroupError(
                error,
                PlanGroupErrorCodes.BLOCK_SET_NOT_FOUND,
                { days: selectedWeekdays.join(",") }
              );
              console.error(
                `[Step1BasicInfo] 블록 추가 실패 (요일 ${selectedWeekdays.join(",")}):`,
                planGroupError
              );
              // 에러가 발생해도 사용자에게 알림
              alert(
                error instanceof Error
                  ? error.message
                  : "블록 추가 중 오류가 발생했습니다."
              );
            }
          }

          // 최신 블록 세트 목록 새로고침 (공통 함수 사용)
          const latestBlockSets = await refreshBlockSets();
          
          // 새로고침 완료 확인 (디버깅용)
          const updatedSet = latestBlockSets.find(set => set.id === editingBlockSetId);
          if (!updatedSet) {
            console.warn("[Step1BasicInfo] 블록 추가 후 세트를 찾을 수 없습니다:", editingBlockSetId);
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

          // 블록 삭제 (템플릿/일반 모드 분기)
          if (isTemplateMode) {
            await deleteTenantBlock(blockFormData);
          } else {
            await deleteBlock(blockFormData);
          }

          // 최신 블록 세트 목록 새로고침 (공통 함수 사용)
          const latestBlockSets = await refreshBlockSets();
          
          // 새로고침 완료 확인 (디버깅용)
          if (editingBlockSetId) {
            const updatedSet = latestBlockSets.find(set => set.id === editingBlockSetId);
            if (!updatedSet) {
              console.warn("[Step1BasicInfo] 블록 삭제 후 세트를 찾을 수 없습니다:", editingBlockSetId);
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
            // 새로고침 완료 후 안전하게 선택 유지
            onUpdate({ block_set_id: updatedSet.id });
          } else {
            console.warn("[Step1BasicInfo] 이름 수정 후 블록 세트를 목록에서 찾을 수 없습니다:", editingBlockSetId);
            // 목록에서 찾을 수 없어도 계속 진행 (이름은 이미 업데이트됨)
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
