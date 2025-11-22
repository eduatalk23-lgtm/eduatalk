# Today 페이지 - 플랜 뷰 구현 완료

## 📋 구현 개요

`/today` 페이지에서 플랜을 보는 방식을 다양하게 제공하는 기능을 구현했습니다. 같은 `plan_number`를 가진 쪼개진 플랜들을 하나로 그룹화하여 표시하며, 일일 뷰와 단일 뷰를 제공합니다.

## ✅ 구현 완료 항목

### 1. 타입 정의 및 유틸리티 함수

**파일**: `app/(student)/today/_utils/planGroupUtils.ts`

- `PlanWithContent` 타입 정의
- `PlanGroup` 타입 정의
- `groupPlansByPlanNumber`: 같은 `plan_number`를 가진 플랜 그룹화
- `getActivePlan`: 활성 플랜 확인
- `calculateGroupProgress`: 플랜 그룹의 전체 진행률 계산
- `calculateGroupTotalStudyTime`: 플랜 그룹의 총 학습 시간 계산
- `getActivePlansCount`: 활성 플랜 수 계산
- `getCompletedPlansCount`: 완료 플랜 수 계산
- `formatTime`: 시간 포맷팅 (HH:MM:SS 또는 MM:SS)
- `formatTimestamp`: 타임스템프 포맷팅 (YYYY-MM-DD HH:mm:ss)

### 2. 뷰 모드 선택 컴포넌트

**파일**: `app/(student)/today/_components/ViewModeSelector.tsx`

- 일일 뷰와 단일 뷰 전환 버튼 제공
- 현재 선택된 뷰 모드 시각적 표시

### 3. 타임스템프 표시 컴포넌트

**파일**: `app/(student)/today/_components/TimestampDisplay.tsx`

- 시작 시간, 종료 시간 표시
- 경과 시간 실시간 업데이트
- 일시정지 정보 (횟수, 시간) 표시
- 실제 학습 시간 계산 및 표시

### 4. 타이머 제어 버튼 컴포넌트

**파일**: `app/(student)/today/_components/TimerControlButtons.tsx`

- 시작/일시정지/재개/완료 버튼 제공
- 상태별 버튼 표시 (시작 전, 실행 중, 일시정지 중, 완료)
- 로딩 상태 처리

### 5. 플랜 아이템 컴포넌트

**파일**: `app/(student)/today/_components/PlanItem.tsx`

- 개별 플랜 블록 표시
- 일일 뷰와 단일 뷰에서 다른 레이아웃 제공
- 타이머 통합 (실시간 경과 시간 표시)
- 진행률 표시

### 6. 플랜 그룹 카드 컴포넌트

**파일**: `app/(student)/today/_components/PlanGroupCard.tsx`

- 같은 `plan_number`를 가진 플랜들을 하나의 카드로 그룹화
- 일일 뷰: 컴팩트한 카드 형태
- 단일 뷰: 전체 화면으로 크게 표시
- 그룹 단위 타이머 제어 (그룹 시작/일시정지/완료)
- 집계 정보 표시 (전체 진행률, 총 학습 시간 등)

### 7. 플랜 선택 컴포넌트 (단일 뷰용)

**파일**: `app/(student)/today/_components/PlanSelector.tsx`

- 드롭다운으로 플랜 선택
- 이전/다음 버튼으로 순차적 전환
- 플랜 상태 표시 (진행 중, 완료, 대기 중)

### 8. 일일 뷰 레이아웃

**파일**: `app/(student)/today/_components/DailyPlanView.tsx`

- 하루의 모든 플랜을 카드 형태로 나열
- 같은 `plan_number`를 가진 플랜들은 하나의 카드로 그룹화
- "상세보기" 버튼으로 단일 뷰로 전환

### 9. 단일 뷰 레이아웃

**파일**: `app/(student)/today/_components/SinglePlanView.tsx`

- 하나의 플랜 그룹을 전체 화면으로 크게 표시
- 플랜 선택기로 다른 플랜으로 전환
- 상세 정보 제공

### 10. 메인 뷰 컴포넌트

**파일**: `app/(student)/today/_components/TodayPlanListView.tsx`

- 뷰 모드 상태 관리
- 일일 뷰와 단일 뷰 전환
- 선택된 플랜 상태 관리

### 11. TodayPlanList 컴포넌트 리팩토링

**파일**: `app/(student)/today/_components/TodayPlanList.tsx`

- 플랜 그룹화 로직 통합
- 새로운 뷰 시스템 적용
- 세션 정보 매핑 개선

## 🎯 주요 기능

### 플랜 그룹화

