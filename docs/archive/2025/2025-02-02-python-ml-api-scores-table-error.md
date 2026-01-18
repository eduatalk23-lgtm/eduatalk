# Python ML API `scores` 테이블 에러 조사 보고서

**작성일**: 2025-02-02
**문제 발생 위치**: Python ML API (`python/src/db_connector.py`)
**에러 코드**: `PGRST205`

---

## ✅ 해결 완료

**해결일**: 2026-01-06
**해결 방법**: 옵션 1 - 통합 뷰 생성

### 적용된 마이그레이션

**파일**: `supabase/migrations/20260106120000_create_scores_unified_view.sql`

```sql
CREATE OR REPLACE VIEW scores AS
-- Internal scores (내신 성적)
SELECT
    sis.id, sis.student_id, sis.tenant_id,
    s.name AS subject,
    COALESCE(sis.raw_score, 0) AS score,
    sis.rank_grade, sis.created_at,
    'internal'::TEXT AS score_type
    -- ... (추가 필드)
FROM student_internal_scores sis
LEFT JOIN subjects s ON s.id = sis.subject_id

UNION ALL

-- Mock scores (모의고사 성적)
SELECT
    sms.id, sms.student_id, sms.tenant_id,
    s.name AS subject,
    COALESCE(sms.raw_score, 0) AS score,
    sms.grade_score AS rank_grade, sms.created_at,
    'mock'::TEXT AS score_type
    -- ... (추가 필드)
FROM student_mock_scores sms
LEFT JOIN subjects s ON s.id = sms.subject_id;
```

### 검증 결과

- ✅ 뷰 생성 완료
- ✅ Mock 성적 5개 레코드 확인
- ✅ TypeScript 타입 재생성 완료 (`lib/supabase/database.types.ts`)
- ✅ Python ML API 코드 변경 없이 해결

---

## 📋 문제 요약

Python ML API에서 성적 데이터를 조회할 때 `public.scores` 테이블을 찾을 수 없다는 에러가 발생하고 있습니다.

### 발생 에러

```
Content recommendation error: Error: {'message': "Could not find the table 'public.scores' in the schema cache", 'code': 'PGRST205', 'hint': "Perhaps you meant the table 'public.lectures'", 'details': None}
```

```
Get predictable subjects error: Error: {'message': "Could not find the table 'public.scores' in the schema cache", 'code': 'PGRST205', 'hint': "Perhaps you meant the table 'public.lectures'", 'details': None}
```

---

## 🔍 원인 분석

### 1. 데이터베이스 스키마 불일치

**현재 데이터베이스 구조**:

- ✅ `student_internal_scores` - 내신 성적 테이블
- ✅ `student_mock_scores` - 모의고사 성적 테이블
- ❌ `scores` - **존재하지 않음**

**Python ML API 코드**:

```python:100:112:python/src/db_connector.py
def get_student_scores(
    self, student_id: str, limit: int = 100
) -> pd.DataFrame:
    """학생 성적 조회"""
    response = (
        self.client.table("scores")  # ❌ 존재하지 않는 테이블 참조
        .select("*")
        .eq("student_id", student_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return pd.DataFrame(response.data)
```

### 2. 영향받는 API 엔드포인트

다음 엔드포인트들이 `get_student_scores()` 메서드를 사용하여 에러가 발생합니다:

1. **예측 가능한 과목 목록** (`/api/predictions/subjects/{student_id}`)

   ```python:171:196:python/src/api/routes/predictions.py
   @router.get("/subjects/{student_id}")
   async def get_predictable_subjects(student_id: str) -> dict[str, Any]:
       try:
           db = get_connector()
           scores_df = db.get_student_scores(student_id)  # ❌ 에러 발생
   ```

2. **콘텐츠 추천** (`/api/recommendations/content`)

   ```python:86:145:python/src/api/routes/recommendations.py
   @router.post("/content", response_model=ContentRecommendationResponse)
   async def recommend_content(
       request: ContentRecommendationRequest,
   ) -> ContentRecommendationResponse:
       try:
           db = get_connector()
           recommender = ContentRecommender()
           scores_df = db.get_student_scores(request.student_id)  # ❌ 에러 발생
   ```

