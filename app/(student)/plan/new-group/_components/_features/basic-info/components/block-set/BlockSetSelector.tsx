import { useMemo } from "react";
import { Pencil } from "lucide-react";

type BlockSet = {
  id: string;
  name: string;
  blocks?: Array<{
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
  }>;
};

type BlockSetSelectorProps = {
  blockSets: BlockSet[];
  selectedBlockSetId?: string;
  onSelect: (id: string | undefined) => void;
  onEdit: (id: string, name: string) => void;
  editable: boolean;
  isCampMode: boolean;
  canStudentInputBlockSetId: boolean;
  currentPage: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
};

export function BlockSetSelector({
  blockSets,
  selectedBlockSetId,
  onSelect,
  onEdit,
  editable,
  isCampMode,
  canStudentInputBlockSetId,
  currentPage,
  itemsPerPage,
  onPageChange,
}: BlockSetSelectorProps) {
  // 중복된 ID를 가진 블록 세트 제거
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

  const isDisabled = !editable || (isCampMode && !canStudentInputBlockSetId);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedBlockSets = uniqueBlockSets.slice(startIndex, endIndex);
  const totalPages = Math.ceil(uniqueBlockSets.length / itemsPerPage);

  if (uniqueBlockSets.length === 0) {
    return (
      <p className="text-xs text-gray-600">
        등록된 블록 세트가 없습니다. &quot;+&quot; 버튼을 클릭하여 생성하세요.
      </p>
    );
  }

  return (
    <div
      className={`flex flex-col gap-2 ${isDisabled ? "opacity-60" : ""}`}
    >
      {paginatedBlockSets.map((set, index) => {
        const blockCount = set.blocks?.length ?? 0;
        const isSelected = selectedBlockSetId === set.id;

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
                isDisabled ? "cursor-not-allowed" : "cursor-pointer"
              }`}
            >
              <input
                type="radio"
                name="block_set"
                value={set.id}
                checked={isSelected}
                onChange={(e) => {
                  if (isDisabled) return;
                  const blockSetId = e.target.value?.trim() || undefined;
                  onSelect(blockSetId);
                }}
                disabled={isDisabled}
                className="h-4 w-4 border-gray-300 text-gray-900 focus:ring-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">
                  {set.name}
                </div>
                <div className="text-xs text-gray-600">
                  {blockCount > 0 ? `${blockCount}개 블록` : "블록 없음"}
                </div>
              </div>
            </label>
            <button
              type="button"
              onClick={(e) => {
                if (isDisabled) return;
                e.stopPropagation();
                onEdit(set.id, set.name);
              }}
              disabled={isDisabled}
              className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
                isDisabled
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
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
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
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="rounded px-3 py-1 text-xs text-gray-800 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            다음
          </button>
        </div>
      )}

      {isDisabled && (
        <p className="text-xs text-gray-600">
          {!editable
            ? "읽기 전용 모드입니다."
            : "블록 세트는 템플릿에서 고정되어 수정할 수 없습니다."}
        </p>
      )}
    </div>
  );
}
