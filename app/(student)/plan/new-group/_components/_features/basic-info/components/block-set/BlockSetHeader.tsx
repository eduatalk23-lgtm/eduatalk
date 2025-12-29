import { RefreshCw, Plus } from "lucide-react";

type BlockSetHeaderProps = {
  isLoadingBlockSets: boolean;
  onRefresh: () => void;
  showCreateButton: boolean;
  isCreateDisabled: boolean;
  onCreateClick: () => void;
};

export function BlockSetHeader({
  isLoadingBlockSets,
  onRefresh,
  showCreateButton,
  isCreateDisabled,
  onCreateClick,
}: BlockSetHeaderProps) {
  return (
    <div className="flex items-center justify-end">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoadingBlockSets}
          className="flex items-center gap-1 rounded p-1.5 text-xs text-gray-800 hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
          title="목록 새로고침"
        >
          <RefreshCw
            className={`h-4 w-4 ${isLoadingBlockSets ? "animate-spin" : ""}`}
          />
        </button>
        {showCreateButton && (
          <button
            type="button"
            onClick={onCreateClick}
            disabled={isCreateDisabled}
            className={`flex items-center gap-1 rounded p-1.5 text-xs ${
              isCreateDisabled
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
  );
}
