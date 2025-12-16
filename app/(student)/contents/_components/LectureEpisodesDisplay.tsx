"use client";

import { useMemo } from "react";
import { Video } from "lucide-react";
import { LectureEpisode } from "@/lib/types/plan";
import { secondsToMinutes } from "@/lib/utils/duration";
import { cn } from "@/lib/cn";

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
    <div className="flex flex-col gap-4 border-t pt-8">
      <div className="flex items-center gap-2">
        <Video className="h-5 w-5 text-gray-400" aria-hidden="true" />
        <h3 className="text-lg font-semibold text-gray-900">강의 회차 정보</h3>
      </div>

      {/* 모바일: 카드 형식 */}
      <div className="flex flex-col gap-3 md:hidden">
        {sortedEpisodes.map((episode) => (
          <div
            key={episode.id}
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-gray-900">
                    {episode.episode_number}회
                  </span>
                </div>
                <p className="text-sm text-gray-600 line-clamp-2">
                  {episode.episode_title || "—"}
                </p>
              </div>
              <div className="flex-shrink-0">
                <span className="text-sm text-gray-500">
                  {episode.duration ? `${secondsToMinutes(episode.duration)}분` : "—"}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 데스크톱: 테이블 형식 */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-4 py-3 text-left font-semibold text-gray-700">회차</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">제목</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">시간</th>
            </tr>
          </thead>
          <tbody>
            {sortedEpisodes.map((episode) => (
              <tr
                key={episode.id}
                className="border-b transition-colors hover:bg-gray-50"
              >
                <td className="px-4 py-3 text-gray-900 font-medium">
                  {episode.episode_number}회
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {episode.episode_title || "—"}
                </td>
                <td className="px-4 py-3 text-gray-600">
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

