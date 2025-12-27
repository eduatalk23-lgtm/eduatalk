"use client";

import { useState } from "react";
import { X, ArrowRightLeft, FileText, Shuffle } from "lucide-react";
import type { RedistributeVolumeOptions } from "@/lib/domains/plan/actions/contentSchedule";

type RedistributeOptionsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options: {
    redistribute: boolean;
    redistributeOptions?: RedistributeVolumeOptions;
  }) => void;
  contentTitle: string;
  remainingVolume: number;
  rangeUnit: string;
  isLoading?: boolean;
};

export function RedistributeOptionsModal({
  isOpen,
  onClose,
  onConfirm,
  contentTitle,
  remainingVolume,
  rangeUnit,
  isLoading = false,
}: RedistributeOptionsModalProps) {
  const [selectedOption, setSelectedOption] = useState<
    "discard" | "same_subject" | "all_contents" | "to_adhoc"
  >("discard");

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (selectedOption === "discard") {
      onConfirm({ redistribute: false });
    } else {
      onConfirm({
        redistribute: true,
        redistributeOptions: {
          strategy: selectedOption,
          onlyRemaining: true,
        },
      });
    }
  };

  const options = [
    {
      id: "discard" as const,
      title: "분량 삭제",
      description: "미완료 분량을 그냥 삭제합니다.",
      icon: X,
      iconColor: "text-gray-500",
      bgColor: "bg-gray-50",
      borderColor: "border-gray-200",
    },
    {
      id: "all_contents" as const,
      title: "다른 콘텐츠에 분배",
      description: "플래너 내 다른 모든 콘텐츠에 균등 분배합니다.",
      icon: Shuffle,
      iconColor: "text-blue-500",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
    },
    {
      id: "same_subject" as const,
      title: "같은 과목에 분배",
      description: "같은 과목의 다른 콘텐츠에만 분배합니다.",
      icon: ArrowRightLeft,
      iconColor: "text-green-500",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
    },
    {
      id: "to_adhoc" as const,
      title: "일회성 플랜으로 변환",
      description: "미완료 분량을 별도의 일회성 플랜으로 생성합니다.",
      icon: FileText,
      iconColor: "text-purple-500",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-200",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              콘텐츠 삭제
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              &quot;{contentTitle}&quot;을(를) 삭제합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Remaining volume info */}
        {remainingVolume > 0 && (
          <div className="mt-4 rounded-lg bg-amber-50 p-3">
            <p className="text-sm text-amber-800">
              <span className="font-medium">미완료 분량:</span>{" "}
              {remainingVolume}
              {rangeUnit}
            </p>
            <p className="mt-1 text-xs text-amber-600">
              삭제 시 미완료 분량을 어떻게 처리할지 선택해주세요.
            </p>
          </div>
        )}

        {/* Options */}
        <div className="mt-4 space-y-2">
          {options.map((option) => {
            const Icon = option.icon;
            const isSelected = selectedOption === option.id;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelectedOption(option.id)}
                disabled={
                  remainingVolume === 0 && option.id !== "discard"
                }
                className={`flex w-full items-start gap-3 rounded-lg border-2 p-3 text-left transition-all ${
                  isSelected
                    ? `${option.borderColor} ${option.bgColor}`
                    : "border-gray-100 hover:border-gray-200"
                } ${
                  remainingVolume === 0 && option.id !== "discard"
                    ? "cursor-not-allowed opacity-50"
                    : ""
                }`}
              >
                <div
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                    isSelected ? option.bgColor : "bg-gray-100"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 ${
                      isSelected ? option.iconColor : "text-gray-400"
                    }`}
                  />
                </div>
                <div>
                  <p
                    className={`text-sm font-medium ${
                      isSelected ? "text-gray-900" : "text-gray-700"
                    }`}
                  >
                    {option.title}
                  </p>
                  <p className="text-xs text-gray-500">{option.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-400"
          >
            {isLoading ? "삭제 중..." : "삭제"}
          </button>
        </div>
      </div>
    </div>
  );
}
