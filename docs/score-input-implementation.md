# 성적 입력 페이지 구현 가이드

## 📋 개요

이 문서는 `/scores/input` 페이지의 구현 내용을 설명합니다. 내신 성적과 모의고사 성적을 입력할 수 있는 통합 인터페이스입니다.

---

## 🏗 구조

### 페이지 레이아웃

```
/scores/input
│
├─ page.tsx (서버 컴포넌트)
│  ├─ 사용자 인증 확인
│  ├─ 개정교육과정 조회
│  └─ 교과 계층 구조 조회
│
└─ _components/
   ├─ ScoreInputLayout.tsx (클라이언트 컴포넌트)
   │  └─ 내신/모의고사 탭 전환
   │
   ├─ InternalScoreInput.tsx (내신 성적 입력)
   │  ├─ 학년/학기 선택
   │  ├─ 과목별 성적 테이블
   │  └─ 저장 액션
   │
   └─ MockScoreInput.tsx (모의고사 성적 입력)
      ├─ 시험 정보 입력
      ├─ 과목별 성적 테이블
      └─ 저장 액션
```

---

## 🗄 데이터 스키마

### student_internal_scores (내신 성적)

| 필드                   | 타입    | 필수 | 설명                        |
| ---------------------- | ------- | ---- | --------------------------- |
| tenant_id              | uuid    | ✅   | 테넌트 ID                   |
| student_id             | uuid    | ✅   | 학생 ID                     |
| student_term_id        | uuid    | ✅   | 학기 ID (자동 생성/조회)    |
| curriculum_revision_id | uuid    | ✅   | 개정교육과정 ID             |
| subject_group_id       | uuid    | ✅   | 교과군 ID                   |
| subject_type_id        | uuid    | ✅   | 과목구분 ID                 |
| subject_id             | uuid    | ✅   | 과목 ID                     |
| grade                  | integer | ✅   | 학년 (1~3)                  |
| semester               | integer | ✅   | 학기 (1~2)                  |
| credit_hours           | number  | ✅   | 학점수 (예: 4)              |
| rank_grade             | integer | ✅   | 석차등급 (1~9)              |
| raw_score              | number  | ❌   | 원점수                      |
| avg_score              | number  | ❌   | 과목평균                    |
| std_dev                | number  | ❌   | 표준편차                    |
| total_students         | integer | ❌   | 수강자수                    |

### student_mock_scores (모의고사 성적)

| 필드             | 타입    | 필수 | 설명                     |
| ---------------- | ------- | ---- | ------------------------ |
| tenant_id        | uuid    | ✅   | 테넌트 ID                |
| student_id       | uuid    | ✅   | 학생 ID                  |
| student_term_id  | uuid    | ❌   | 학기 ID (nullable)       |
| exam_date        | date    | ✅   | 시험일 (YYYY-MM-DD)      |
| exam_title       | string  | ✅   | 시험명 (예: "3월 학력평가") |
| grade            | integer | ✅   | 학년 (1~3)               |
| subject_id       | uuid    | ✅   | 과목 ID                  |
| subject_group_id | uuid    | ✅   | 교과군 ID                |
| grade_score      | integer | ✅   | 등급 (1~9)               |
| standard_score   | integer | ❌   | 표준점수                 |
| percentile       | number  | ❌   | 백분위 (0~100)           |
| raw_score        | number  | ❌   | 원점수                   |

---

## 🔄 데이터 흐름

### 1. 내신 성적 입력 플로우

```
[사용자] → InternalScoreInput (클라이언트)
           ↓
       과목 추가/입력
           ↓
       POST /api/scores/internal
           ↓
       [서버] student_term_id 조회/생성 (getOrCreateStudentTerm)
           ↓
       student_internal_scores 테이블에 일괄 삽입
           ↓
       성공 시 → /scores/dashboard/unified로 리다이렉트
```

### 2. 모의고사 성적 입력 플로우

```
[사용자] → MockScoreInput (클라이언트)
           ↓
       시험 정보 입력 + 과목 추가
           ↓
       POST /api/scores/mock
           ↓
       [서버] student_term_id 조회 (getStudentTerm, nullable)
           ↓
       student_mock_scores 테이블에 일괄 삽입
           ↓
       성공 시 → /scores/dashboard/unified로 리다이렉트
```

---

## 💻 API 엔드포인트

### POST /api/scores/internal

**Request Body:**
```json
{
  "studentId": "uuid",
  "tenantId": "uuid",
  "curriculumRevisionId": "uuid",
  "schoolYear": 2024,
  "scores": [
    {
      "subject_group_id": "uuid",
      "subject_id": "uuid",
      "subject_type_id": "uuid",
      "grade": 2,
      "semester": 1,
      "credit_hours": 4,
      "rank_grade": 2,
      "raw_score": 88.5,
      "avg_score": 75.2,
      "std_dev": 12.3,
      "total_students": 30
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "내신 성적이 저장되었습니다.",
  "data": {
    "internal_scores": [ /* ... */ ]
  }
}
```

### POST /api/scores/mock

