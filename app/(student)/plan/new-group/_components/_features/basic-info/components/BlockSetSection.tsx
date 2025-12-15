import { useMemo } from "react";
import { HelpCircle, RefreshCw, Plus, Pencil } from "lucide-react";
import { CollapsibleSection } from "../../../_summary/CollapsibleSection";
import { BlockSetTimeline } from "../../../_components/BlockSetTimeline";
import { WizardData } from "../../../../PlanGroupWizard";
import { Dialog } from "@/components/ui/Dialog";
import { useBlockSetManagement } from "../../hooks/useBlockSetManagement";
import { WeekdaySelector } from "./WeekdaySelector";

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
  toggleFieldControl: (fieldName: string) => void;
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
    handleStartEdit,
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
          toggleFieldControl("allow_student_block_set_id")
        }
        showStudentInputToggle={isTemplateMode}
      >
        <div className="space-y-6">
          <div className="flex items-center justify-end">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleLoadBlockSets}
                disabled={isLoadingBlockSets}
                className="flex items-center gap-1 rounded p-1.5 text-xs text-gray-800 hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
                title="목록 새로고침"
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    isLoadingBlockSets ? "animate-spin" : ""
                  }`}
                />
              </button>
              {blockSetMode === "select" && (
                <button
                  type="button"
                  onClick={() => {
                    if (isCampMode && !canStudentInputBlockSetId) return;
                    setBlockSetMode("create");
                  }}
                  disabled={isCampMode && !canStudentInputBlockSetId}
                  className={`flex items-center gap-1 rounded p-1.5 text-xs ${
                    isCampMode && !canStudentInputBlockSetId
                      ? "cursor-not-allowed text-gray-900 opacity-50"
                      : "text-gray-800 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                  title="새 블록 세트 만들기"
                >
                  <Plus className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* 선택된 블록 세트의 시간 블록 정보 표시 (목록 위) - 항상 표시 (읽기 전용) */}
          <div>
          {(() => {
            const selectedSet =
              data.block_set_id && uniqueBlockSets
                ? uniqueBlockSets.find((set) => set.id === data.block_set_id)
                : null;
            const rawBlocks = selectedSet?.blocks ?? [];
            const blocks = rawBlocks.map((block, index) => ({
              ...block,
              block_index: index,
            }));
            const name = selectedSet?.name || "블록 세트를 선택해주세요";

            return <BlockSetTimeline blocks={blocks} name={name} />;
          })()}
        </div>

        {/* 기존 블록 세트 선택 */}
        {blockSetMode === "select" && (
          <div
            className={`flex flex-col gap-2 ${
              !editable || (isCampMode && !canStudentInputBlockSetId)
                ? "opacity-60"
                : ""
            }`}
          >
            {uniqueBlockSets.length > 0 ? (
              <>
                {(() => {
                  const startIndex = (currentPage - 1) * itemsPerPage;
                  const endIndex = startIndex + itemsPerPage;
                  const paginatedBlockSets = uniqueBlockSets.slice(
                    startIndex,
                    endIndex
                  );
                  const totalPages = Math.ceil(uniqueBlockSets.length / itemsPerPage);

                  return (
                    <>
                      {paginatedBlockSets.map((set, index) => {
                        const blockCount = set.blocks?.length ?? 0;
                        const isSelected = data.block_set_id === set.id;
                        return (
                          <div
                            key={`${set.id}-${startIndex + index}`}
                            className={`flex items-center justify-between rounded-lg border px-3 py-2 transition-colors ${
                              isSelected
                                ? "border-gray-900 bg-gray-50"
                                : "border-gray-200 bg-white hover:border-gray-300"
                            }`}
                          >
                            <label
                              className={`flex flex-1 items-center gap-2 ${
                                !editable ||
                                (isCampMode && !canStudentInputBlockSetId)
                                  ? "cursor-not-allowed"
                                  : "cursor-pointer"
                              }`}
                            >
                              <input
                                type="radio"
                                name="block_set"
                                value={set.id}
                                checked={isSelected}
                                onChange={(e) => {
                                  if (
                                    !editable ||
                                    (isCampMode && !canStudentInputBlockSetId)
                                  )
                                    return;
                                  onUpdate({
                                    block_set_id: e.target.value || undefined,
                                  });
                                }}
                                disabled={
                                  !editable ||
                                  (isCampMode && !canStudentInputBlockSetId)
                                }
                                className="h-4 w-4 border-gray-300 text-gray-900 focus:ring-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
                              />
                              <div className="flex-1">
                                <div className="text-sm font-medium text-gray-900">
                                  {set.name}
                                </div>
                                <div className="text-xs text-gray-600">
                                  {blockCount > 0
                                    ? `${blockCount}개 블록`
                                    : "블록 없음"}
                                </div>
                              </div>
                            </label>
                            <button
                              type="button"
                              onClick={(e) => {
                                if (
                                  !editable ||
                                  (isCampMode && !canStudentInputBlockSetId)
                                )
                                  return;
                                e.stopPropagation();
                                setEditingBlockSetId(set.id);
                                setEditingBlockSetName(set.name);
                                setBlockSetMode("edit");
                              }}
                              disabled={
                                !editable ||
                                (isCampMode && !canStudentInputBlockSetId)
                              }
                              className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
                                isCampMode && !canStudentInputBlockSetId
                                  ? "cursor-not-allowed text-gray-900 opacity-50"
                                  : "text-gray-800 hover:bg-gray-100 hover:text-gray-900"
                              }`}
                              title="수정"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}

                      {/* 페이징 컨트롤 */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-2">
                          <button
                            type="button"
                            onClick={() =>
                              setCurrentPage((prev) => Math.max(1, prev - 1))
                            }
                            disabled={currentPage === 1}
                            className="rounded px-3 py-1 text-xs text-gray-800 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            이전
                          </button>
                          <span className="text-xs text-gray-900">
                            {currentPage} / {totalPages}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setCurrentPage((prev) =>
                                Math.min(totalPages, prev + 1)
                              )
                            }
                            disabled={currentPage === totalPages}
                            className="rounded px-3 py-1 text-xs text-gray-800 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            다음
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
            ) : (
              <p className="text-xs text-gray-600">
                등록된 블록 세트가 없습니다. "+" 버튼을 클릭하여 생성하세요.
              </p>
            )}
            {(!editable || (isCampMode && !canStudentInputBlockSetId)) && (
              <p className="text-xs text-gray-600">
                {!editable
                  ? "읽기 전용 모드입니다."
                  : "블록 세트는 템플릿에서 고정되어 수정할 수 없습니다."}
              </p>
            )}
          </div>
        )}

        {/* 블록 세트 생성 폼 */}
        {blockSetMode === "create" &&
          (!isCampMode || canStudentInputBlockSetId) && (
            <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-gray-50 p-6">
              {/* 블록 세트 이름 */}
              <div className="flex flex-col gap-2">
                <label className="block text-sm font-medium text-gray-900">
                  블록 세트 이름
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-600 focus:border-gray-900 focus:outline-none"
                  placeholder="예: 평일 학습 블록"
                  value={newBlockSetName}
                  onChange={(e) => setNewBlockSetName(e.target.value)}
                />
              </div>

              {/* 시간 블록 추가 */}
              <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-6">
                <h3 className="text-sm font-semibold text-gray-900">
                  시간 블록 추가
                </h3>

                <WeekdaySelector
                  selectedWeekdays={selectedWeekdays}
                  onToggle={toggleWeekday}
                  onSelectAll={selectAllWeekdays}
                  onSelectWeekdays={selectWeekdays}
                  onSelectWeekends={selectWeekends}
                />

                {/* 시간 입력 */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="block text-xs font-medium text-gray-900">
                      시작 시간
                    </label>
                    <input
                      type="time"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                      value={blockStartTime}
                      onChange={(e) => setBlockStartTime(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="block text-xs font-medium text-gray-900">
                      종료 시간
                    </label>
                    <input
                      type="time"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                      value={blockEndTime}
                      onChange={(e) => setBlockEndTime(e.target.value)}
                    />
                  </div>
                </div>

                {/* 블록 추가 버튼 */}
                <button
                  type="button"
                  onClick={handleAddBlock}
                  disabled={
                    selectedWeekdays.length === 0 ||
                    !blockStartTime ||
                    !blockEndTime
                  }
                  className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  블록 추가하기
                </button>
              </div>

              {/* 추가된 블록 목록 */}
              {addedBlocks.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-white p-6">
                  <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-semibold text-gray-900">
                      추가된 블록 ({addedBlocks.length}개)
                    </h3>
                    <div className="space-y-2">
                    {addedBlocks.map((block, index) => {
                      const dayNames = [
                        "일",
                        "월",
                        "화",
                        "수",
                        "목",
                        "금",
                        "토",
                      ];
                      return (
                        <div
                          key={index}
                          className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                        >
                          <span className="text-sm text-gray-600">
                            {dayNames[block.day]}요일 {block.startTime} ~{" "}
                            {block.endTime}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveBlock(index)}
                            className="text-xs text-red-600 hover:text-red-800"
                          >
                            삭제
                          </button>
                        </div>
                      );
                    })}
                    </div>
                  </div>
                </div>
              )}

              {/* 생성 버튼 */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setBlockSetMode("select");
                    setNewBlockSetName("");
                    setAddedBlocks([]);
                    setBlockStartTime("");
                    setBlockEndTime("");
                    setSelectedWeekdays([]);
                  }}
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleCreateBlockSet}
                  disabled={isPending || !newBlockSetName.trim()}
                  className="flex-1 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  {isPending ? "생성 중..." : "블록 세트 생성"}
                </button>
              </div>
            </div>
          )}

        {/* 블록 세트 수정 폼 */}
        {blockSetMode === "edit" && editingBlockSetId && (
          <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-gray-50 p-6">
            {/* 블록 세트 이름 수정 */}
            <div className="flex flex-col gap-2">
              <label className="block text-sm font-medium text-gray-900">
                블록 세트 이름
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-600 focus:border-gray-900 focus:outline-none"
                  value={editingBlockSetName}
                  onChange={(e) => setEditingBlockSetName(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleUpdateBlockSetName}
                  disabled={
                    isPending ||
                    !editingBlockSetName.trim() ||
                    editingBlockSetName ===
                      uniqueBlockSets?.find((s) => s.id === editingBlockSetId)?.name
                  }
                  className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  {isPending ? "저장 중..." : "이름 저장"}
                </button>
              </div>
            </div>

            {/* 현재 블록 목록 */}
            {(() => {
              const selectedSet = uniqueBlockSets?.find(
                (set) => set.id === editingBlockSetId
              );
              const blocks = selectedSet?.blocks ?? [];
              const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

              if (blocks.length === 0) {
                return (
                  <div className="rounded-xl border border-gray-200 bg-white p-6">
                    <p className="text-xs text-gray-600">
                      이 블록 세트에는 등록된 시간 블록이 없습니다. 아래에서
                      추가해주세요.
                    </p>
                  </div>
                );
              }

              // 요일별로 그룹화
              const blocksByDay = blocks.reduce((acc, block) => {
                const day = block.day_of_week;
                if (!acc[day]) acc[day] = [];
                acc[day].push(block);
                return acc;
              }, {} as Record<number, typeof blocks>);

              return (
                <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-6">
                  <h3 className="text-sm font-semibold text-gray-900">
                    등록된 시간 블록 ({blocks.length}개)
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(blocksByDay).map(([day, dayBlocks]) => (
                      <div key={day} className="space-y-1">
                        {dayBlocks.map((block) => (
                          <div
                            key={block.id}
                            className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                          >
                            <div className="flex-1">
                              <span className="text-xs font-medium text-gray-900">
                                {dayNames[Number(day)]}요일:
                              </span>{" "}
                              <span className="text-xs text-gray-600">
                                {block.start_time} ~ {block.end_time}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteBlock(block.id)}
                              disabled={isPending}
                              className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                            >
                              삭제
                            </button>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* 시간 블록 추가 */}
            <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="text-sm font-semibold text-gray-900">
                시간 블록 추가
              </h3>
              {/* ... (요일 선택/시간 입력 UI 동일) */}
              <WeekdaySelector
                selectedWeekdays={selectedWeekdays}
                onToggle={toggleWeekday}
                onSelectAll={selectAllWeekdays}
                onSelectWeekdays={selectWeekdays}
                onSelectWeekends={selectWeekends}
              />

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium text-gray-900">
                    시작 시간
                  </label>
                  <input
                    type="time"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                    value={blockStartTime}
                    onChange={(e) => setBlockStartTime(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium text-gray-900">
                    종료 시간
                  </label>
                  <input
                    type="time"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                    value={blockEndTime}
                    onChange={(e) => setBlockEndTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setBlockSetMode("select");
                    setEditingBlockSetId(null);
                    setEditingBlockSetName("");
                    setAddedBlocks([]);
                    setBlockStartTime("");
                    setBlockEndTime("");
                    setSelectedWeekdays([]);
                  }}
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
                >
                  취소(목록으로)
                </button>
                <button
                  type="button"
                  onClick={handleAddBlocksToSet}
                  disabled={
                    selectedWeekdays.length === 0 ||
                    !blockStartTime ||
                    !blockEndTime
                  }
                  className="flex-1 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  블록 추가
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </CollapsibleSection>

      {/* 블록 세트 설명 다이얼로그 */}
      <Dialog
        open={showBlockSetDescDialog}
        onOpenChange={setShowBlockSetDescDialog}
      >
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            블록 세트란?
          </h3>
          <p className="text-sm text-gray-600">
            블록 세트는 학습 가능한 시간대를 미리 정의해둔 템플릿입니다.
            <br />
            학생의 생활 패턴(학교 등교, 학원 시간 등)을 고려하여 학습 가능한
            시간을 설정하면, 해당 시간 내에서 콘텐츠가 자동으로 배정됩니다.
          </p>
          <div className="flex flex-col gap-2 rounded-lg bg-gray-50 p-4">
            <h4 className="text-sm font-medium text-gray-900">
              사용 예시
            </h4>
            <ul className="list-disc space-y-1 pl-4 text-xs text-gray-600">
              <li>
                <strong>학기중 (평일):</strong> 방과 후 17:00 ~ 22:00
              </li>
              <li>
                <strong>학기중 (주말):</strong> 오전 10:00 ~ 22:00
              </li>
              <li>
                <strong>방학중:</strong> 오전 09:00 ~ 22:00
              </li>
            </ul>
          </div>
        </div>
      </Dialog>
    </>
  );
}
