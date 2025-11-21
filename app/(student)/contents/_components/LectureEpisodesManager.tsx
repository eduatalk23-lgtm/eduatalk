"use client";

import { useState, useMemo } from "react";
import { LectureEpisode } from "@/lib/types/plan";

type LectureEpisodesManagerProps = {
  initialEpisodes?: LectureEpisode[];
  onChange?: (episodes: Omit<LectureEpisode, "id" | "created_at">[]) => void;
};

type EpisodeItem = Omit<LectureEpisode, "id" | "created_at"> & { tempId?: string };

export function LectureEpisodesManager({
  initialEpisodes = [],
  onChange,
}: LectureEpisodesManagerProps) {
  const [episodes, setEpisodes] = useState<EpisodeItem[]>(
    initialEpisodes.map((e) => ({
      lecture_id: e.lecture_id,
      episode_number: e.episode_number,
      episode_title: e.episode_title || "",
      duration: e.duration || 0,
      display_order: e.display_order || 0,
      tempId: e.id,
    }))
  );

  const updateEpisodes = (newEpisodes: EpisodeItem[]) => {
    // display_order 재계산
    let order = 0;
    const updated = newEpisodes.map((e) => ({
      ...e,
      display_order: order++,
    }));

    setEpisodes(updated);
    onChange?.(
      updated.map((e) => ({
        lecture_id: e.lecture_id,
        episode_number: e.episode_number,
        episode_title: e.episode_title || null,
        duration: e.duration || null,
        display_order: e.display_order || 0,
      }))
    );
  };

  // Episode 추가
  const addEpisode = () => {
    const maxEpisodeNumber =
      episodes.length > 0
        ? Math.max(...episodes.map((e) => e.episode_number || 0))
        : 0;

    const newEpisode: EpisodeItem = {
      lecture_id: episodes[0]?.lecture_id || "",
      episode_number: maxEpisodeNumber + 1,
      episode_title: "",
      duration: 0,
      display_order: episodes.length,
      tempId: `temp-${Date.now()}`,
    };
    updateEpisodes([...episodes, newEpisode]);
  };

  // Episode 삭제
  const removeEpisode = (tempId: string) => {
    updateEpisodes(episodes.filter((e) => e.tempId !== tempId));
  };

  // Episode 업데이트
  const updateEpisode = (
    tempId: string,
    field: keyof EpisodeItem,
    value: string | number
  ) => {
    const newEpisodes = episodes.map((e) =>
      e.tempId === tempId ? { ...e, [field]: value } : e
    );
    updateEpisodes(newEpisodes);
  };

  // Episode 번호로 정렬
  const sortedEpisodes = useMemo(() => {
    return [...episodes].sort((a, b) => {
      if (a.episode_number !== b.episode_number) {
        return a.episode_number - b.episode_number;
      }
      return a.display_order - b.display_order;
    });
  }, [episodes]);

  return (
    <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900">강의 회차 정보</h4>
        <button
          type="button"
          onClick={addEpisode}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
        >
          + 회차 추가
        </button>
      </div>

      {sortedEpisodes.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-500">
          회차 정보가 없습니다. "+ 회차 추가" 버튼을 클릭하여 추가하세요.
        </p>
      ) : (
        <div className="space-y-3">
          {sortedEpisodes.map((episode, index) => (
            <div
              key={episode.tempId || index}
              className="flex flex-wrap gap-3 rounded-md border border-gray-200 bg-white p-3"
            >
              <div className="w-24">
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  회차
                </label>
                <input
                  type="number"
                  value={episode.episode_number || ""}
                  onChange={(e) =>
                    updateEpisode(
                      episode.tempId!,
                      "episode_number",
                      parseInt(e.target.value) || 0
                    )
                  }
                  min="1"
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex-1 min-w-[200px]">
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  회차 제목
                </label>
                <input
                  type="text"
                  value={episode.episode_title || ""}
                  onChange={(e) =>
                    updateEpisode(episode.tempId!, "episode_title", e.target.value)
                  }
                  placeholder="예: 1강. 함수의 극한"
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="w-24">
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  시간(분)
                </label>
                <input
                  type="number"
                  value={episode.duration || ""}
                  onChange={(e) =>
                    updateEpisode(
                      episode.tempId!,
                      "duration",
                      parseInt(e.target.value) || 0
                    )
                  }
                  min="0"
                  placeholder="분"
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("이 회차를 삭제하시겠습니까?")) {
                      removeEpisode(episode.tempId!);
                    }
                  }}
                  className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hidden input for form submission */}
      <input
        type="hidden"
        name="episodes"
        value={JSON.stringify(
          sortedEpisodes
            .filter((e) => e.episode_number > 0)
            .map((e) => ({
              episode_number: e.episode_number || 0,
              episode_title: e.episode_title || null,
              duration: e.duration || null,
              display_order: e.display_order || 0,
            }))
        )}
      />
    </div>
  );
}

