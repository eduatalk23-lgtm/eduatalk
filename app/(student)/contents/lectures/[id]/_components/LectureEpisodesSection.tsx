"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LectureEpisodesDisplay } from "@/app/(student)/contents/_components/LectureEpisodesDisplay";
import { LectureEpisodesManager } from "@/app/(student)/contents/_components/LectureEpisodesManager";
import { saveLectureEpisodesAction } from "@/app/(student)/actions/contentDetailsActions";
import { LectureEpisode } from "@/lib/types/plan";

type LectureEpisodesSectionProps = {
  lectureId: string;
  initialEpisodes: LectureEpisode[];
  isFromMaster: boolean;
};

export function LectureEpisodesSection({
  lectureId,
  initialEpisodes,
  isFromMaster,
}: LectureEpisodesSectionProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [episodes, setEpisodes] = useState(initialEpisodes);
  const [isSaving, setIsSaving] = useState(false);
  const [currentEpisodes, setCurrentEpisodes] = useState<Omit<LectureEpisode, "id" | "created_at">[]>(
    initialEpisodes.map((e) => ({
      lecture_id: e.lecture_id,
      episode_number: e.episode_number,
      episode_title: e.episode_title,
      duration: e.duration,
      display_order: e.display_order,
    }))
  );

  const handleSave = async (newEpisodes: Omit<LectureEpisode, "id" | "created_at">[]) => {
    setIsSaving(true);
    try {
      const result = await saveLectureEpisodesAction(lectureId, newEpisodes);
      if (result.success) {
        // 저장된 회차 정보로 업데이트
        const updatedEpisodes: LectureEpisode[] = newEpisodes.map((e, index) => ({
          id: `temp-${index}`,
          lecture_id: lectureId,
          episode_number: e.episode_number || 0,
          episode_title: e.episode_title,
          duration: e.duration,
          display_order: e.display_order || 0,
          created_at: "",
        }));
        setEpisodes(updatedEpisodes);
        setIsEditing(false);
        router.refresh();
      }
    } catch (error) {
      console.error("회차 정보 저장 실패:", error);
      alert(error instanceof Error ? error.message : "회차 정보 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing && !isFromMaster) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">강의 회차 정보 관리</h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              취소
            </button>
          </div>
        </div>
        <LectureEpisodesManager
          initialEpisodes={episodes}
          onChange={(newEpisodes) => {
            setCurrentEpisodes(newEpisodes);
          }}
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={async () => {
              await handleSave(currentEpisodes);
            }}
            disabled={isSaving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSaving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">강의 회차 정보</h3>
        {!isFromMaster && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            {episodes.length > 0 ? "수정" : "회차 추가"}
          </button>
        )}
        {isFromMaster && (
          <div className="inline-flex items-center gap-2 rounded-md bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700">
            <span>📦</span>
            <span>마스터에서 가져온 강의는 회차 정보 수정이 불가능합니다</span>
          </div>
        )}
      </div>
      {episodes.length > 0 ? (
        <LectureEpisodesDisplay episodes={episodes} />
      ) : (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <p className="text-sm text-gray-500">
            회차 정보가 없습니다. "회차 추가" 버튼을 클릭하여 추가하세요.
          </p>
        </div>
      )}
    </div>
  );
}

