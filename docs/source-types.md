# Source 타입 도메인 정리

## 테이블별 source 컬럼 의미

### 데이터 입력 주체 (`"ai" | "manual"`)

| 테이블 | CHECK 제약 | 기본값 | 의미 |
|---|---|---|---|
| `student_record_competency_scores` | `('ai', 'manual')` | `'manual'` | 역량 등급 입력자 |
| `student_record_diagnosis` | `('ai', 'manual')` | `'manual'` | 종합 진단 생성자 |
| `student_record_activity_tags` | `('ai', 'manual')` | `'manual'` | 활동 태그 부여자 |

- `"ai"` = AI 파이프라인이 자동 생성
- `"manual"` = 컨설턴트가 직접 입력/수정

### 분석 수행 주체 (`"ai" | "consultant"`)

| 테이블 | CHECK 제약 | 기본값 | 의미 |
|---|---|---|---|
| `student_record_analysis_cache` | `('ai', 'consultant')` | `'ai'` | 하이라이트 분석 수행자 |

- `"ai"` = AI 자동 분석 결과 캐시
- `"consultant"` = 컨설턴트가 수동 분석한 결과 캐시

### 계획 출처 (`"auto" | "consultant" | "student" | "import"`)

| 테이블 | CHECK 제약 | 의미 |
|---|---|---|
| `student_record_course_plans` | `('auto', 'consultant', 'student', 'import')` | 수강 계획 출처 |

## UI 레이어 매핑

UI에서 `perspective` 또는 `source` prop으로 사용되는 값:

```
UI perspective="ai"         → DB source="ai"
UI perspective="consultant" → DB source="manual"  (진단/역량/태그 테이블)
UI perspective="consultant" → DB source="consultant"  (분석 캐시 테이블)
```

## 핵심 원칙

- **같은 `source` 컬럼이라도 테이블마다 의미 도메인이 다름**
- 진단/역량/태그: "누가 이 데이터를 입력했는가" (입력 방법)
- 분석 캐시: "누가 이 분석을 수행했는가" (분석 주체)
- 수강 계획: "이 계획이 어디서 왔는가" (출처)
