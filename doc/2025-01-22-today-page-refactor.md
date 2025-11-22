# Today 페이지 재구성 작업

## 날짜
2025-01-22

## 작업 목적
`/today` 페이지의 UI와 타이머 기능이 꼬여서 구현이 막힌 문제를 해결하기 위해 처음부터 깔끔하게 재구성했습니다.

## 요구사항

1. ✅ 플랜 1개만 보는 뷰 (단일 뷰)
2. ✅ 날짜에 해당하는 플랜 목록을 다 보는 뷰 (일일 뷰)
3. ✅ 타이머 (학습 시간 측정) 기능
4. ✅ 플랜 완료/미완료 처리

## 새로운 구조

### 컴포넌트 계층 구조

```
/today 페이지
├── page.tsx (서버 컴포넌트)
│   └── 데이터 페칭만 담당
│
├── PlanViewContainer.tsx (클라이언트)
│   ├── 뷰 모드 전환 (단일/일일)
│   ├── SinglePlanView.tsx
│   │   └── PlanCard.tsx
│   │       └── PlanTimer.tsx
│   └── DailyPlanListView.tsx
│       └── PlanCard.tsx (여러 개)
│           └── PlanTimer.tsx
│
└── API
    └── /api/today/plans/route.ts
        └── 플랜 데이터 조회 API
```

### 주요 컴포넌트

#### 1. `page.tsx`
- 서버 컴포넌트로 데이터 페칭만 담당
- 인증 및 권한 확인
- 진행률 계산

#### 2. `PlanViewContainer.tsx`
- 뷰 모드 전환 (단일/일일)
- 선택된 플랜 상태 관리

#### 3. `SinglePlanView.tsx`
- 단일 플랜 상세 뷰
- 플랜 선택기 포함
- API에서 데이터 로딩
- 1초마다 자동 갱신 (타이머 업데이트)

#### 4. `DailyPlanListView.tsx`
- 일일 플랜 목록 뷰
- 모든 플랜을 카드 형태로 표시
- API에서 데이터 로딩
- 1초마다 자동 갱신 (타이머 업데이트)

#### 5. `PlanCard.tsx`
- 플랜 카드 컴포넌트
- 타이머 기능 포함
- 완료/미완료 토글 기능
- 단일/일일 뷰 모드 지원

#### 6. `PlanTimer.tsx`
- 타이머 UI 및 제어
- 시작/일시정지/재개/완료 버튼
- 실시간 시간 표시
- 컴팩트/전체 모드 지원

#### 7. `/api/today/plans/route.ts`
- 플랜 데이터 조회 API
- 콘텐츠 정보 조회
- 진행률 조회
- 활성 세션 조회
- 오늘 플랜이 없으면 가장 가까운 미래 날짜의 플랜 조회

## 주요 기능

### 1. 뷰 모드 전환
- **단일 뷰**: 한 플랜만 상세하게 보기
- **일일 뷰**: 모든 플랜을 목록으로 보기
- ViewModeSelector로 쉽게 전환 가능

### 2. 타이머 기능
- **시작**: 플랜 학습 시작
- **일시정지**: 학습 일시정지 (일시정지 시간 제외)
- **재개**: 일시정지된 학습 재개
- **완료**: 플랜 완료 처리
- 실시간 시간 표시 (1초 단위 업데이트)
- 일시정지 횟수 및 시간 표시

### 3. 완료/미완료 토글
- 각 플랜에 체크박스 형태로 완료 상태 표시
- 클릭 시 완료/미완료 상태 토글
- 완료 시 진행률 100%로 설정
- 미완료 시 진행률 0%로 설정

### 4. 데이터 자동 갱신
- 1초마다 API 호출하여 타이머 시간 업데이트
- 서버 상태와 클라이언트 상태 동기화

## 개선 사항

### 기존 문제점
1. 컴포넌트가 너무 많이 분산되어 있음
2. 타이머 로직이 여러 곳에 흩어져 있음
3. 상태 관리가 복잡함
4. UI와 기능이 꼬여서 수정이 어려움

### 개선된 점
1. **명확한 컴포넌트 구조**: 각 컴포넌트의 역할이 명확함
2. **단순한 데이터 흐름**: API → 컴포넌트 → UI
3. **재사용 가능한 컴포넌트**: PlanCard, PlanTimer를 여러 곳에서 사용
4. **타이머 로직 통합**: PlanTimer 컴포넌트에 모든 타이머 로직 집중
5. **완료/미완료 기능 추가**: 간단한 토글 버튼으로 구현

## 사용된 기술

- **Next.js 15**: App Router, Server Components
- **React Hooks**: useState, useEffect
- **TypeScript**: 타입 안전성
- **Tailwind CSS**: 스타일링
- **Lucide React**: 아이콘

## 향후 개선 제안

1. **성능 최적화**
   - 1초마다 전체 API 호출 대신 WebSocket 또는 Server-Sent Events 사용 고려
   - React Query로 캐싱 및 자동 갱신 관리

2. **사용자 경험 개선**
   - 로딩 상태 표시 개선
   - 에러 처리 개선
   - 오프라인 지원

3. **기능 추가**
   - 플랜 필터링 (완료/미완료)
   - 플랜 정렬 (시간순, 진행률순)
   - 플랜 검색

4. **접근성 개선**
   - 키보드 네비게이션
   - 스크린 리더 지원
   - ARIA 속성 추가

## 변경된 파일

### 새로 생성된 파일
- `app/(student)/today/page.tsx` (재작성)
- `app/(student)/today/_components/PlanViewContainer.tsx`
- `app/(student)/today/_components/SinglePlanView.tsx` (재작성)
- `app/(student)/today/_components/DailyPlanListView.tsx` (재작성)
- `app/(student)/today/_components/PlanCard.tsx` (새로 생성)
- `app/(student)/today/_components/PlanTimer.tsx` (새로 생성)
- `app/api/today/plans/route.ts` (새로 생성)

### 기존 파일 (유지)
- `app/(student)/today/_components/ViewModeSelector.tsx`
- `app/(student)/today/_components/PlanSelector.tsx`
- `app/(student)/today/_components/TodayHeader.tsx`
- `app/(student)/today/_components/TodayAchievements.tsx`
- `app/(student)/today/_utils/planGroupUtils.ts`
- `app/(student)/today/actions/todayActions.ts`
- `app/actions/today.ts` (완료 토글 기능 사용)

## 테스트 체크리스트

- [ ] 단일 뷰에서 플랜 선택 및 표시
- [ ] 일일 뷰에서 모든 플랜 목록 표시
- [ ] 타이머 시작/일시정지/재개/완료 기능
- [ ] 완료/미완료 토글 기능
- [ ] 실시간 시간 업데이트
- [ ] 오늘 플랜이 없을 때 가장 가까운 미래 날짜의 플랜 표시
- [ ] 반응형 디자인 (모바일/데스크톱)

## 참고사항

- 기존 `TodayPlanList`, `TodayPlanListView`, `PlanGroupCard` 등의 컴포넌트는 아직 유지되어 있으나, 새로운 구조에서는 사용하지 않습니다.
- 향후 기존 컴포넌트들을 정리할 수 있습니다.
- API 엔드포인트는 기존 서버 컴포넌트의 데이터 페칭 로직을 재사용했습니다.

