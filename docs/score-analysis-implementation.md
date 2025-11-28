# 성적 상세 분석 페이지 구현 가이드

## 📋 개요

이 문서는 `/scores/analysis` 페이지의 구현 내용을 설명합니다. 내신 및 모의고사 성적을 심층 분석하여 시각화된 차트와 상세 데이터를 제공합니다.

---

## 🏗 구조

### 페이지 레이아웃

```
/scores/analysis
│
├─ page.tsx (서버 컴포넌트)
│  ├─ 사용자 인증 확인
│  ├─ 내신 성적 조회 (전체)
│  └─ 모의고사 성적 조회 (최근 1년)
│
└─ _components/
   ├─ AnalysisLayout.tsx (클라이언트 컴포넌트)
   │  └─ 내신/모의고사 탭 전환
   │
   ├─ InternalDetailAnalysis.tsx (내신 분석)
   │  ├─ GPA 추이 차트
   │  ├─ 과목별 성적 테이블
   │  ├─ 취약 과목 분석
   │  └─ 성적 요약
   │
   ├─ InternalGPAChart.tsx (GPA 라인 차트)
   ├─ InternalSubjectTable.tsx (과목별 상세 테이블)
   │
   ├─ MockDetailAnalysis.tsx (모의고사 분석)
   │  ├─ 추이 요약
   │  ├─ 백분위 추이 차트
   │  ├─ 최근 2회 비교 테이블
   │  └─ 시험별 상세 성적
   │
   ├─ MockTrendChart.tsx (백분위 추이 차트)
   └─ MockComparisonTable.tsx (최근 2회 비교 테이블)
```

---

## 📊 분석 기능

### 1. 내신 분석 (InternalDetailAnalysis)

#### GPA 추이 차트
- **데이터**: 학기별 GPA (학점 가중 평균)
- **시각화**: 라인 차트 (Recharts)
- **X축**: 학년-학기 (예: "2학년 1학기")
- **Y축**: GPA (등급, 1~9, 역순)

#### 과목별 성적 테이블
- **정렬 기능**: 과목명, 평균 등급, 시험 횟수
- **색상 코딩**:
  - 1~2등급: 녹색 (우수)
  - 3~4등급: 파란색 (양호)
  - 5~6등급: 노란색 (보통)
  - 7~9등급: 빨간색 (미흡)

#### 취약 과목 분석
- **기준**: 평균 5등급 이하
- **표시 정보**:
  - 과목명 및 교과군
  - 평균 등급
  - 최근 등급

#### 성적 요약
- 전체 과목 수
- 평균 GPA
- 취약 과목 수

---

### 2. 모의고사 분석 (MockDetailAnalysis)

#### 추이 요약 카드
- **전체 시험 수**: 총 응시한 모의고사 횟수
- **최근 평균 백분위**: 최근 3회 평균
- **추이**: 상승/유지/하락 (이전 3회 대비)

#### 백분위 추이 차트
- **데이터**: 시험별 평균 백분위
- **시각화**: 라인 차트 (Recharts)
- **X축**: 시험일 + 시험명
- **Y축**: 백분위 (0~100%)

#### 최근 2회 비교 테이블
- **과목별 비교**:
  - 최근 시험 (등급, 백분위)
  - 이전 시험 (등급, 백분위)
  - 변화량 (△ 또는 ▽)

#### 시험별 상세 성적
- 시험일, 시험명, 과목
- 등급, 백분위, 표준점수
- 시간순 정렬

---

## 🔧 분석 유틸리티 함수

### calculateGPATrend()

**위치**: `lib/analysis/scoreAnalyzer.ts`

**역할**: 학기별 GPA 추이 계산 (학점 가중 평균)

**입력**: 내신 성적 배열

**출력**:
```typescript
Array<{
  grade: number;
  semester: number;
  gpa: number;
  term: string;
}>
```

**계산 로직**:
```
GPA = Σ(석차등급 × 학점수) / Σ(학점수)
```

---

### calculateSubjectRanking()

**위치**: `lib/analysis/scoreAnalyzer.ts`

**역할**: 과목별 평균 등급 계산 및 순위 매기기

**입력**: 내신 성적 배열 (과목명, 교과군명 포함)

**출력**:
```typescript
Array<{
  subject_id: string;
  subject_name: string;
  subject_group_name: string;
  average_grade: number;
  count: number;
}>
```

**정렬**: 평균 등급 오름차순 (1등급이 가장 우수)

---

### analyzeWeakPoints()

**위치**: `lib/analysis/scoreAnalyzer.ts`

**역할**: 취약 과목 분석

**입력**: 내신 성적 배열, 기준 등급 (기본값: 5)

**출력**:
```typescript
Array<{
  subject_id: string;
  subject_name: string;
  subject_group_name: string;
  average_grade: number;
  recent_grade: number | null;
  improvement_needed: boolean;
}>
```

**기준**: 평균 등급 >= 기준 등급 (5등급)

---

### analyzeMockTrend()

**위치**: `lib/analysis/scoreAnalyzer.ts`

**역할**: 모의고사 백분위 추이 분석

**입력**: 모의고사 성적 배열 (시간순 정렬)

**출력**:
```typescript
{
  trend: "상승" | "유지" | "하락" | "분석불가";
  recent_average_percentile: number | null;
  change_from_previous: number | null;
}
```

**로직**:
- 최근 3회 평균 백분위 계산
- 이전 3회 평균 백분위와 비교
- 차이가 ±5% 이상이면 상승/하락, 아니면 유지

---

### compareTwoRecentMockScores()

**위치**: `lib/analysis/scoreAnalyzer.ts`

**역할**: 과목별 최근 2회 성적 비교

**입력**: 모의고사 성적 배열 (시간순 정렬)

