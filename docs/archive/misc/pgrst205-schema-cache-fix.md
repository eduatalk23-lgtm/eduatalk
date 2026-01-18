# PGRST205 스키마 캐시 에러 해결 가이드

## 문제 상황

`PGRST205: Could not find the table 'public.student_school_scores' in the schema cache` 에러가 발생합니다.

## 원인

PostgREST가 스키마 캐시를 갱신하지 못하여 새로 생성된 테이블이나 변경된 스키마를 인식하지 못하는 경우입니다.

## 해결 방법

### 방법 1: Supabase Dashboard에서 스키마 새로고침 (권장)

1. [Supabase Dashboard](https://app.supabase.com) 접속
2. 프로젝트 선택
3. **Settings** → **API** 메뉴로 이동
4. **Reload Schema** 버튼 클릭 (또는 **Refresh Schema Cache**)

### 방법 2: PostgREST 재시작

Supabase Dashboard에서:
1. **Settings** → **Database** → **Connection Pooling**
2. 또는 Supabase 지원팀에 문의하여 PostgREST 재시작 요청

### 방법 3: 임시 해결책

스키마 캐시가 갱신될 때까지 기다리거나, 다른 방법으로 테이블에 접근:

```typescript
// 직접 SQL 쿼리 사용 (Service Role Key 필요)
const { data, error } = await supabase.rpc('exec_sql', {
  query: 'SELECT * FROM student_school_scores LIMIT 1'
});
```

## 확인 사항

1. **프로젝트 URL 확인**
   - `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL`이 올바른 프로젝트를 가리키는지 확인
   - MCP와 실제 프로젝트가 다른 경우 문제가 발생할 수 있음

2. **Service Role Key 확인**
   - `SUPABASE_SERVICE_ROLE_KEY`가 올바른 프로젝트의 키인지 확인
   - Supabase Dashboard → Settings → API → service_role key

3. **테이블 존재 확인**
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
     AND table_name = 'student_school_scores';
   ```

## 참고

- PGRST205 에러는 일반적으로 일시적인 문제이며, Supabase Dashboard에서 스키마를 새로고침하면 해결됩니다.
- 테이블이 최근에 생성된 경우 몇 분 정도 기다린 후 다시 시도해보세요.

