"use client";

import { Dialog, DialogContent } from "@/components/ui/Dialog";
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
        maxWidth="lg"
      >
        <DialogContent>
          <div className="flex flex-col gap-6">
          <div className="rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  입시년도는 현재 학년을 기준으로 자동 계산됩니다.
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  개인 사정(유급, 조기입학 등)으로 인해 생년월일과 학년이 다를 수 있으므로,
                  실제 학년 정보를 우선시하여 계산합니다.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <section className="flex flex-col gap-3">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                중학교
              </h3>
              <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 dark:text-gray-300">중3</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {currentYear + 4}년 입시
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 dark:text-gray-300">중2</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {currentYear + 5}년 입시
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 dark:text-gray-300">중1</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {currentYear + 6}년 입시
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                계산식: 현재년도 + (7 - 학년)
              </p>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                고등학교
              </h3>
              <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 dark:text-gray-300">고1</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {currentYear + 3}년 입시
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 dark:text-gray-300">고2</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {currentYear + 2}년 입시
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 dark:text-gray-300">고3</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {currentYear + 1}년 입시
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                계산식: 현재년도 + (4 - 학년)
              </p>
            </section>
          </div>
        </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="개정교육과정 계산 방법"
      maxWidth="lg"
    >
      <DialogContent>
        <div className="flex flex-col gap-6">
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0" />
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
            <section className="flex flex-col gap-3">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                계산 원리
              </h3>
              <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-4 flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  중학교 입학년도 계산
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  입학년도 = 현재년도 - (학년 - 1)
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  예: {currentYear}년 중3 → {currentYear - 2}년 중1 입학
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  고등학교 입학년도 계산
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  입학년도 = 현재년도 - (학년 - 1)
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  예: {currentYear}년 고2 → {currentYear - 1}년 고1 입학
                </p>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              개정교육과정 기준
            </h3>
            <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-4 flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  2022 개정
                </p>
                <ul className="text-sm text-gray-700 dark:text-gray-300 flex flex-col gap-1 pl-4 list-disc">
                  <li>중학교: 2024년 중1 입학부터</li>
                  <li>고등학교: 2027년 고1 입학부터</li>
                </ul>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  2015 개정
                </p>
                <ul className="text-sm text-gray-700 dark:text-gray-300 flex flex-col gap-1 pl-4 list-disc">
                  <li>중학교: 2015년 중1 입학부터</li>
                  <li>고등학교: 2018년 고1 입학부터</li>
                </ul>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  2009 개정
                </p>
                <ul className="text-sm text-gray-700 dark:text-gray-300 flex flex-col gap-1 pl-4 list-disc">
                  <li>2015년 이전 입학자</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              주의사항
            </h3>
            <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <ul className="text-sm text-amber-900 dark:text-amber-100 flex flex-col gap-2 pl-4 list-disc">
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
      </DialogContent>
    </Dialog>
  );
}



