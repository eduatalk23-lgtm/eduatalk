# 성적 분석 + 수시/정시 전략 대시보드 API 구현

## 작업 일시
2025-12-01

## 개요
내신/모의고사 분석 서비스와 수시/정시 유불리 판단 로직, 대시보드 API를 구현했습니다.

---

## 완료된 작업

### 1. `grade_conversion_rules` 테이블 생성

**파일**: `supabase/migrations/20251201000001_create_grade_conversion_rules.sql`

내신 등급을 백분위로 환산하기 위한 매핑 테이블을 생성했습니다.

**주요 컬럼**:
- `curriculum_revision_id`: 교육과정 개정 ID (FK)
- `grade_level`: 내신 등급 (1.0, 1.5, 2.0, 2.5, ...)
- `converted_percentile`: 환산 백분위 (0~100)

**인덱스**:
- `curriculum_revision_id` 인덱스
- `(curriculum_revision_id, grade_level)` 복합 인덱스

---

### 2. 내신 분석 서비스 구현

**파일**: `lib/scores/internalAnalysis.ts`

`student_internal_scores` 테이블을 기반으로 내신 분석을 수행합니다.

#### 주요 기능

**`getInternalAnalysis(tenantId, studentId, studentTermId?)`**

1. **전체 GPA 계산**
   - 공식: `SUM(rank_grade * credit_hours) / SUM(credit_hours)`
   - 가중 평균 등급 계산

2. **Z-Index (학업역량 지수) 계산**
   - 공식: `SUM(((raw_score - avg_score) / std_dev) * credit_hours) / SUM(credit_hours)`
   - 표준화 점수의 가중 평균

3. **교과군별 GPA 계산**
   - `subject_groups`와 조인하여 교과군별로 그룹화
   - 각 교과군의 가중 평균 등급 계산

**반환 타입**:
```typescript
type InternalAnalysis = {
  totalGpa: number | null;
  zIndex: number | null;
  subjectStrength: Record<string, number>; // 교과군명 → GPA
};
```

---

### 3. 모의고사 분석 서비스 구현

**파일**: `lib/scores/mockAnalysis.ts`

`student_mock_scores` 테이블을 기반으로 모의고사 분석을 수행합니다.

#### 주요 기능

**`getMockAnalysis(tenantId, studentId)`**

1. **최근 시험 조회**
   - `exam_date` 기준 내림차순으로 가장 최근 시험 조회

2. **국/수/탐(상위2) 평균 백분위 계산**
   - 국어, 수학, 탐구(사회/과학) 중 상위 2과목의 백분위 평균

3. **국/수/탐(상위2) 표준점수 합 계산**
   - 국어, 수학, 탐구(상위 2과목)의 표준점수 합계

4. **국·수·영·탐 중 상위 3개 등급 합 계산**
   - 등급이 낮을수록 좋으므로 오름차순 정렬 후 상위 3개 합계

**반환 타입**:
```typescript
type MockAnalysis = {
  recentExam: { examDate: string; examTitle: string } | null;
  avgPercentile: number | null;
  totalStdScore: number | null;
  best3GradeSum: number | null;
};
```

---

### 4. 수시/정시 유불리 분석 엔진 구현

**파일**: `lib/scores/admissionStrategy.ts`

내신과 모의고사 성적을 비교하여 수시/정시 전략을 분석합니다.

#### 주요 기능

**`getInternalPercentile(curriculumRevisionId, totalGpa)`**
- `grade_conversion_rules` 테이블에서 가장 가까운 등급을 찾아 백분위로 환산
- 내신 GPA를 비교용 백분위로 변환

**`analyzeAdmissionStrategy(internalPct, mockPct, zIndex)`**
- 내신 백분위와 모의고사 백분위를 비교
- 차이가 5점 이상이면 유불리 판정
- Z-Index가 1.5 이상이고 모의고사가 유리하면 특목/자사고 패턴 판정

**전략 유형**:
- `MOCK_ADVANTAGE`: 모의고사/정시 우위 (차이 > 5점)
- `INTERNAL_ADVANTAGE`: 내신/수시 우위 (차이 < -5점)
- `BALANCED`: 균형형 (-5점 ≤ 차이 ≤ 5점)
- `SPECIAL_HIGH_SCHOOL`: 특목/자사고 패턴 (모의고사 우위 + Z-Index ≥ 1.5)

**반환 타입**:
```typescript
type StrategyResult = {
  type: StrategyType;
  message: string;
  data: {
    internalPct: number | null;
    mockPct: number | null;
    diff: number | null;
  };
};
```

---

### 5. Dashboard API 라우트 구현

**파일**: `app/api/students/[id]/score-dashboard/route.ts`

**엔드포인트**: `GET /api/students/:id/score-dashboard?tenantId=...&termId=...`

#### 요청 파라미터