**Request Body:**
```json
{
  "studentId": "uuid",
  "tenantId": "uuid",
  "scores": [
    {
      "exam_date": "2024-03-15",
      "exam_title": "3월 학력평가",
      "grade": 3,
      "subject_id": "uuid",
      "subject_group_id": "uuid",
      "grade_score": 2,
      "standard_score": 130,
      "percentile": 95.5,
      "raw_score": 88
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "모의고사 성적이 저장되었습니다.",
  "data": {
    "mock_scores": [ /* ... */ ]
  }
}
```

---

## 🎨 UI/UX 특징

### 내신 성적 입력

1. **학년/학기 선택**: 모든 성적에 공통 적용
2. **과목 추가 버튼**: 동적으로 행 추가
3. **교과군 선택 시 과목 필터링**: 선택한 교과군의 과목만 표시
4. **필수 필드 검증**: 교과군, 과목, 과목구분, 학점, 석차등급
5. **선택 필드**: 원점수, 과목평균, 표준편차, 수강자수

### 모의고사 성적 입력

1. **시험 정보 우선 입력**: 시험일, 시험명, 학년
2. **과목별 성적 입력**: 교과군, 과목, 등급 필수
3. **선택 필드**: 표준점수, 백분위, 원점수
4. **동일 시험의 여러 과목 일괄 입력**: 한 번에 여러 과목 추가 가능

---

## ✅ 유효성 검증

### 클라이언트 사이드

- 필수 필드 누락 확인
- 학점수 > 0
- 석차등급 1~9
- 등급 1~9

### 서버 사이드

- Request Body 필수 파라미터 검증
- 성적 데이터 배열 길이 확인 (최소 1개)
- Database 제약조건 자동 검증

---

## 🔧 주요 함수

### getOrCreateStudentTerm()

**위치**: `lib/data/studentTerms.ts`

**역할**: 학생의 학기 정보를 조회하거나 없으면 생성

**파라미터**:
- `tenant_id`
- `student_id`
- `school_year` (학년도, 예: 2024)
- `grade` (학년, 1~3)
- `semester` (학기, 1~2)
- `curriculum_revision_id`

**반환값**: `student_term_id` (uuid)

### calculateSchoolYear()

**위치**: `lib/data/studentTerms.ts`

**역할**: 날짜로부터 학년도 계산 (한국 학년도는 3월 시작)

**로직**:
- 3월~12월 → 해당 연도
- 1월~2월 → 전년도

---

## 🚀 사용 예시

### 내신 성적 입력 시나리오

1. 사용자가 `/scores/input` 접속
2. "내신 성적" 탭 선택
3. 학년 2, 학기 1 선택
4. "과목 추가" 버튼 클릭
5. 교과군 "국어" 선택 → 과목 "문학" 자동 필터링
6. 과목구분 "공통과목" 선택
7. 학점 4, 석차등급 2 입력
8. 원점수, 평균, 표준편차 등 선택 필드 입력
9. 여러 과목 반복 추가
10. "저장하기" 버튼 클릭
11. → 통합 대시보드로 자동 이동

### 모의고사 성적 입력 시나리오

1. 사용자가 `/scores/input` 접속
2. "모의고사 성적" 탭 선택
3. 시험일 2024-03-15, 시험명 "3월 학력평가", 학년 3 입력
4. "과목 추가" 버튼 클릭
5. 교과군 "수학" 선택 → 과목 "수학Ⅰ" 선택
6. 등급 2, 표준점수 130, 백분위 95.5 입력
7. 다른 과목 반복 추가
8. "저장하기" 버튼 클릭
9. → 통합 대시보드로 자동 이동

---

## 🔗 관련 파일

### 컴포넌트
- `app/(student)/scores/input/page.tsx`
- `app/(student)/scores/input/_components/ScoreInputLayout.tsx`
- `app/(student)/scores/input/_components/InternalScoreInput.tsx`
- `app/(student)/scores/input/_components/MockScoreInput.tsx`

### API
- `app/api/scores/internal/route.ts`
- `app/api/scores/mock/route.ts`

### 타입
- `lib/types/scoreInput.ts`

### 데이터 함수
- `lib/data/subjects.ts`
- `lib/data/studentTerms.ts`

---

## 📌 주의사항

1. **student_term_id 자동 생성**: 내신 성적 입력 시 `getOrCreateStudentTerm()`을 통해 자동으로 생성되며, 모의고사는 nullable입니다.

2. **개정교육과정 의존성**: 교과군, 과목, 과목구분은 모두 개정교육과정에 종속됩니다. 활성화된 개정교육과정 정보가 필요합니다.

3. **일괄 저장**: 여러 과목의 성적을 한 번에 배열로 전송하여 일괄 저장합니다.

4. **에러 처리**: API 에러 발생 시 사용자에게 명확한 에러 메시지를 표시하며, 성공 시 자동으로 대시보드로 이동합니다.

5. **모바일 반응형**: 테이블 형식의 입력 폼은 작은 화면에서 가로 스크롤이 가능하도록 구현되었습니다.

---

**마지막 업데이트**: 2024년 11월

