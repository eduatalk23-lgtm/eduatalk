
import { useState, useEffect } from "react";
import { WizardData } from "../../PlanGroupWizard";
import { ContentInfo } from "../types";

type UseInitialRangesProps = {
  contentInfos: ContentInfo[];
  data: WizardData;
};

export function useInitialRanges({ contentInfos, data }: UseInitialRangesProps) {
  const [initialRanges, setInitialRanges] = useState<
    Map<string, { start: number; end: number }>
  >(new Map());

  // 초기 범위 저장 (변경 여부 확인용)
  useEffect(() => {
    if (contentInfos.length === 0) return;

    // contentKey 매핑 생성 (최적화)
    const contentKeyMap = new Map<string, string>();
    const contentMap = new Map<
      string,
      | (typeof data.student_contents)[0]
      | (typeof data.recommended_contents)[0]
    >();

    data.student_contents.forEach((c, idx) => {
      const key = `student-${idx}`;
      contentKeyMap.set(c.content_id, key);
      contentMap.set(key, c);
    });
    data.recommended_contents.forEach((c, idx) => {
      const key = `recommended-${idx}`;
      contentKeyMap.set(c.content_id, key);
      contentMap.set(key, c);
    });

    setInitialRanges((prev) => {
      // 이미 저장된 값이 있으면 유지
      if (prev.size > 0 && prev.size === contentInfos.length) return prev;

      const newMap = new Map(prev);
      contentInfos.forEach((info) => {
        const contentKey = contentKeyMap.get(info.content_id);
        if (!contentKey) return;
        if (newMap.has(contentKey)) return;

        const content = contentMap.get(contentKey);
        if (content) {
          newMap.set(contentKey, {
            start: content.start_range,
            end: content.end_range,
          });
        }
      });
      return newMap;
    });
  }, [contentInfos, data.student_contents, data.recommended_contents]);

  return initialRanges;
}