3. **성적 예측** (`/api/predictions/score`)

   ```python:64:117:python/src/api/routes/predictions.py
   @router.post("/score", response_model=ScorePredictionResponse)
   async def predict_score(request: ScorePredictionRequest) -> ScorePredictionResponse:
       try:
           db = get_connector()
           predictor = ScorePredictor()
           scores_df = db.get_student_scores(request.student_id)  # ❌ 에러 발생
   ```

4. **취약 과목 조회** (`/api/recommendations/weak-subjects/{student_id}`)

   ```python:209:238:python/src/api/routes/recommendations.py
   @router.get("/weak-subjects/{student_id}")
   async def get_weak_subjects(student_id: str) -> dict[str, Any]:
       try:
           db = get_connector()
           scores_df = db.get_student_scores(student_id)  # ❌ 에러 발생
   ```

5. **학습 플랜 추천** (`/api/recommendations/study-plan`)
   ```python:148:206:python/src/api/routes/recommendations.py
   @router.post("/study-plan", response_model=StudyPlanRecommendationResponse)
   async def recommend_study_plan(
       request: StudyPlanRecommendationRequest,
   ) -> StudyPlanRecommendationResponse:
       try:
           db = get_connector()
           scores_df = db.get_student_scores(request.student_id)  # ❌ 에러 발생
   ```

### 3. 테이블 구조 차이

**레거시 `scores` 테이블 (존재하지 않음)**:

- 단일 테이블에 모든 성적 데이터 저장
- `subject` 필드로 과목 구분

**현재 스키마**:

- `student_internal_scores`: 내신 성적 (과목 ID 기반)
- `student_mock_scores`: 모의고사 성적 (과목 ID 기반)
- 정규화된 구조로 `subject_id`, `subject_group_id` 등 사용

---

## 🛠 해결 방안

### 옵션 1: 통합 뷰 생성 (권장)

두 테이블을 통합하는 데이터베이스 뷰를 생성하여 Python ML API가 기존 코드를 최소한으로 수정하고 사용할 수 있도록 합니다.

```sql
-- 통합 성적 뷰 생성
CREATE OR REPLACE VIEW scores AS
SELECT
    id,
    student_id,
    tenant_id,
    subject_id,
    subject_group_id,
    -- 과목명은 subjects 테이블과 조인 필요
    (SELECT name FROM subjects WHERE id = student_internal_scores.subject_id) as subject,
    grade,
    semester,
    raw_score as score,
    avg_score,
    std_dev,
    rank_grade,
    created_at,
    'internal' as score_type
FROM student_internal_scores

UNION ALL

SELECT
    id,
    student_id,
    tenant_id,
    subject_id,
    subject_group_id,
    (SELECT name FROM subjects WHERE id = student_mock_scores.subject_id) as subject,
    grade,
    NULL as semester,
    raw_score as score,
    NULL as avg_score,
    NULL as std_dev,
    grade_score as rank_grade,
    created_at,
    'mock' as score_type
FROM student_mock_scores;
```

**장점**:

- Python ML API 코드 수정 최소화
- 기존 로직 유지 가능
- 데이터베이스 레벨에서 통합 관리

**단점**:

- 뷰 성능 고려 필요
- 과목명 조인으로 인한 성능 저하 가능

### 옵션 2: Python 코드 수정

`db_connector.py`의 `get_student_scores()` 메서드를 수정하여 두 테이블을 조합합니다.

```python
def get_student_scores(
    self, student_id: str, limit: int = 100
) -> pd.DataFrame:
    """학생 성적 조회 (내신 + 모의고사 통합)"""
    # 내신 성적 조회
    internal_response = (
        self.client.table("student_internal_scores")
        .select("*, subjects!inner(name)")
        .eq("student_id", student_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )

    # 모의고사 성적 조회
    mock_response = (
        self.client.table("student_mock_scores")
        .select("*, subjects!inner(name)")
        .eq("student_id", student_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )

    # DataFrame 변환 및 통합
    internal_df = pd.DataFrame(internal_response.data)
    mock_df = pd.DataFrame(mock_response.data)

    # 컬럼명 통일 (subject 필드 추가)
    if not internal_df.empty:
        internal_df['subject'] = internal_df['subjects']['name']
        internal_df['score'] = internal_df['raw_score']
        internal_df['score_type'] = 'internal'

    if not mock_df.empty:
        mock_df['subject'] = mock_df['subjects']['name']
        mock_df['score'] = mock_df['raw_score']
        mock_df['score_type'] = 'mock'

    # 통합 및 정렬
    combined_df = pd.concat([internal_df, mock_df], ignore_index=True)
    combined_df = combined_df.sort_values('created_at', ascending=False).head(limit)

    return combined_df
```

