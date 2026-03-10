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
  { label: '학습', defaultIsTask: true, defaultColor: '#f6bf26' },
  { label: '일반', defaultIsTask: false, defaultColor: '#a3a3a3' },
  { label: '학교', defaultIsTask: false, defaultColor: '#d1d5db' },
  { label: '학원', defaultIsTask: false, defaultColor: '#9ca3af' },
  { label: '이동시간', defaultIsTask: false, defaultColor: '#fdba74' },
  { label: '아침식사', defaultIsTask: false, defaultColor: '#7dd3fc' },
  { label: '점심식사', defaultIsTask: false, defaultColor: '#7dd3fc' },
  { label: '저녁식사', defaultIsTask: false, defaultColor: '#7dd3fc' },
  { label: '수면', defaultIsTask: false, defaultColor: '#c4b5fd' },
  { label: '휴식', defaultIsTask: false, defaultColor: '#86efac' },
];

const presetMap = new Map(LABEL_PRESETS.map((p) => [p.label, p]));

export function getPresetForLabel(label: string): LabelPreset | undefined {
  return presetMap.get(label);
}

export function getDefaultColor(label: string): string {
  return presetMap.get(label)?.defaultColor ?? '#a3a3a3';
}

export function getDefaultIsTask(label: string): boolean {
  return presetMap.get(label)?.defaultIsTask ?? false;
}
