# 슬롯 UI 4열 그리드 개선 계획

## 작성일: 2024-12-24

## 현재 상태

현재 슬롯 모드 UI는 2열 그리드로 구성되어 있음:
- 좌측: 슬롯 목록 + AI 추천/프리셋
- 우측: SlotEditorPanel (슬롯 상세 | 콘텐츠 연결 | 범위 탭)

## 발견된 문제점

### 1. 슬롯 추가 버튼 접근성 문제
- 슬롯 추가 버튼이 우측 패널로 이동하면서 **슬롯 미선택 상태에서만** 표시됨
- 슬롯 1개 추가 후 해당 슬롯이 자동 선택되어 추가 버튼이 사라짐
- **사용자가 추가 슬롯을 생성하는 방법을 찾기 어려움**

### 2. 화면 활용도 부족
- 웹 환경에서는 넓은 화면을 사용할 수 있음
- 현재 2열 그리드는 공간 활용이 비효율적
- 각 단계가 탭으로 숨겨져 있어 한눈에 파악하기 어려움

### 3. 콘텐츠 선택 후 범위 설정 UX 문제
- 콘텐츠 선택 시 즉시 범위 설정 모달이 팝업됨
- 범위 설정을 별도 영역(4번째 칼럼)에서 진행하는 것이 자연스러움
- 모달 사용으로 인해 컨텍스트 전환이 발생

---

## 개선 방안

### 목표 레이아웃: 4열 그리드

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│  슬롯 목록    │  슬롯 상세    │  콘텐츠 연결  │    범위      │
│  + 추가 버튼  │              │              │              │
├──────────────┼──────────────┼──────────────┼──────────────┤
│ • 슬롯 1     │ 타입 선택    │ 내 콘텐츠    │ 시작: ___p  │
│ • 슬롯 2     │ 교과 선택    │ 추천         │ 끝: ___p    │
│ • 슬롯 3     │ 과목 선택    │ 마스터 검색  │             │
│              │ 배정 방식    │              │ [범위 수정]  │
│ [+ 슬롯 추가]│              │              │             │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

### 구체적인 개선 사항

#### 1. 슬롯 추가 버튼 위치 변경
- **슬롯 목록 패널 하단에 항상 표시**
- 슬롯 선택 상태와 무관하게 접근 가능
- 현재 슬롯 수/최대 슬롯 수 표시 유지

#### 2. 4열 그리드 레이아웃
- `grid-cols-4` 적용 (웹 기준)
- 각 열의 역할 명확화:
  - 1열: 슬롯 목록 + 추가 버튼
  - 2열: 슬롯 상세 설정 (타입/교과/과목/배정방식)
  - 3열: 콘텐츠 연결 (소스 선택 + 검색 + 목록)
  - 4열: 범위 설정 (시작/끝 입력)

#### 3. 범위 설정 UX 개선
- 콘텐츠 선택 시 모달 팝업 제거
- 콘텐츠 선택 → 4열(범위)에서 직접 범위 입력
- 범위 영역에서 목차 조회 기능 제공
- 범위 수정 버튼은 기존 범위가 있을 때만 표시

#### 4. 반응형 처리
- **데스크톱 (lg 이상)**: 4열 그리드
- **태블릿 (md)**: 2열 그리드 + 탭
- **모바일 (sm 미만)**: 1열 스택 + 탭

---

## 구현 계획

### 파일 수정 목록

1. **`Step3SlotModeSelection.tsx`**
   - 2열 → 4열 그리드 변경
   - SlotEditorPanel 분해하여 각 열에 배치
   - 반응형 breakpoint 설정

2. **`SlotConfigurationPanel.tsx`**
   - 슬롯 추가 버튼 복원 (하단 고정)
   - AI 추천/프리셋은 상단 유지

3. **`SlotEditorPanel.tsx` → 분해**
   - `SlotDetailPanel.tsx`: 슬롯 상세 설정만
   - `ContentLinkingPanel.tsx`: 콘텐츠 연결만 (기존 파일 활용)
   - `RangeSettingPanel.tsx`: 범위 설정만 (인라인)

4. **`ContentLinkingPanel.tsx` 수정**
   - 콘텐츠 선택 시 범위 모달 제거
   - 콘텐츠 선택만 처리 → 범위는 별도 패널에서

5. **`RangeSettingPanel.tsx` 신규 생성**
   - 인라인 범위 입력 폼
   - 목차 조회 기능 (목차 기반 범위 선택)
   - RangeSettingModal의 기능을 인라인화

---

## 기대 효과

1. **학습 곡선 감소**: 모든 설정이 한 화면에서 보임
2. **작업 효율 증가**: 탭 전환 없이 빠른 설정 가능
3. **접근성 개선**: 슬롯 추가 버튼 항상 접근 가능
4. **UX 일관성**: 모달 대신 인라인 편집으로 통일

---

## 관련 파일

- `app/(student)/plan/new-group/_components/_features/content-selection/slot-mode/Step3SlotModeSelection.tsx`
- `app/(student)/plan/new-group/_components/_features/content-selection/slot-mode/SlotConfigurationPanel.tsx`
- `app/(student)/plan/new-group/_components/_features/content-selection/slot-mode/SlotEditorPanel.tsx`
- `app/(student)/plan/new-group/_components/_features/content-selection/slot-mode/ContentLinkingPanel.tsx`
- `app/(student)/plan/new-group/_components/_features/content-selection/components/RangeSettingModal.tsx`
