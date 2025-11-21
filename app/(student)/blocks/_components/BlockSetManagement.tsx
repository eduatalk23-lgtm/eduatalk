"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import BlocksViewer from "./BlocksViewer";

type Block = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  block_set_id: string | null;
  block_index?: number | null;
};

type BlockSet = {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
  blocks?: Array<{ id: string; day_of_week: number; start_time: string; end_time: string }>;
};

type BlockSetManagementProps = {
  studentId: string;
  initialBlockSets?: Array<{ 
    id: string; 
    name: string; 
    description?: string | null;
    display_order?: number;
    blocks?: Array<{ id: string; day_of_week: number; start_time: string; end_time: string }> 
  }>;
  initialActiveSetId?: string | null;
  initialBlocks?: Array<{ id: string; day_of_week: number; start_time: string; end_time: string; block_set_id: string | null }>;
};

export default function BlockSetManagement({
  studentId,
  initialBlockSets = [],
  initialActiveSetId = null,
  initialBlocks = [],
}: BlockSetManagementProps) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [blockSets, setBlockSets] = useState<BlockSet[]>(initialBlockSets.map(set => ({
    id: set.id,
    name: set.name,
    description: 'description' in set ? set.description : null,
    display_order: 'display_order' in set ? set.display_order : 0,
    blocks: set.blocks,
  })));
  const [activeSetId, setActiveSetId] = useState<string | null>(initialActiveSetId);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 특정 세트의 블록만 업데이트 (다른 세트는 영향 없음)
  const updateSetBlocks = useCallback(async (setId: string) => {
    try {
      const { data: blocks, error } = await supabase
        .from("student_block_schedule")
        .select("id, day_of_week, start_time, end_time")
        .eq("block_set_id", setId)
        .eq("student_id", studentId)
        .order("day_of_week")
        .order("start_time");

      if (error) {
        console.error(`세트 ${setId}의 블록 조회 실패:`, error);
        return;
      }

      const setBlocks = (blocks as Array<{ id: string; day_of_week: number; start_time: string; end_time: string }>) ?? [];

      // 해당 세트만 업데이트 (다른 세트는 그대로 유지)
      setBlockSets((prevSets) =>
        prevSets.map((set) =>
          set.id === setId
            ? { ...set, blocks: setBlocks }
            : set // 다른 세트는 변경하지 않음
        )
      );
    } catch (error) {
      console.error(`세트 ${setId}의 블록 업데이트 실패:`, error);
    }
  }, [studentId]);

  // 전체 데이터 로드 (세트 추가/삭제 시에만 사용)
  const loadData = useCallback(async (targetSetId?: string | null, skipLoadingState = false) => {
    try {
      if (!skipLoadingState) {
        setIsLoading(true);
        setError(null);
      }

      // targetSetId가 제공되면 즉시 사용 (서버 조회 생략하여 성능 향상)
      const currentActiveSetId = targetSetId !== undefined ? targetSetId : null;

      // 활성 세트의 블록과 블록 세트 목록, 모든 블록을 병렬로 조회 (성능 최적화)
      const [blocksResult, setsResult, allBlocksResult] = await Promise.all([
        // 활성 세트의 블록만 조회
        (() => {
          const query = supabase
            .from("student_block_schedule")
            .select("id, day_of_week, start_time, end_time, block_set_id")
            .eq("student_id", studentId)
            .order("day_of_week")
            .order("start_time");
          
          if (currentActiveSetId) {
            query.eq("block_set_id", currentActiveSetId);
          }
          
          return query;
        })(),
        // 블록 세트 목록 조회
        supabase
          .from("student_block_sets")
          .select("*")
          .eq("student_id", studentId)
          .order("display_order")
          .order("created_at"),
        // 모든 블록 조회 (세트별 그룹화용)
        supabase
          .from("student_block_schedule")
          .select("id, day_of_week, start_time, end_time, block_set_id")
          .eq("student_id", studentId)
          .order("day_of_week")
          .order("start_time"),
      ]);

      const { data: blocksData, error: blocksError } = blocksResult;
      const { data: sets, error: setsError } = setsResult;
      const { data: allBlocks, error: allBlocksError } = allBlocksResult;
      
      if (blocksError) {
        throw new Error(`블록 조회 실패: ${blocksError.message}`);
      }

      if (setsError) {
        throw new Error(`블록 세트 조회 실패: ${setsError.message}`);
      }

      if (allBlocksError) {
        console.warn("전체 블록 조회 실패:", allBlocksError);
      }

      // 블록 데이터를 먼저 업데이트하여 깜빡임 방지
      const newBlocks = (blocksData as Block[]) ?? [];
      
      // 상태 업데이트를 즉시 수행
      setActiveSetId(currentActiveSetId);
      setBlocks(newBlocks);

      // 블록 세트 목록에 블록 정보 추가 (클라이언트에서 그룹화)
      const updatedSets = (sets as BlockSet[]) ?? [];
      const allBlocksArray = (allBlocks as Array<{ id: string; day_of_week: number; start_time: string; end_time: string; block_set_id: string | null }>) ?? [];

      // 기존 세트의 블록 정보를 유지하면서 업데이트
      setBlockSets((prevSets) => {
        const setsWithBlocks = updatedSets.map((set) => {
          // 기존 세트 정보 확인
          const existingSet = prevSets.find(s => s.id === set.id);
          
          // 해당 세트의 블록 조회
          const setBlocks = allBlocksArray
            .filter((block) => block.block_set_id === set.id)
            .map(({ id, day_of_week, start_time, end_time }) => ({
              id,
              day_of_week,
              start_time,
              end_time,
            }));

          // 기존 세트가 있고 블록이 있으면 기존 블록 유지, 없으면 새로 조회한 블록 사용
          return {
            ...set,
            blocks: existingSet?.blocks && existingSet.blocks.length > 0 && setBlocks.length === 0
              ? existingSet.blocks // 기존 블록 유지 (새로 조회한 결과가 비어있을 때만)
              : setBlocks, // 새로 조회한 블록 사용
          };
        });

        return setsWithBlocks;
      });
      
      // 성공 시 에러 상태 초기화
      setError(null);
    } catch (error: any) {
      console.error("블록 데이터 로드 실패:", error);
      
      // 네트워크 에러 구분
      const isNetworkError = 
        error?.message?.includes("Failed to fetch") ||
        error?.message?.includes("NetworkError") ||
        error?.message?.includes("network") ||
        error?.code === "ECONNABORTED" ||
        error?.code === "ETIMEDOUT";
      
      const errorMessage = isNetworkError
        ? "네트워크 연결을 확인해주세요. 잠시 후 다시 시도해주세요."
        : error?.message || "블록 데이터를 불러오는 중 오류가 발생했습니다.";
      
      setError(errorMessage);
    } finally {
      if (!skipLoadingState) {
        setIsLoading(false);
      }
    }
  }, [studentId]);

  // 초기 마운트 시에는 서버에서 받은 데이터를 사용하므로 추가 조회 불필요
  // 단, 서버 데이터와 클라이언트 데이터 동기화를 위해 한 번만 확인
  useEffect(() => {
    // 서버에서 받은 initialBlocks가 있으면 추가 조회하지 않음
    // 없거나 데이터가 비어있을 때만 조회
    if (initialBlocks.length === 0 && initialBlockSets.length === 0) {
      loadData(undefined, true);
    }
  }, [loadData, initialBlocks.length, initialBlockSets.length]);

  // initialActiveSetId가 변경되면 상태 업데이트 (탭 전환 후 복귀 시)
  useEffect(() => {
    if (initialActiveSetId !== activeSetId) {
      setActiveSetId(initialActiveSetId);
      loadData(initialActiveSetId, true); // 탭 전환 시에도 로딩 상태 표시하지 않음
    }
  }, [initialActiveSetId, activeSetId, loadData]);

  // initialBlockSets의 세트 ID 목록만 추적 (세트 추가/삭제 감지용)
  const initialSetIds = useMemo(() => {
    return initialBlockSets.map(s => s.id).sort().join(',');
  }, [initialBlockSets]);

  const currentSetIds = useMemo(() => {
    return blockSets.map(s => s.id).sort().join(',');
  }, [blockSets]);

  // 세트 추가/삭제 시 처리 (전체 리로드 없이 필요한 세트만 업데이트)
  useEffect(() => {
    if (initialSetIds !== currentSetIds) {
      const initialIdsArray = initialSetIds.split(',').filter(Boolean);
      const currentIdsArray = currentSetIds.split(',').filter(Boolean);
      
      // 새로 추가된 세트 ID 찾기
      const newSetIds = initialIdsArray.filter(id => !currentIdsArray.includes(id));
      
      // 삭제된 세트 ID 찾기
      const deletedSetIds = currentIdsArray.filter(id => !initialIdsArray.includes(id));
      
      // 삭제된 세트가 있으면 상태에서 제거
      if (deletedSetIds.length > 0) {
        setBlockSets((prevSets) => prevSets.filter(set => !deletedSetIds.includes(set.id)));
      }
      
      // 새로 추가된 세트가 있으면 해당 세트만 업데이트 (기존 세트는 그대로 유지)
      if (newSetIds.length > 0) {
        // 새로 추가된 세트들의 블록만 조회
        Promise.all(newSetIds.map(setId => updateSetBlocks(setId))).then(() => {
          // 세트 목록은 서버에서 받은 initialBlockSets로 업데이트
          const newSets = initialBlockSets
            .filter(set => newSetIds.includes(set.id))
            .map(set => ({
              id: set.id,
              name: set.name,
              description: 'description' in set ? set.description : null,
              display_order: 'display_order' in set ? set.display_order : 0,
              blocks: set.blocks ?? [],
            }));
          
          setBlockSets((prevSets) => {
            // 기존 세트는 유지하고 새 세트만 추가
            const existingSetIds = prevSets.map(s => s.id);
            const setsToAdd = newSets.filter(s => !existingSetIds.includes(s.id));
            return [...prevSets, ...setsToAdd].sort((a, b) => 
              (a.display_order ?? 0) - (b.display_order ?? 0)
            );
          });
        });
      }
    }
  }, [initialSetIds, currentSetIds, initialBlockSets, updateSetBlocks]);

  const handleSetChange = async (setId: string | null) => {
    // 블록 세트 변경 시 즉시 activeSetId와 blocks 초기화
    // 이렇게 하면 이전 세트의 블록이 깜빡이지 않음
    setActiveSetId(setId);
    setBlocks([]); // 빈 배열로 초기화하여 통계가 사라지도록
    
    // loadData 호출 (로딩 상태 표시)
    await loadData(setId, false);
  };

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
                onClick={() => loadData(activeSetId)}
                className="text-sm text-red-700 hover:text-red-900 underline font-medium"
              >
                다시 시도
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 블록 뷰어 - 목록 형태로 표시 */}
      <BlocksViewer 
        key={`viewer-${activeSetId || 'none'}-${blockSets.length}`}
        blocks={blocks} 
        blockSets={blockSets} 
        activeSetId={activeSetId}
        isLoading={isLoading}
        onCreateSetSuccess={async () => {
          // 세트 추가는 useEffect에서 처리되므로 여기서는 아무것도 하지 않음
          // router.refresh()가 호출되면 initialBlockSets가 업데이트되고
          // useEffect가 이를 감지하여 필요한 세트만 업데이트함
        }}
        onBlockChange={updateSetBlocks}
        existingSetCount={blockSets.length}
      />
    </div>
  );
}

