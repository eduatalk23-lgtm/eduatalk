# 플랜 생성 단계 텍스트 색상 가이드라인 준수

## 작업 일시
2025-02-02

## 작업 개요
플랜 생성 단계의 텍스트 색상이 가이드라인에 맞지 않아 가이드라인에 맞게 수정했습니다.

## 문제점
플랜 생성 단계에서 다양한 blue 색상(`text-blue-900`, `text-blue-700`, `text-blue-600`)을 사용하고 있어 가이드라인과 일치하지 않았습니다.

## 가이드라인
프로젝트 가이드라인에 따르면:
- **색상 강조**: `text-blue-800` (일관된 색상 사용)

## 해결 방법
모든 텍스트 색상을 `text-blue-800`으로 통일했습니다.

### 변경 규칙
- `text-blue-900` → `text-blue-800`
- `text-blue-700` → `text-blue-800`
- `text-blue-600` → `text-blue-800` (텍스트 색상만, 기능적 색상은 유지)

### 유지된 색상
- 체크박스의 `focus:ring-blue-500` (기능적 색상)
- 아이콘의 `text-blue-600` (시각적 요소)
- 기타 기능적 색상 (hover, border 등)

## 수정된 파일 목록

### 1. Step1BasicInfo.tsx
- 캠프 프로그램 정보: `text-blue-900/700/600` → `text-blue-800`
- 1730 Timetable 설명: `text-blue-900` → `text-blue-800`
- 추가 기간 재배치 설명: `text-blue-700/600` → `text-blue-800`

### 2. Step3ContentSelection.tsx
- 탭 활성 상태 텍스트: `text-blue-600/700` → `text-blue-800`
- 필수 교과 배지: 이미 `text-blue-800` 사용 중

### 3. Step6Simplified.tsx
- 확인사항 아이콘: `text-blue-600` → `text-blue-800`
- 확인사항 제목: `text-blue-900` → `text-blue-800`

### 4. Step6FinalReview.tsx
- 학생 콘텐츠 카운트: `text-blue-700/900` → `text-blue-800`
- 범위 표시: `text-blue-700/900` → `text-blue-800`
- 설정 요약: `text-blue-700/900` → `text-blue-800`

### 5. Step7ScheduleResult/ScheduleTableView.tsx
- 테이블 헤더: `text-blue-900` → `text-blue-800`
- 테이블 데이터: `text-blue-700/600` → `text-blue-800`

### 6. 기타 컴포넌트
- `CollapsibleSection.tsx`: 편집 버튼 텍스트
- `ExclusionsPanel.tsx`: 지정휴일 안내 텍스트
- `TimeSettingsPanel.tsx`: 안내 텍스트
- `ContentRangeInput.tsx`: 범위 입력 안내 텍스트
- `SchedulePreviewPanel.tsx`: 학습일 표시
- `MasterContentsPanel.tsx`: 필터 버튼 텍스트
- `RecommendedContentsPanel.tsx`: 추천 설정 텍스트
- `Step3Contents.tsx`: 마스터 콘텐츠 배지
- `ContentCard.tsx`: 내신 등급 배지
- `SummaryCard.tsx`: 요약 카드 텍스트
- `RequiredSubjectItem.tsx`: 링크 텍스트

## 개선 효과

1. **일관성**: 모든 텍스트 색상이 가이드라인에 맞게 통일됨
2. **가독성**: 일관된 색상으로 사용자 경험 향상
3. **유지보수성**: 표준 색상 사용으로 향후 수정 용이

## 참고 사항

- 기능적 색상(체크박스 focus ring, 아이콘 등)은 유지
- 에러, 경고, 성공 등의 기능적 색상(red, amber, yellow, green)은 유지
- 텍스트 색상만 가이드라인에 맞게 수정

## 관련 문서
- `docs/camp-template-ui-text-color-improvement.md` - 캠프 템플릿 UI 텍스트 색상 개선 가이드
- `docs/2025-02-02-camp-template-text-color-fix.md` - 캠프 템플릿 텍스트 색상 수정

