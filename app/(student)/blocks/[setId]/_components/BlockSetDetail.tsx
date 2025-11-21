"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BlockStatistics from "../../_components/BlockStatistics";
import BlockTimeline from "../../_components/BlockTimeline";
import InvalidBlockWarning from "../../_components/InvalidBlockWarning";
import BlockList from "./BlockList";
import BlockForm from "../../_components/BlockForm";

type BlockSet = {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
};

type Block = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type BlockSetDetailProps = {
  blockSet: BlockSet;
  blocks: Block[];
  isActive: boolean;
};

type DetailTab = "list" | "statistics" | "timeline";

export default function BlockSetDetail({
  blockSet,
  blocks,
  isActive,
}: BlockSetDetailProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<DetailTab>("list");
  const [showBlockForm, setShowBlockForm] = useState(false);

  const handleBack = () => {
    router.push("/blocks");
  };

  const handleAddBlock = () => {
    setShowBlockForm(true);
  };

  return (
    <>
      {/* 뒤로가기 버튼 및 헤더 */}
      <div className="mb-6">
        <button
          type="button"
          onClick={handleBack}
          className="mb-4 text-sm text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-2"
        >
          <span>←</span>
          <span>목록으로 돌아가기</span>
        </button>
        
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">
              {blockSet.name}
            </h1>
            {blockSet.description && (
              <p className="text-sm text-gray-600 mb-2">{blockSet.description}</p>
            )}
            {isActive && (
              <span className="inline-block px-3 py-1 text-sm font-medium text-indigo-700 bg-indigo-100 rounded">
                활성 세트
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 잘못된 블록 경고 */}
      {blocks.length > 0 && (
        <div className="mb-6">
          <InvalidBlockWarning blocks={blocks} />
        </div>
      )}

      {/* 새 블록 추가 폼 (모달) */}
      {showBlockForm && (
        <BlockForm 
          onClose={() => {
            setShowBlockForm(false);
            router.refresh();
          }}
          blockSetId={blockSet.id}
        />
      )}

      {/* 탭 메뉴 */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex gap-4">
          <button
            type="button"
            onClick={() => setActiveTab("list")}
            className={`border-b-2 px-1 pb-4 text-sm font-medium transition-colors ${
              activeTab === "list"
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            시간 블록 목록
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("statistics")}
            className={`border-b-2 px-1 pb-4 text-sm font-medium transition-colors ${
              activeTab === "statistics"
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            통계 및 인사이트
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("timeline")}
            className={`border-b-2 px-1 pb-4 text-sm font-medium transition-colors ${
              activeTab === "timeline"
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            주간 타임테이블
          </button>
        </nav>
      </div>

      {/* 탭 내용 */}
      <div>
        {activeTab === "list" && (
          <BlockList 
            blocks={blocks} 
            blockSetId={blockSet.id}
            onAddBlock={handleAddBlock}
          />
        )}
        {activeTab === "statistics" && (
          <div className="mb-8">
            <BlockStatistics blocks={blocks} />
          </div>
        )}
        {activeTab === "timeline" && (
          <div className="mb-8">
            <div className="bg-white border border-gray-200 rounded-lg p-4 md:p-6 overflow-x-auto">
              <BlockTimeline blocks={blocks} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

