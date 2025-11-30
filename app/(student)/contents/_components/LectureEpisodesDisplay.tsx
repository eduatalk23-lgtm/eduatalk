"use client";

import { useState, useMemo } from "react";
import { LectureEpisode } from "@/lib/types/plan";
import { secondsToMinutes } from "@/lib/utils/duration";

type LectureEpisodesDisplayProps = {
  episodes: LectureEpisode[];
};

export function LectureEpisodesDisplay({ episodes }: LectureEpisodesDisplayProps) {
  // episode 번호로 정렬
  const sortedEpisodes = useMemo(() => {
    return [...episodes].sort((a, b) => {
      if (a.episode_number !== b.episode_number) {
        return a.episode_number - b.episode_number;
      }
      return a.display_order - b.display_order;
    });
  }, [episodes]);

  if (sortedEpisodes.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 border-t pt-8">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">강의 회차 정보</h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-4 py-2 text-left font-semibold text-gray-700">회차</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-700">제목</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-700">시간</th>
            </tr>
          </thead>
          <tbody>
            {sortedEpisodes.map((episode) => (
              <tr
                key={episode.id}
                className="border-b transition hover:bg-gray-50"
              >
                <td className="px-4 py-2 text-gray-900">
                  {episode.episode_number}회
                </td>
                <td className="px-4 py-2 text-gray-600">
                  {episode.episode_title || "—"}
                </td>
                <td className="px-4 py-2 text-gray-600">
                  {episode.duration ? `${secondsToMinutes(episode.duration)}분` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