- 같은 `plan_number`를 가진 플랜들을 하나의 그룹으로 묶어서 표시
- 그룹 내 플랜들은 `block_index` 기준으로 정렬
- 그룹 단위로 진행률, 학습 시간 집계

### 뷰 모드 전환

1. **일일 뷰 → 단일 뷰**
   - 플랜 카드 클릭 또는 "상세보기" 버튼
   - 상단 "📌 단일 뷰" 버튼 클릭

2. **단일 뷰 → 일일 뷰**
   - 상단 "📋 일일 뷰" 버튼 클릭

### 타이머 제어

- **개별 플랜 제어**: 각 플랜 블록은 독립적으로 시작/일시정지/완료 가능
- **그룹 제어**: 그룹 단위로 시작/일시정지/완료 가능
- **타임스템프 표시**: 시작 시간, 종료 시간, 경과 시간, 일시정지 정보 표시

### 타임스템프 표시

- 시작 시간: `YYYY-MM-DD HH:mm:ss` 형식
- 종료 시간: 완료 시 표시
- 경과 시간: 실시간 업데이트 (1초 단위)
- 일시정지 정보: 횟수 및 총 일시정지 시간
- 실제 학습 시간: 총 소요 시간 - 일시정지 시간

## 📊 데이터 흐름

1. **서버 컴포넌트 (TodayPlanList)**
   - 플랜 데이터 조회
   - 콘텐츠 정보 조회
   - 세션 정보 조회
   - 플랜 그룹화 (`groupPlansByPlanNumber`)

2. **클라이언트 컴포넌트 (TodayPlanListView)**
   - 뷰 모드 상태 관리
   - 선택된 플랜 상태 관리
   - 일일/단일 뷰 렌더링

3. **플랜 그룹 카드 (PlanGroupCard)**
   - 그룹 정보 표시
   - 개별 플랜 블록 렌더링
   - 그룹 단위 타이머 제어

4. **플랜 아이템 (PlanItem)**
   - 개별 플랜 블록 표시
   - 타이머 통합
   - 개별 타이머 제어

## 🔄 사용자 인터랙션

### 뷰 모드 전환

- 상단 버튼으로 일일/단일 뷰 전환
- 일일 뷰에서 플랜 카드 클릭 또는 "상세보기" 버튼으로 단일 뷰로 전환

### 플랜 선택 (단일 뷰)

- 드롭다운으로 직접 선택
- 이전/다음 버튼으로 순차적 전환

### 타이머 제어

- 개별 플랜: 각 플랜 블록의 버튼으로 제어
- 그룹 단위: 그룹 카드 하단의 그룹 제어 버튼으로 제어

## 📝 참고사항

### 플랜 그룹화 규칙

- 같은 `plan_number`를 가진 플랜들은 하나의 그룹으로 묶임
- `plan_number`가 `null`인 경우 각 플랜이 독립적인 그룹
- 그룹 내 플랜들은 `block_index` 기준으로 정렬

### 타임스템프 포맷

- 시간: `HH:MM:SS` 또는 `MM:SS` (1시간 미만)
- 타임스템프: `YYYY-MM-DD HH:mm:ss`
- 모든 시간은 한국 시간 기준

### 성능 최적화

- 플랜 그룹화는 서버 컴포넌트에서 한 번만 수행
- 세션 정보는 Map으로 변환하여 빠른 조회
- 실시간 경과 시간은 클라이언트 컴포넌트에서 1초 단위로 업데이트

## ✅ 체크리스트

- [x] 타입 정의 및 유틸리티 함수 구현
- [x] ViewModeSelector 컴포넌트 구현
- [x] TimestampDisplay 컴포넌트 구현
- [x] TimerControlButtons 컴포넌트 구현
- [x] PlanItem 컴포넌트 개선 (타이머 통합)
- [x] PlanGroupCard 컴포넌트 구현
- [x] PlanSelector 컴포넌트 구현
- [x] 일일 뷰 레이아웃 구현
- [x] 단일 뷰 레이아웃 구현
- [x] TodayPlanList 컴포넌트 리팩토링
- [x] 플랜 그룹화 로직 통합
- [x] 타임스템프 포맷팅
- [x] 실시간 경과 시간 표시
- [x] 반응형 스타일링 (기본 적용)

## 🚀 향후 개선 사항

- [ ] 드래그 앤 드롭 기능 통합 (기존 DraggablePlanList 기능)
- [ ] 키보드 단축키 지원 (좌우 화살표로 플랜 전환)
- [ ] 로딩 상태 UI 개선
- [ ] 에러 상태 처리 개선
- [ ] 모바일 반응형 최적화
- [ ] 애니메이션 효과 추가

