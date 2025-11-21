# 플랜 카드 레이아웃 재구성

## 변경 사항

PlanCard 컴포넌트의 레이아웃을 재구성하여 정보를 더 명확하게 표시하도록 개선했습니다.

### 새로운 레이아웃 구조 (3행)

1. **1행: 상태 뱃지 + 시간 표기 + 교과 과목**
   - 상태 뱃지 (완료/학습 중/대기)
   - 시간 표기 (Clock 아이콘 포함)
   - 교과 (contentSubjectCategory)
   - 과목 (contentSubject)

2. **2행: 교재명(또는 강의명) 회차**
   - 콘텐츠 아이콘
   - 교재명/강의명 (contentTitle)
   - 회차 (contentEpisode)

3. **3행: 학습 범위**
   - 책: 페이지 범위
   - 강의: 강의 회차
   - 챕터 정보 (있는 경우)

### 제거된 항목

- 중복되는 시간 표기 영역 제거
  - 기존에 1행과 별도로 표시되던 시간 정보를 1행으로 통합
  - `plan.start_time`과 `plan.end_time`이 있을 때만 표시

### 변경 파일

- `app/(student)/plan/calendar/_components/PlanCard.tsx`
  - 레이아웃을 3행 구조로 재구성
  - 교과, 과목을 1행 시간 옆으로 이동
  - 카드 영역에 맞게 요소 사이즈 재조정
    - 패딩: p-4 → p-3
    - 폰트 사이즈: text-xs → text-[10px], text-lg → text-sm, text-base → text-sm
    - 뱃지 패딩: px-3 py-1 → px-2 py-0.5
    - 아이콘 사이즈: text-xl → text-base, h-3 w-3 → h-2.5 w-2.5
    - 진행률 바: h-2.5 w-20 → h-2 w-16
    - 간격: gap-2 → gap-1.5, gap-1

## 추가 변경 사항

### 회차 표기 사이즈 증가 (2025-01-31)
- 회차 표기 폰트 사이즈: `text-[10px]` → `text-xs` (12px)
- `font-medium` 추가로 가독성 향상

## 날짜

2025-01-31

