"use client";

import { Dialog } from "@/components/organisms/Dialog";
import { Info } from "lucide-react";

type CalculationInfoModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "exam_year" | "curriculum_revision";
};

export function CalculationInfoModal({
  open,
  onOpenChange,
  type,
}: CalculationInfoModalProps) {
  const currentYear = new Date().getFullYear();

  if (type === "exam_year") {
    return (
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title="입시년도 계산 방법"
        size="lg"
      >
        <div className="flex flex-col gap-6">
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-blue-900">
                  입시년도는 현재 학년을 기준으로 자동 계산됩니다.
                </p>
                <p className="text-sm text-blue-700">
                  개인 사정(유급, 조기입학 등)으로 인해 생년월일과 학년이 다를 수 있으므로,
                  실제 학년 정보를 우선시하여 계산합니다.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <section>
              <h3 className="text-base font-semibold text-gray-900 mb-3">
                중학교
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">중3</span>
                  <span className="text-sm font-medium text-gray-900">
                    {currentYear + 4}년 입시
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">중2</span>
                  <span className="text-sm font-medium text-gray-900">
                    {currentYear + 5}년 입시
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">중1</span>
                  <span className="text-sm font-medium text-gray-900">
                    {currentYear + 6}년 입시
                  </span>
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-600">
                계산식: 현재년도 + (7 - 학년)
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-gray-900 mb-3">
                고등학교
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">고1</span>
                  <span className="text-sm font-medium text-gray-900">
                    {currentYear + 3}년 입시
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">고2</span>
                  <span className="text-sm font-medium text-gray-900">
                    {currentYear + 2}년 입시
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">고3</span>
                  <span className="text-sm font-medium text-gray-900">
                    {currentYear + 1}년 입시
                  </span>
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-600">
                계산식: 현재년도 + (4 - 학년)
              </p>
            </section>
          </div>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="개정교육과정 계산 방법"
      size="lg"
    >
      <div className="flex flex-col gap-6">
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-blue-900">
                개정교육과정은 현재 학년을 기준으로 입학년도를 역산하여 자동 계산됩니다.
              </p>
              <p className="text-sm text-blue-700">
                개인 사정(유급, 조기입학 등)으로 인해 생년월일과 학년이 다를 수 있으므로,
                실제 학년 정보를 우선시하여 계산합니다.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <section>
            <h3 className="text-base font-semibold text-gray-900 mb-3">
              계산 원리
            </h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-900 mb-1">
                  중학교 입학년도 계산
                </p>
                <p className="text-sm text-gray-700">
                  입학년도 = 현재년도 - (학년 - 1)
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  예: {currentYear}년 중3 → {currentYear - 2}년 중1 입학
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 mb-1">
                  고등학교 입학년도 계산
                </p>
                <p className="text-sm text-gray-700">
                  입학년도 = 현재년도 - (학년 - 1)
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  예: {currentYear}년 고2 → {currentYear - 1}년 고1 입학
                </p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-base font-semibold text-gray-900 mb-3">
              개정교육과정 기준
            </h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-900 mb-2">
                  2022 개정
                </p>
                <ul className="text-sm text-gray-700 space-y-1 ml-4 list-disc">
                  <li>중학교: 2024년 중1 입학부터</li>
                  <li>고등학교: 2027년 고1 입학부터</li>
                </ul>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 mb-2">
                  2015 개정
                </p>
                <ul className="text-sm text-gray-700 space-y-1 ml-4 list-disc">
                  <li>중학교: 2015년 중1 입학부터</li>
                  <li>고등학교: 2018년 고1 입학부터</li>
                </ul>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 mb-2">
                  2009 개정
                </p>
                <ul className="text-sm text-gray-700 space-y-1 ml-4 list-disc">
                  <li>2015년 이전 입학자</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-base font-semibold text-gray-900 mb-3">
              주의사항
            </h3>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <ul className="text-sm text-amber-900 space-y-2 ml-4 list-disc">
                <li>
                  생년월일과 학년이 다를 수 있는 경우(유급, 조기입학 등)가 있으므로,
                  실제 학년 정보를 정확히 입력해주세요.
                </li>
                <li>
                  계산된 개정교육과정이 맞지 않다면 수동으로 선택할 수 있습니다.
                </li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </Dialog>
  );
}



