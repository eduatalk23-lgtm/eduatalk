import Link from "next/link";
import { useRouter } from "next/navigation";
import { ContentDetailData, ContentMetadata } from "../types";
import { ContentItem } from "./ContentItem";

type Item = {
  id: string;
  title: string;
  subtitle?: string | null;
  master_content_id?: string | null;
};

type ContentListProps = {
  title: string;
  contentType: "book" | "lecture";
  items: Item[];
  emptyMessage: string;
  onSaveDraft?: () => Promise<void> | void;
  // State from hooks
  selectedContentIds: Set<string>;
  contentRanges: Map<string, { start: string; end: string }>;
  startDetailId: Map<string, string>;
  endDetailId: Map<string, string>;
  contentDetails: Map<string, ContentDetailData>;
  loadingDetails: Set<string>;
  contentMetadata: Map<string, ContentMetadata>;
  // Handlers
  onToggleSelection: (contentId: string, type: "book" | "lecture") => void;
  onSetStartDetail: (map: Map<string, string>) => void;
  onSetEndDetail: (map: Map<string, string>) => void;
  onUpdateRange: (contentId: string, field: "start" | "end", value: string) => void;
  editable: boolean;
};

export function ContentList({
  title,
  contentType,
  items,
  emptyMessage,
  onSaveDraft,
  selectedContentIds,
  contentRanges,
  startDetailId,
  endDetailId,
  contentDetails,
  loadingDetails,
  contentMetadata,
  onToggleSelection,
  onSetStartDetail,
  onSetEndDetail,
  onUpdateRange,
  editable,
}: ContentListProps) {
  const router = useRouter();

  const handleLinkClick = async (e: React.MouseEvent) => {
    if (onSaveDraft) {
      e.preventDefault();
      await onSaveDraft();
      router.push("/contents");
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <p className="mt-1 text-xs text-gray-600">
          {contentType === "book" ? "학습 중인 교재를" : "학습 중인 강의를"}{" "}
          추가하고 싶다면{" "}
          <Link
            href="/contents"
            className="font-medium text-indigo-600 hover:text-indigo-800 underline"
            onClick={handleLinkClick}
          >
            콘텐츠 메뉴
          </Link>
          에서 추가해주세요.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
          <p className="text-sm text-gray-600">{emptyMessage}</p>
          <p className="mt-2 text-xs text-gray-600">
            {contentType === "book" ? "학습 중인 교재를" : "학습 중인 강의를"}{" "}
            추가하고 싶다면{" "}
            <Link
              href="/contents"
              className="font-medium text-indigo-600 hover:text-indigo-800 underline"
              onClick={handleLinkClick}
            >
              콘텐츠 메뉴
            </Link>
            에서 추가해주세요.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const isSelected = selectedContentIds.has(item.id);
            const contentInfo = contentDetails.get(item.id);
            const range = contentRanges.get(item.id);
            const isLoading = loadingDetails.has(item.id);
            const selectedStartId = startDetailId.get(item.id);
            const selectedEndId = endDetailId.get(item.id);
            const metadata = contentMetadata.get(item.id);

            return (
              <ContentItem
                key={item.id}
                item={item}
                contentType={contentType}
                isSelected={isSelected}
                onToggle={() => onToggleSelection(item.id, contentType)}
                metadata={metadata}
                contentInfo={contentInfo}
                isLoading={isLoading}
                range={range}
                startDetailId={selectedStartId}
                endDetailId={selectedEndId}
                onSetStartDetail={(id) => {
                   const newMap = new Map(startDetailId);
                   newMap.set(item.id, id);
                   onSetStartDetail(newMap);
                }}
                onSetEndDetail={(id) => {
                   const newMap = new Map(endDetailId);
                   newMap.set(item.id, id);
                   onSetEndDetail(newMap);
                }}
                onUpdateRange={(field, value) => onUpdateRange(item.id, field, value)}
                editable={editable}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