**출력**:
```typescript
Array<{
  subject_id: string;
  subject_name: string;
  recent_score: { exam_title, grade_score, percentile };
  previous_score: { exam_title, grade_score, percentile } | null;
  change: {
    grade_change: number | null; // 등급은 낮을수록 좋음
    percentile_change: number | null;
  };
}>
```

---

## 📦 데이터 페칭 함수

### getInternalScoresByTerm()

**위치**: `lib/data/scoreDetails.ts`

**역할**: 학기별 내신 성적 조회

**파라미터**:
- `studentId`
- `tenantId`
- `grade` (선택사항)
- `semester` (선택사항)

**반환값**: 내신 성적 배열 (교과군, 과목, 과목구분 정보 JOIN)

---

### getMockScoresByPeriod()

**위치**: `lib/data/scoreDetails.ts`

**역할**: 기간별 모의고사 성적 조회

**파라미터**:
- `studentId`
- `tenantId`
- `startDate` (선택사항, YYYY-MM-DD)
- `endDate` (선택사항, YYYY-MM-DD)
- `grade` (선택사항)

**반환값**: 모의고사 성적 배열 (교과군, 과목 정보 JOIN)

---

## 🎨 차트 구성

### GPA 추이 차트 (InternalGPAChart)

**라이브러리**: Recharts

**설정**:
- Chart Type: LineChart
- Data Key: `gpa`
- X축: `term` (학년-학기)
- Y축: 1~9 (역순, 1등급이 상단)
- 색상: Indigo (#4f46e5)

**반응형**:
- ResponsiveContainer: width 100%, height 300px

---

### 백분위 추이 차트 (MockTrendChart)

**라이브러리**: Recharts

**설정**:
- Chart Type: LineChart
- Data Key: `average_percentile`
- X축: 시험일 + 시험명 (레이블)
- Y축: 0~100 (백분위)
- 색상: Indigo (#6366f1)

**데이터 가공**:
- 시험일별로 그룹화
- 같은 시험의 과목별 백분위 평균 계산

---

## 🔗 관련 파일

### 페이지 및 레이아웃
- `app/(student)/scores/analysis/page.tsx`
- `app/(student)/scores/analysis/_components/AnalysisLayout.tsx`

### 내신 분석 컴포넌트
- `app/(student)/scores/analysis/_components/InternalDetailAnalysis.tsx`
- `app/(student)/scores/analysis/_components/InternalGPAChart.tsx`
- `app/(student)/scores/analysis/_components/InternalSubjectTable.tsx`

### 모의고사 분석 컴포넌트
- `app/(student)/scores/analysis/_components/MockDetailAnalysis.tsx`
- `app/(student)/scores/analysis/_components/MockTrendChart.tsx`
- `app/(student)/scores/analysis/_components/MockComparisonTable.tsx`

### 데이터 및 유틸리티
- `lib/data/scoreDetails.ts`
- `lib/analysis/scoreAnalyzer.ts`

---

## 🚀 사용 시나리오

### 내신 분석 사용 예시

1. 사용자가 `/scores/analysis` 접속
2. 기본적으로 "내신 분석" 탭 표시
3. **GPA 추이 차트**를 통해 학기별 성적 변화 확인
4. **과목별 성적 테이블**에서 우수/미흡 과목 파악
5. "평균 등급" 열 클릭하여 정렬 변경
6. **취약 과목 분석** 섹션에서 개선이 필요한 과목 확인
7. 성적 요약 카드로 전체 현황 파악

### 모의고사 분석 사용 예시

1. 사용자가 `/scores/analysis` 접속
2. "모의고사 분석" 탭 클릭
3. **추이 요약 카드**에서 최근 성적 동향 확인
   - 상승/유지/하락 추세 파악
4. **백분위 추이 차트**로 시간에 따른 성적 변화 시각화
5. **최근 2회 비교 테이블**에서 과목별 상세 변화 확인
   - 등급 변화 (△ 상승, ▽ 하락)
   - 백분위 변화 (수치)
6. **시험별 상세 성적** 테이블에서 전체 응시 기록 조회

---

## 📌 주의사항

1. **데이터 없을 때 처리**: 성적 데이터가 없는 경우 안내 메시지와 함께 "성적 입력하기" 링크 제공

2. **차트 렌더링**: Recharts는 클라이언트 컴포넌트에서만 동작하므로 `"use client"` 지시어 필요

3. **정렬 기능**: 테이블의 정렬은 클라이언트 사이드에서 처리 (useState + useMemo 활용)

4. **데이터 가공**: 서버에서 가져온 raw 데이터를 분석 유틸리티 함수로 가공 후 표시

5. **반응형 디자인**: 차트와 테이블은 작은 화면에서 가로 스크롤 가능

6. **색상 코딩**: 등급별 색상은 통일된 기준 사용
   - 1~2등급: 녹색
   - 3~4등급: 파란색
   - 5~6등급: 노란색
   - 7~9등급: 빨간색

---

## 🔄 향후 개선 가능 사항

1. **필터링 기능**:
   - 학년/학기 필터
   - 교과군 필터
   - 기간 필터 (날짜 범위)

2. **비교 분석**:
   - 전국 평균 대비 비교
   - 학교 평균 대비 비교
   - 학년 평균 대비 비교

3. **예측 기능**:
   - 추세 기반 미래 성적 예측
   - 목표 대학 합격 가능성 계산

4. **인쇄/내보내기**:
   - PDF 리포트 생성
   - Excel 데이터 내보내기

5. **인터랙티브 차트**:
   - 차트 줌/필터
   - 데이터 포인트 클릭 시 상세 정보 표시

---

**마지막 업데이트**: 2024년 11월

