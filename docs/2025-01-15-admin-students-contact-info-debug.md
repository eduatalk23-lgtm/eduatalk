# 관리자 학생 목록 연락처 정보 표시 문제 디버깅

## 문제 상황
`/admin/students` 페이지에서 연락처 정보가 표시되지 않는 문제

## 조사 내용

### 1. 데이터 흐름 확인
- `page.tsx`에서 `getStudentPhonesBatch` 함수를 호출하여 연락처 정보 조회
- `StudentTable` 컴포넌트에서 `student.phone`, `student.mother_phone`, `student.father_phone` 표시

### 2. 연락처 정보 조회 로직
`lib/utils/studentPhoneUtils.ts`의 `getStudentPhonesBatch` 함수:
1. `student_profiles` 테이블에서 연락처 정보 조회 (fallback)
2. `parent_student_links`를 통해 연결된 학부모 정보 조회
3. `auth.users`에서 학부모의 phone 정보 조회
4. 학부모 계정의 phone이 null이 아니면 그것을 사용, 아니면 `student_profiles` 사용

### 3. 디버깅 로그 추가
다음 위치에 디버깅 로그를 추가하여 데이터 조회 여부를 확인할 수 있도록 함:

#### `lib/utils/studentPhoneUtils.ts`
- `student_profiles` 조회 결과 로그
- `parent_student_links` 처리 결과 로그
- 최종 연락처 정보 조회 결과 로그

#### `app/(admin)/admin/students/page.tsx`
- `phoneDataMap` 크기 및 샘플 데이터 로그
- 최종 `studentsWithData`에 포함된 연락처 정보 통계

## 확인 사항

### 1. 데이터베이스 확인
다음 쿼리로 실제 데이터 존재 여부 확인:
```sql
-- student_profiles 테이블에 연락처 정보가 있는지 확인
SELECT id, phone, mother_phone, father_phone 
FROM student_profiles 
WHERE phone IS NOT NULL OR mother_phone IS NOT NULL OR father_phone IS NOT NULL
LIMIT 10;

-- parent_student_links 테이블에 연결 정보가 있는지 확인
SELECT student_id, relation, parent_id 
FROM parent_student_links 
LIMIT 10;

-- auth.users에서 phone 정보가 있는 학부모 확인
-- (Supabase Dashboard에서 확인 필요)
```

### 2. 브라우저 콘솔 확인
개발 서버 실행 후 `/admin/students` 페이지 접속 시 콘솔에 다음 로그가 출력됨:
- `[studentPhoneUtils] student_profiles 조회 성공/실패`
- `[studentPhoneUtils] parent_student_links 처리 완료`
- `[studentPhoneUtils] 연락처 정보 조회 결과`
- `[admin/students] 연락처 정보 전달 결과`

## 다음 단계

1. 브라우저 콘솔에서 로그 확인
2. 데이터베이스 쿼리로 실제 데이터 존재 여부 확인
3. 로그 결과에 따라 추가 조사 필요

## 수정 파일
- `lib/utils/studentPhoneUtils.ts`: 디버깅 로그 추가
- `app/(admin)/admin/students/page.tsx`: 디버깅 로그 추가

