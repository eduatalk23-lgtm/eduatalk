
import { useState, useEffect } from "react";
import { WizardData } from "../../PlanGroupWizard";
import {
  formatDateFromDate,
  parseDateString as parseDateStringUtil,
  getTodayParts,
  formatDateString,
} from "@/lib/utils/date";

export type PeriodInputType = "dday" | "direct" | "weeks";

type UsePeriodCalculationProps = {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  editable: boolean;
};

export function usePeriodCalculation({
  data,
  onUpdate,
  editable,
}: UsePeriodCalculationProps) {
  const [periodInputType, setPeriodInputType] =
    useState<PeriodInputType>("direct");

  const [ddayState, setDdayState] = useState({ date: "", calculated: false });
  const [weeksState, setWeeksState] = useState({ startDate: "", weeks: 4 });
  const [directState, setDirectState] = useState(() => {
    return {
      start: data.period_start || "",
      end: data.period_end || "",
    };
  });

  // target_date가 있으면 ddayState 업데이트
  useEffect(() => {
    if (data.target_date) {
      setDdayState({ date: data.target_date, calculated: true });
      setPeriodInputType("dday");
    }
  }, [data.target_date]);

  // weeksState 업데이트
  useEffect(() => {
    if (data.period_start && !data.target_date) {
      if (data.period_start && data.period_end) {
        const start = new Date(data.period_start);
        const end = new Date(data.period_end);
        const diffDays = Math.floor(
          (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
        );
        const weeks = Math.floor(diffDays / 7);

        if (diffDays % 7 === 0 && weeks >= 4) {
          setWeeksState({ startDate: data.period_start, weeks });
          setPeriodInputType("weeks");
        } else {
          setPeriodInputType("direct");
        }
      }
    }
  }, [data.period_start, data.period_end, data.target_date]);

  // 학습기간 데이터 변경 시 directState 업데이트
  useEffect(() => {
    if (data.period_start || data.period_end) {
      setDirectState((prev) => {
        if (
          prev.start !== (data.period_start || "") ||
          prev.end !== (data.period_end || "")
        ) {
          return {
            start: data.period_start || "",
            end: data.period_end || "",
          };
        }
        return prev;
      });
    }
  }, [data.period_start, data.period_end]);

  const handlePeriodTypeChange = (type: PeriodInputType) => {
    if (!editable) return;
    setPeriodInputType(type);

    if (type !== "dday") {
      setDdayState({ date: "", calculated: false });
      if (type !== "direct" && type !== "weeks") {
        onUpdate({ period_start: "", period_end: "", target_date: undefined });
      }
    }
    if (type !== "weeks") {
      setWeeksState({ startDate: "", weeks: 4 });
      if (type !== "direct" && type !== "dday") {
        onUpdate({ period_start: "", period_end: "" });
      }
    } else {
      setWeeksState({ startDate: "", weeks: 4 });
    }
    if (type !== "direct") {
      setDirectState({
        start: "",
        end: "",
      });
      if (type !== "dday" && type !== "weeks") {
        onUpdate({ period_start: "", period_end: "" });
      }
    }
  };

  const calculatePeriodFromWeeks = (weeks: number, startDate: string) => {
    if (!startDate) {
      onUpdate({ period_start: "", period_end: "" });
      return;
    }

    const startParts = parseDateStringUtil(startDate);
    const start = new Date(
      startParts.year,
      startParts.month - 1,
      startParts.day
    );

    const end = new Date(start);
    end.setDate(end.getDate() + weeks * 7);

    onUpdate({
      period_start: formatDateFromDate(start),
      period_end: formatDateFromDate(end),
    });
  };

  const calculatePeriodFromDday = (dday: string) => {
    if (!dday) {
      onUpdate({ period_start: "", period_end: "", target_date: undefined });
      return;
    }

    const targetParts = parseDateStringUtil(dday);
    const targetDate = new Date(
      targetParts.year,
      targetParts.month - 1,
      targetParts.day
    );

    const start = new Date(targetDate);
    start.setDate(start.getDate() - 30);

    onUpdate({
      period_start: formatDateFromDate(start),
      period_end: formatDateFromDate(targetDate),
      target_date: dday,
    });
  };

  return {
    periodInputType,
    ddayState,
    weeksState,
    directState,
    setPeriodInputType: handlePeriodTypeChange,
    setDdayState,
    setWeeksState,
    setDirectState,
    calculatePeriodFromWeeks,
    calculatePeriodFromDday,
  };
}
