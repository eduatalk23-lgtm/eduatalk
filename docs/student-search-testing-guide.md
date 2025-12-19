# 학생 검색 기능 테스트 가이드

## 테스트 개요

학생 검색 기능 통합 개선 Phase 1-2-3 구현 완료 후 테스트 가이드입니다.

## 테스트 항목

### 1. 단위 테스트 (Unit Tests)

#### 검색 타입 자동 감지 테스트
- ✅ 숫자만 4자리 이상 → 연락처 검색
- ✅ 한글 포함 → 이름 검색
- ✅ 숫자 + 한글 → 전체 검색
- ✅ 3자리 이하 숫자 → 이름 검색
- ✅ 영문/특수문자 → 이름 검색

**실행 방법:**
```bash
npm test -- __tests__/data/studentSearch.test.ts
```

### 2. 통합 테스트 (Integration Tests)

#### 실제 데이터베이스 연결 테스트

**주의**: 실제 Supabase 데이터베이스 연결이 필요합니다.

**테스트 항목:**
1. 이름 검색 테스트
2. 연락처 검색 테스트 (4자리 부분 매칭)
3. 필터링 테스트 (학년, 반, 구분)
4. 페이지네이션 테스트
5. 매칭 필드 표시 테스트

**실행 방법:**
```bash
# 테스트 환경 변수 설정 필요
NODE_ENV=test npm test -- __tests__/data/studentSearch.test.ts
```

### 3. API 테스트 (API Route Tests)

#### API 엔드포인트 테스트

**엔드포인트**: `GET /api/students/search`

**테스트 시나리오:**

1. **기본 검색 테스트**
```bash
curl -X GET "http://localhost:3000/api/students/search?q=홍길동" \
  -H "Cookie: your-session-cookie"
```

2. **연락처 검색 테스트**
```bash
curl -X GET "http://localhost:3000/api/students/search?q=0101&type=phone" \
  -H "Cookie: your-session-cookie"
```

3. **필터링 테스트**
```bash
curl -X GET "http://localhost:3000/api/students/search?q=홍길동&grade=1&class=1" \
  -H "Cookie: your-session-cookie"
```

4. **페이지네이션 테스트**
```bash
curl -X GET "http://localhost:3000/api/students/search?q=홍&limit=10&offset=0" \
  -H "Cookie: your-session-cookie"
```

5. **권한 테스트**
```bash
# 인증되지 않은 요청
curl -X GET "http://localhost:3000/api/students/search?q=홍길동"
# 예상 응답: 401 Unauthorized

# 학생 계정으로 요청
curl -X GET "http://localhost:3000/api/students/search?q=홍길동" \
  -H "Cookie: student-session-cookie"
# 예상 응답: 403 Forbidden
```

## 수동 테스트 가이드

### 1. 개발 서버 실행

```bash
npm run dev
```

### 2. 브라우저에서 테스트

1. 관리자 계정으로 로그인
2. 개발자 도구 Network 탭 열기
3. 다음 시나리오 테스트:

#### 시나리오 1: 이름 검색
- 검색어: "홍길동"
- 예상 결과: 이름에 "홍길동"이 포함된 학생 목록
- `matched_field`: "name"

#### 시나리오 2: 연락처 검색 (4자리)
- 검색어: "0101"
- 예상 결과: 연락처에 "0101"이 포함된 학생 목록
- `matched_field`: "phone", "mother_phone", "father_phone" 중 하나

#### 시나리오 3: 검색 타입 자동 감지
- 검색어: "01012345678" → 연락처 검색으로 자동 감지
- 검색어: "홍길동" → 이름 검색으로 자동 감지
- 검색어: "홍0101" → 전체 검색으로 자동 감지

#### 시나리오 4: 필터링
- 검색어: "홍길동"
- 필터: 학년="1", 반="1"
- 예상 결과: 학년 1학년, 1반인 학생만 표시

#### 시나리오 5: 페이지네이션
- 검색어: "홍"
- limit: 10, offset: 0 → 첫 페이지
- limit: 10, offset: 10 → 두 번째 페이지
- 예상 결과: 중복 없이 페이지별로 표시

### 3. API 응답 형식 확인

**성공 응답:**
```json
{
  "success": true,
  "data": {
    "students": [
      {
        "id": "student-id",
        "name": "홍길동",
        "grade": "1",
        "class": "1",
        "division": "고등부",
        "phone": "010-1234-5678",
        "mother_phone": "010-1111-2222",
        "father_phone": "010-3333-4444",
        "matched_field": "name"
      }
    ],
    "total": 1
  }
}
```

**에러 응답:**
```json
{
  "success": false,
  "error": "검색어를 입력해주세요."
}
```

## 테스트 체크리스트

### 기능 테스트
- [ ] 이름 검색 정상 동작
- [ ] 연락처 검색 정상 동작 (4자리 부분 매칭)
- [ ] 검색 타입 자동 감지 정상 동작
- [ ] 필터링 정상 동작 (학년, 반, 구분)
- [ ] 페이지네이션 정상 동작
- [ ] 매칭 필드 표시 정상 동작

### 성능 테스트
- [ ] 검색 응답 시간 < 1초 (일반적인 경우)
- [ ] 대량 데이터 검색 시 성능 확인
- [ ] 인덱스 활용 확인 (EXPLAIN 쿼리)

### 보안 테스트
- [ ] 인증되지 않은 요청 차단 (401)
- [ ] 권한 없는 역할 요청 차단 (403)
- [ ] Tenant Context 기반 필터링 확인

### 에러 처리 테스트
- [ ] 빈 검색어 처리
- [ ] 잘못된 파라미터 처리
- [ ] 데이터베이스 에러 처리

## 데이터베이스 인덱스 확인

마이그레이션 실행 후 인덱스 생성 확인:

```sql
-- 인덱스 확인
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'student_profiles'
  AND indexname LIKE '%phone_search%';

-- pg_trgm 확장 확인
SELECT * FROM pg_extension WHERE extname = 'pg_trgm';
```

## 문제 해결

### 인덱스가 생성되지 않은 경우
```bash
# 마이그레이션 수동 실행
npx supabase migration up
```

### 검색 성능이 느린 경우
1. 인덱스 생성 확인
2. EXPLAIN 쿼리로 실행 계획 확인
3. `pg_trgm` 확장 활성화 확인

### 권한 오류가 발생하는 경우
1. 세션 쿠키 확인
2. 역할 확인 (`getCurrentUserRole`)
3. Tenant Context 확인

## 참고 파일
- `lib/data/studentSearch.ts` - 통합 검색 함수
- `app/api/students/search/route.ts` - 검색 API
- `__tests__/data/studentSearch.test.ts` - 테스트 파일
- `supabase/migrations/20251219192242_add_student_phone_search_indexes.sql` - 인덱스 마이그레이션