**장점**:

- 데이터베이스 뷰 불필요
- 더 세밀한 제어 가능

**단점**:

- 코드 복잡도 증가
- 두 번의 쿼리 실행으로 인한 성능 고려

### 옵션 3: 별도 메서드 분리

내신 성적과 모의고사 성적을 별도로 조회하는 메서드를 만들고, 필요에 따라 통합하는 방식입니다.

```python
def get_student_internal_scores(
    self, student_id: str, limit: int = 100
) -> pd.DataFrame:
    """학생 내신 성적 조회"""
    # 구현...

def get_student_mock_scores(
    self, student_id: str, limit: int = 100
) -> pd.DataFrame:
    """학생 모의고사 성적 조회"""
    # 구현...

def get_all_student_scores(
    self, student_id: str, limit: int = 100
) -> pd.DataFrame:
    """학생 전체 성적 조회 (내신 + 모의고사)"""
    internal_df = self.get_student_internal_scores(student_id, limit)
    mock_df = self.get_student_mock_scores(student_id, limit)
    # 통합 로직...
```

---

## 📊 데이터 매핑

### 필드 매핑 테이블

| 레거시 `scores` | `student_internal_scores` | `student_mock_scores`  | 비고             |
| --------------- | ------------------------- | ---------------------- | ---------------- |
| `id`            | `id`                      | `id`                   | -                |
| `student_id`    | `student_id`              | `student_id`           | -                |
| `subject`       | `subjects.name` (조인)    | `subjects.name` (조인) | 텍스트 → ID 기반 |
| `score`         | `raw_score`               | `raw_score`            | -                |
| `created_at`    | `created_at`              | `created_at`           | -                |
| `grade`         | `grade`                   | `grade`                | -                |
| -               | `semester`                | -                      | 내신 전용        |
| -               | `avg_score`               | -                      | 내신 전용        |
| -               | `std_dev`                 | -                      | 내신 전용        |
| -               | `rank_grade`              | `grade_score`          | -                |
| -               | `exam_date`               | -                      | 모의고사 전용    |
| -               | `exam_title`              | -                      | 모의고사 전용    |

---

## ✅ 권장 해결책

**옵션 1 (통합 뷰 생성)**을 권장합니다:

1. **즉시 적용 가능**: Python 코드 수정 없이 데이터베이스 레벨에서 해결
2. **하위 호환성**: 기존 Python ML API 코드 유지
3. **유지보수 용이**: 뷰를 통해 스키마 변경 시에도 Python 코드 영향 최소화

### 구현 단계

1. **마이그레이션 파일 생성**

   ```bash
   # 시스템 타임스탬프 사용
   supabase migration new create_scores_view
   ```

2. **뷰 생성 SQL 작성**
   - `student_internal_scores`와 `student_mock_scores` 통합
   - `subjects` 테이블과 조인하여 과목명 포함
   - Python ML API가 기대하는 필드 구조 제공

3. **테스트**
   - Python ML API 엔드포인트 테스트
   - 성능 테스트 (인덱스 확인)

4. **배포**
   - 마이그레이션 적용
   - Python ML API 재시작

---

## 🔗 관련 문서

- [성적 관리 시스템 아키텍처 문서](./score-architecture.md)
- [성적 스키마 마이그레이션 가이드](./score-schema-migration.md)
- [성적 테이블 정규화 마이그레이션 가이드](./score-tables-normalization-migration.md)

---

## 📝 추가 고려사항

1. **성능 최적화**
   - 뷰 사용 시 인덱스 활용 확인
   - 필요시 머티리얼라이즈드 뷰 고려

2. **데이터 일관성**
   - 내신과 모의고사 성적의 필드 차이 처리
   - NULL 값 처리 로직

3. **향후 확장성**
   - 새로운 성적 유형 추가 시 뷰 확장 용이성
   - Python ML API와의 인터페이스 유지

---

**작성자**: AI Assistant  
**검토 필요**: Python ML API 팀, 데이터베이스 팀
