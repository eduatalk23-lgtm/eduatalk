"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import TemplateBlocksViewer from "./TemplateBlocksViewer";

type BlockSet = {
  id: string;
  name: string;
  description?: string | null;
  blocks?: Array<{ id: string; day_of_week: number; start_time: string; end_time: string }>;
};

type TemplateBlockSetManagementProps = {
  templateId: string;
  initialBlockSets?: Array<{ 
    id: string; 
    name: string; 
    description?: string | null;
    blocks?: Array<{ id: string; day_of_week: number; start_time: string; end_time: string }> 
  }>;
  selectedBlockSetId?: string | null;
};

export default function TemplateBlockSetManagement({
  templateId,
  initialBlockSets = [],
  selectedBlockSetId = null,
}: TemplateBlockSetManagementProps) {
  const router = useRouter();
  const [blockSets, setBlockSets] = useState<BlockSet[]>(initialBlockSets.map(set => ({
    id: set.id,
    name: set.name,
    description: set.description ?? null,
    blocks: set.blocks ?? [],
  })));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 특정 세트의 블록만 업데이트
  const updateSetBlocks = useCallback(async (setId: string) => {
    try {
      const { getTemplateBlockSets } = await import("@/app/(admin)/actions/templateBlockSets");
      const data = await getTemplateBlockSets(templateId);
      
      const updatedSet = data.find(s => s.id === setId);
      if (updatedSet) {
        setBlockSets((prevSets) =>
          prevSets.map((set) =>
            set.id === setId
              ? { ...set, blocks: updatedSet.blocks ?? [] }
              : set
          )
        );
      }
    } catch (error) {
      console.error(`세트 ${setId}의 블록 조회 실패:`, error);
    }
  }, [templateId]);

  // 전체 데이터 로드
  const loadData = useCallback(async (skipLoadingState = false) => {
    try {
      if (!skipLoadingState) {
        setIsLoading(true);
        setError(null);
      }

      const { getTemplateBlockSets } = await import("@/app/(admin)/actions/templateBlockSets");
      const data = await getTemplateBlockSets(templateId);

      const updatedSets = (data || []).map(set => ({
        id: set.id,
        name: set.name,
        description: null,
        blocks: set.blocks ?? [],
      }));

      setBlockSets(updatedSets);
      setError(null);
    } catch (error: any) {
      console.error("블록 데이터 로드 실패:", error);
      const errorMessage = error?.message || "블록 데이터를 불러오는 중 오류가 발생했습니다.";
      setError(errorMessage);
    } finally {
      if (!skipLoadingState) {
        setIsLoading(false);
      }
    }
  }, [templateId]);

  // 초기 마운트 시 서버 데이터 사용
  useEffect(() => {
    if (initialBlockSets.length === 0) {
      loadData(true);
    }
  }, [loadData, initialBlockSets.length]);

  return (
    <div>
      {/* 에러 메시지 */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <span className="text-2xl">⚠️</span>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-800 mb-1">
                데이터 로드 실패
              </h3>
              <p className="text-sm text-red-700 mb-3">{error}</p>
              <button
                type="button"
                onClick={() => loadData()}
                className="text-sm text-red-700 hover:text-red-900 underline font-medium"
              >
                다시 시도
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 블록 뷰어 */}
      <TemplateBlocksViewer 
        templateId={templateId}
        blocks={[]} 
        blockSets={blockSets} 
        selectedBlockSetId={selectedBlockSetId}
        isLoading={isLoading}
        onCreateSetSuccess={async () => {
          router.refresh();
        }}
        onBlockChange={updateSetBlocks}
        existingSetCount={blockSets.length}
      />
    </div>
  );
}

