"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import TemplateBlocksViewer from "./TemplateBlocksViewer";
import type { BlockSet, Block } from "@/lib/types/time-management";
import { normalizeBlocks } from "@/lib/types/time-management";

type TemplateBlockSetManagementProps = {
  templateId: string;
  initialBlockSets?: BlockSet[];
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
      const { getTenantBlockSets } = await import("@/app/(admin)/actions/tenantBlockSets");
      const data = await getTenantBlockSets();
      
      const updatedSet = data.find(s => s.id === setId);
      if (updatedSet) {
        setBlockSets((prevSets) =>
          prevSets.map((set) =>
            set.id === setId
              ? { ...set, blocks: updatedSet.blocks ? normalizeBlocks(updatedSet.blocks) : [] }
              : set
          )
        );
      }
    } catch (error) {
      console.error(`세트 ${setId}의 블록 조회 실패:`, error);
    }
  }, []);

  // 전체 데이터 로드
  const loadData = useCallback(async (skipLoadingState = false) => {
    try {
      if (!skipLoadingState) {
        setIsLoading(true);
        setError(null);
      }

      const { getTenantBlockSets } = await import("@/app/(admin)/actions/tenantBlockSets");
      const { getTemplateBlockSet } = await import("@/app/(admin)/actions/campTemplateBlockSets");
      
      // 모든 테넌트 블록 세트 조회
      const data = await getTenantBlockSets();
      
      // 템플릿에 연결된 블록 세트 조회
      const linkedBlockSet = await getTemplateBlockSet(templateId);
      let allBlockSets = data;
      
      if (linkedBlockSet) {
        // 연결된 블록 세트가 목록에 없으면 추가
        const hasBlockSet = data.some(set => set.id === linkedBlockSet.id);
        if (!hasBlockSet) {
          allBlockSets = [linkedBlockSet, ...data];
        }
      }

      const updatedSets = (allBlockSets || []).map(set => ({
        id: set.id,
        name: set.name,
        description: null,
        blocks: set.blocks ? normalizeBlocks(set.blocks) : [],
      }));

      setBlockSets(updatedSets);
      setError(null);
    } catch (error: unknown) {
      console.error("블록 데이터 로드 실패:", error);
      const errorMessage = error instanceof Error ? error.message : "블록 데이터를 불러오는 중 오류가 발생했습니다.";
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
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <span className="text-2xl">⚠️</span>
            </div>
            <div className="flex flex-col gap-3 flex-1">
              <h3 className="text-sm font-semibold text-red-800">
                데이터 로드 실패
              </h3>
              <p className="text-sm text-red-700">{error}</p>
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

