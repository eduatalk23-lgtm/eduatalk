/**
 * 이벤트 라벨 프리셋
 *
 * event_type 대신 자유 텍스트 label을 사용하되,
 * 기본 프리셋으로 빠른 선택을 지원합니다.
 */

export interface LabelPreset {
  label: string;
  defaultIsTask: boolean;
  defaultColor: string;
}

export const LABEL_PRESETS: LabelPreset[] = [
  { label: '학습', defaultIsTask: true, defaultColor: '#3b82f6' },
  { label: '일반', defaultIsTask: false, defaultColor: '#6b7280' },
  { label: '학교', defaultIsTask: false, defaultColor: '#8b5cf6' },
  { label: '학원', defaultIsTask: false, defaultColor: '#f97316' },
  { label: '이동시간', defaultIsTask: false, defaultColor: '#f97316' },
  { label: '아침식사', defaultIsTask: false, defaultColor: '#0ea5e9' },
  { label: '점심식사', defaultIsTask: false, defaultColor: '#0ea5e9' },
  { label: '저녁식사', defaultIsTask: false, defaultColor: '#0ea5e9' },
  { label: '수면', defaultIsTask: false, defaultColor: '#a855f7' },
  { label: '휴식', defaultIsTask: false, defaultColor: '#22c55e' },
];

const presetMap = new Map(LABEL_PRESETS.map((p) => [p.label, p]));

export function getPresetForLabel(label: string): LabelPreset | undefined {
  return presetMap.get(label);
}

export function getDefaultColor(label: string): string {
  return presetMap.get(label)?.defaultColor ?? '#6b7280';
}

export function getDefaultIsTask(label: string): boolean {
  return presetMap.get(label)?.defaultIsTask ?? false;
}
