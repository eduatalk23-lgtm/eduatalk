# master_lecture_id 컬럼 누락 에러 수정

## 문제 상황

### 에러 메시지
```
Could not find the 'master_lecture_id' column of 'lectures' in the schema cache
```

### 원인
- `app/(student)/contents/lectures/[id]/page.tsx`에서 `master_lecture_id` 컬럼을 조회하려고 했지만
- 실제 데이터베이스의 `lectures` 테이블에는 해당 컬럼이 존재하지 않았음
- 문서상으로는 `master_content_id` → `master_lecture_id`로 변경하는 작업이 있었지만, 실제 마이그레이션이 실행되지 않았음

## 해결 방법

### 1. 마이그레이션 파일 생성
- 파일: `supabase/migrations/20251216101211_add_master_lecture_id_to_lectures.sql`
- 내용:
  - `lectures` 테이블에 `master_lecture_id` 컬럼 추가 (uuid, FK to master_lectures)
  - 인덱스 추가 (`idx_lectures_master_lecture_id`)
  - 기존 `master_content_id` 데이터가 있는 경우 자동 마이그레이션

### 2. 마이그레이션 실행
- Supabase MCP를 통해 마이그레이션 적용 완료 (원격 버전: `20251216101211`)
- 컬럼 추가 및 인덱스 생성 완료
- 마이그레이션 히스토리 동기화 완료

## 변경 사항

### 데이터베이스 스키마
```sql
-- lectures 테이블에 추가된 컬럼
master_lecture_id uuid REFERENCES public.master_lectures(id) ON DELETE SET NULL
```

### 인덱스
```sql
CREATE INDEX idx_lectures_master_lecture_id 
  ON public.lectures(master_lecture_id) 
  WHERE master_lecture_id IS NOT NULL;
```

## 영향받는 파일

### 이미 master_lecture_id를 사용 중인 파일
1. `app/(student)/contents/lectures/[id]/page.tsx`
   - Line 30: `master_lecture_id`를 select 문에 포함
   - Line 36, 39: 타입 정의에 `master_lecture_id` 포함
   - Line 51: `master_lecture_id`로 마스터 강의 조회

2. `lib/data/contentMasters.ts`
   - Line 787, 792, 816: `master_lecture_id` 사용

3. `lib/types/lecture.ts`
   - Line 172: `Lecture` 인터페이스에 `master_lecture_id` 정의

## 검증 사항

- [x] 마이그레이션 파일 생성
- [x] 마이그레이션 실행 완료
- [ ] 애플리케이션 재시작 후 에러 해결 확인
- [ ] 기존 데이터 마이그레이션 확인 (master_content_id → master_lecture_id)

## 참고 사항

### master_content_id와 master_lecture_id
- 기존에는 `master_content_id`를 사용했지만, 명확한 네이밍을 위해 `master_lecture_id`로 변경
- 마이그레이션 스크립트는 기존 `master_content_id` 값이 있으면 자동으로 `master_lecture_id`로 복사
- 두 컬럼이 모두 존재하는 경우, `master_lecture_id`를 우선 사용

### 스키마 캐시
- Supabase는 스키마 캐시를 사용하므로, 마이그레이션 후 잠시 기다려야 할 수 있음
- 에러가 계속 발생하면 Supabase 대시보드에서 스키마를 새로고침하거나 애플리케이션을 재시작

## 다음 단계

1. 애플리케이션 재시작
2. 강의 상세 페이지 접근하여 에러 해결 확인
3. 기존 데이터 마이그레이션 상태 확인 (필요시 수동 마이그레이션)

---

**작업 일시**: 2025-12-16 10:12:11  
**마이그레이션 파일**: `20251216101211_add_master_lecture_id_to_lectures.sql`  
**참고**: 원격에 이미 적용된 마이그레이션을 로컬로 동기화하여 해결