- `id` (path): 학생 ID
- `tenantId` (query, 필수): 테넌트 ID
- `termId` (query, 선택): 학생 학기 ID (없으면 전체 학기 대상)

#### 응답 예시

```json
{
  "studentProfile": {
    "id": "...",
    "name": "...",
    "grade": 2,
    "schoolType": "HIGH"
  },
  "internalAnalysis": {
    "totalGpa": 2.34,
    "zIndex": 1.8,
    "subjectStrength": {
      "국어": 2.1,
      "수학": 3.0,
      "영어": 2.5,
      "사회": 2.8,
      "과학": 3.2
    }
  },
  "mockAnalysis": {
    "recentExam": {
      "examDate": "2025-06-05",
      "examTitle": "2025-06 모평"
    },
    "avgPercentile": 88.5,
    "totalStdScore": 382,
    "best3GradeSum": 5
  },
  "strategyResult": {
    "type": "MOCK_ADVANTAGE",
    "message": "정시 파이터 전략이 유리합니다. 수능 중심 로드맵이 필요합니다.",
    "data": {
      "internalPct": 80,
      "mockPct": 88.5,
      "diff": 8.5
    }
  }
}
```

#### 처리 흐름

1. 학생 기본 정보 조회 (`students` 테이블)
2. 내신 분석 수행 (`getInternalAnalysis`)
3. `student_terms`에서 `curriculum_revision_id` 조회 (없으면 최근 학기 조회)
4. 내신 백분위 환산 (`getInternalPercentile`)
5. 모의고사 분석 수행 (`getMockAnalysis`)
6. 유불리 전략 분석 (`analyzeAdmissionStrategy`)
7. 응답 조립 및 반환

---

## 주요 구현 사항

### 1. 데이터베이스 스키마

- `student_terms` 테이블의 미니멀 구조 사용 (요구사항에 따라 `class_name`, `homeroom_teacher`, `notes`는 사용하지 않음)
- `student_internal_scores`와 `student_mock_scores` 테이블의 `student_term_id` FK 활용
- `grade_conversion_rules` 테이블 신규 생성

### 2. 계산 로직

**내신 GPA**:
- 가중 평균 등급 계산 (이수단위 기준)
- `rank_grade`와 `credit_hours` 사용

**Z-Index**:
- 표준화 점수의 가중 평균
- `(raw_score - avg_score) / std_dev` 계산 후 이수단위로 가중

**모의고사 통계**:
- 탐구 과목은 상위 2과목만 선택
- 등급 합계는 낮을수록 좋으므로 오름차순 정렬

### 3. 에러 처리

- 각 단계에서 에러 발생 시 `null` 반환 또는 기본값 사용
- 콘솔 로그로 에러 기록
- API 레벨에서 500 에러 반환

### 4. 타입 안전성

- TypeScript 타입 정의 완료
- Supabase 타입 활용
- 명시적 타입 변환 (`Number()` 사용)

---

## 사용 예시

### API 호출

```bash
# 전체 학기 대상
GET /api/students/{studentId}/score-dashboard?tenantId={tenantId}

# 특정 학기 대상
GET /api/students/{studentId}/score-dashboard?tenantId={tenantId}&termId={termId}
```

### TypeScript 사용

```typescript
import { getInternalAnalysis } from "@/lib/scores/internalAnalysis";
import { getMockAnalysis } from "@/lib/scores/mockAnalysis";
import { analyzeAdmissionStrategy, getInternalPercentile } from "@/lib/scores/admissionStrategy";

// 내신 분석
const internal = await getInternalAnalysis(tenantId, studentId, studentTermId);

// 모의고사 분석
const mock = await getMockAnalysis(tenantId, studentId);

// 내신 백분위 환산
const internalPct = await getInternalPercentile(curriculumRevisionId, internal.totalGpa);

// 전략 분석
const strategy = analyzeAdmissionStrategy(internalPct, mock.avgPercentile, internal.zIndex);
```

---

## 향후 개선 사항

1. **캐싱**: 자주 조회되는 분석 결과를 캐싱하여 성능 개선
2. **배치 처리**: 여러 학생의 분석을 한 번에 처리하는 배치 API
3. **히스토리**: 분석 결과를 저장하여 추이 분석 가능
4. **알림**: 전략 변경 시 알림 기능
5. **시각화**: 차트/그래프로 시각화된 대시보드 제공

---

## 참고 사항

- `student_terms` 테이블의 `class_name`, `homeroom_teacher`, `notes` 필드는 사용하지 않음 (요구사항)
- 모의고사 분석에서 교과군명은 실제 DB의 `subject_groups.name`과 일치해야 함
- `grade_conversion_rules` 테이블에 데이터가 없으면 내신 백분위 환산이 불가능함

---

**작업 완료일**: 2025-12-01

