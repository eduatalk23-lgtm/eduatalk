import { useMemo } from "react";
import { HelpCircle } from "lucide-react";
import { CollapsibleSection } from "../../../_summary/CollapsibleSection";
import { BlockSetTimeline } from "../../../common/BlockSetTimeline";
import { WizardData, TemplateLockedFields } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
import { useBlockSetManagement } from "../hooks/useBlockSetManagement";
import {
  BlockSetSelector,
  BlockSetCreateForm,
  BlockSetEditForm,
  BlockSetHelpDialog,
  BlockSetHeader,
} from "./block-set";

type Step1FieldName = keyof NonNullable<TemplateLockedFields["step1"]>;

type BlockSetSectionProps = {
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
  management: ReturnType<typeof useBlockSetManagement>;
  editable: boolean;
  isCampMode: boolean;
  isTemplateMode: boolean;
  toggleFieldControl: (fieldName: Step1FieldName, enabled?: boolean) => void;
  canStudentInputBlockSetId: boolean;
  lockedFields: Record<string, boolean>;
};

export function BlockSetSection({
  data,
  onUpdate,
  blockSets,
  management,
  editable,
  isCampMode,
  isTemplateMode,
  toggleFieldControl,
  canStudentInputBlockSetId,
  lockedFields,
}: BlockSetSectionProps) {
  const {
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
    blockStartTime,
    setBlockStartTime,
    blockEndTime,
    setBlockEndTime,
    addedBlocks,
    toggleWeekday,
    selectAllWeekdays,
    selectWeekdays,
    selectWeekends,
    handleAddBlock,
    handleRemoveBlock,
    handleCreateBlockSet,
    handleLoadBlockSets,
    handleAddBlocksToSet,
    handleDeleteBlock,
    handleUpdateBlockSetName,
    setSelectedWeekdays,
    setAddedBlocks,
  } = management;

  // 중복된 ID를 가진 블록 세트 제거 (첫 번째 항목만 유지)
  const uniqueBlockSets = useMemo(() => {
    const seen = new Set<string>();
    return blockSets.filter((set) => {
      if (seen.has(set.id)) {
        return false;
      }
      seen.add(set.id);
      return true;
    });
  }, [blockSets]);

  // 선택된 블록 세트 정보
  const selectedBlockSet = useMemo(() => {
    return data.block_set_id
      ? uniqueBlockSets.find((set) => set.id === data.block_set_id)
      : null;
  }, [data.block_set_id, uniqueBlockSets]);

  // 수정 중인 블록 세트 정보
  const editingBlockSet = useMemo(() => {
    return editingBlockSetId
      ? uniqueBlockSets.find((set) => set.id === editingBlockSetId)
      : null;
  }, [editingBlockSetId, uniqueBlockSets]);

  // 선택/수정 가능 여부
  const canModify = editable && (!isCampMode || canStudentInputBlockSetId);

  // 폼 리셋 핸들러
  const resetFormState = () => {
    setAddedBlocks([]);
    setBlockStartTime("");
    setBlockEndTime("");
    setSelectedWeekdays([]);
  };

  const handleCancelCreate = () => {
    setBlockSetMode("select");
    setNewBlockSetName("");
    resetFormState();
  };

  const handleCancelEdit = () => {
    setBlockSetMode("select");
    setEditingBlockSetId(null);
    setEditingBlockSetName("");
    resetFormState();
  };

  const handleSelectBlockSet = (id: string | undefined) => {
    onUpdate({ block_set_id: id });
  };

  const handleStartEditBlockSet = (id: string, name: string) => {
    setEditingBlockSetId(id);
    setEditingBlockSetName(name);
    setBlockSetMode("edit");
  };

  const handleCreateClick = () => {
    if (canModify) {
      setBlockSetMode("create");
    }
  };

  // 타임라인용 블록 데이터
  const timelineBlocks = useMemo(() => {
    const rawBlocks = selectedBlockSet?.blocks ?? [];
    return rawBlocks.map((block, index) => ({
      ...block,
      block_index: index,
    }));
  }, [selectedBlockSet]);

  const timelineName = selectedBlockSet?.name || "블록 세트를 선택해주세요";

  return (
    <>
      <CollapsibleSection
        title={
          <>
            블록 세트 *
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowBlockSetDescDialog(true);
              }}
              className="inline-flex items-center text-gray-800 hover:text-gray-900"
              title="블록 세트 설명"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          </>
        }
        defaultOpen={true}
        studentInputAllowed={lockedFields.allow_student_block_set_id === true}
        onStudentInputToggle={(enabled) =>
          toggleFieldControl("allow_student_block_set_id", enabled)
        }
        showStudentInputToggle={isTemplateMode}
      >
        <div className="space-y-6">
          <BlockSetHeader
            isLoadingBlockSets={isLoadingBlockSets}
            onRefresh={handleLoadBlockSets}
            showCreateButton={blockSetMode === "select"}
            isCreateDisabled={!canModify}
            onCreateClick={handleCreateClick}
          />

          {/* 선택된 블록 세트의 시간 블록 정보 표시 (목록 위) */}
          <BlockSetTimeline blocks={timelineBlocks} name={timelineName} />

          {/* 기존 블록 세트 선택 */}
          {blockSetMode === "select" && (
            <BlockSetSelector
              blockSets={uniqueBlockSets}
              selectedBlockSetId={data.block_set_id}
              onSelect={handleSelectBlockSet}
              onEdit={handleStartEditBlockSet}
              editable={editable}
              isCampMode={isCampMode}
              canStudentInputBlockSetId={canStudentInputBlockSetId}
              currentPage={currentPage}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          )}

          {/* 블록 세트 생성 폼 */}
          {blockSetMode === "create" && canModify && (
            <BlockSetCreateForm
              blockSetName={newBlockSetName}
              onBlockSetNameChange={setNewBlockSetName}
              selectedWeekdays={selectedWeekdays}
              blockStartTime={blockStartTime}
              blockEndTime={blockEndTime}
              onToggleWeekday={toggleWeekday}
              onSelectAll={selectAllWeekdays}
              onSelectWeekdays={selectWeekdays}
              onSelectWeekends={selectWeekends}
              onStartTimeChange={setBlockStartTime}
              onEndTimeChange={setBlockEndTime}
              onAddBlock={handleAddBlock}
              addedBlocks={addedBlocks}
              onRemoveBlock={handleRemoveBlock}
              onCancel={handleCancelCreate}
              onCreate={handleCreateBlockSet}
              isPending={isPending}
            />
          )}

          {/* 블록 세트 수정 폼 */}
          {blockSetMode === "edit" && editingBlockSetId && (
            <BlockSetEditForm
              blockSetName={editingBlockSetName}
              originalName={editingBlockSet?.name ?? ""}
              onBlockSetNameChange={setEditingBlockSetName}
              onUpdateName={handleUpdateBlockSetName}
              existingBlocks={editingBlockSet?.blocks ?? []}
              selectedWeekdays={selectedWeekdays}
              blockStartTime={blockStartTime}
              blockEndTime={blockEndTime}
              onToggleWeekday={toggleWeekday}
              onSelectAll={selectAllWeekdays}
              onSelectWeekdays={selectWeekdays}
              onSelectWeekends={selectWeekends}
              onStartTimeChange={setBlockStartTime}
              onEndTimeChange={setBlockEndTime}
              onAddBlocks={handleAddBlocksToSet}
              onDeleteBlock={handleDeleteBlock}
              onCancel={handleCancelEdit}
              isPending={isPending}
            />
          )}
        </div>
      </CollapsibleSection>

      {/* 블록 세트 설명 다이얼로그 */}
      <BlockSetHelpDialog
        open={showBlockSetDescDialog}
        onOpenChange={setShowBlockSetDescDialog}
      />
    </>
  );
}
