# `/contents` 페이지 개선 제안

## 🔍 현재 구현 상태

### 구현된 기능
- ✅ 교재/강의 탭 전환
- ✅ 필터링 (교과, 과목, 학년/학기, 개정교육과정, 출판사/플랫폼, 난이도)
- ✅ 정렬 (생성일 기준)
- ✅ 교재/강의 등록, 수정, 삭제
- ✅ 마스터 콘텐츠 가져오기
- ✅ 상세 페이지 탭 구조

---

## 💡 개선 제안

### 1. 🔎 검색 기능 추가 (우선순위: 높음)

**현재 문제:**
- 필터만 있고 검색어 입력이 없음
- 제목으로 빠르게 찾기 어려움

**제안:**
```typescript
// 검색어 입력 필드 추가
<input
  type="text"
  placeholder="교재명 또는 강의명으로 검색..."
  className="..."
/>
```

**구현 위치:**
- `FilterBar` 컴포넌트 상단에 검색 입력 필드 추가
- `ContentsList`에서 `title` 필드로 `ilike` 검색 적용

**기대 효과:**
- 사용자가 원하는 콘텐츠를 빠르게 찾을 수 있음
- 필터와 검색을 조합하여 더 정확한 결과 제공

---

### 2. 📄 페이지네이션 추가 (우선순위: 중간)

**현재 문제:**
- 모든 항목을 한 번에 로드
- 콘텐츠가 많아지면 성능 저하 가능

**제안:**
```typescript
// 페이지네이션 컴포넌트
<div className="flex items-center justify-between">
  <div>총 {total}개</div>
  <div className="flex gap-2">
    <button>이전</button>
    <span>1 / 5</span>
    <button>다음</button>
  </div>
</div>
```

**구현 방법:**
- URL 쿼리 파라미터로 `page` 관리 (`?page=1`)
- Supabase 쿼리에 `.range()` 적용
- 기본 페이지당 20개 항목 표시

**기대 효과:**
- 대량의 데이터 처리 시 성능 개선
- 사용자 경험 향상

---

### 3. 📊 통계 대시보드 (우선순위: 낮음)

**제안:**
```typescript
// 상단에 통계 카드 추가
<div className="grid grid-cols-3 gap-4 mb-6">
  <StatCard label="총 교재" value={bookCount} />
  <StatCard label="총 강의" value={lectureCount} />
  <StatCard label="연결된 교재" value={linkedCount} />
</div>
```

**표시 정보:**
- 총 교재 수
- 총 강의 수
- 연결된 교재가 있는 강의 수
- 최근 등록된 콘텐츠 수

**기대 효과:**
- 사용자가 한눈에 자신의 콘텐츠 현황 파악
- 학습 관리에 도움

---

### 4. 🎯 정렬 옵션 확장 (우선순위: 중간)

**현재:**
- 생성일 기준 정렬만 가능

**제안:**
```typescript
<select name="sort">
  <option value="created_at_desc">최신순</option>
  <option value="created_at_asc">오래된순</option>
  <option value="title_asc">제목 가나다순</option>
  <option value="title_desc">제목 역순</option>
  <option value="difficulty_asc">난이도 낮은순</option>
  <option value="difficulty_desc">난이도 높은순</option>
</select>
```

**기대 효과:**
- 다양한 기준으로 콘텐츠 정렬 가능
- 사용자 선호도에 맞는 정렬 선택

---

### 5. ✅ 일괄 선택 및 작업 (우선순위: 낮음)

**제안:**
```typescript
// 체크박스로 여러 항목 선택
<div className="flex items-center gap-2">
  <input type="checkbox" />
  <span>전체 선택</span>
  <button>선택 삭제</button>
  <button>선택 내보내기</button>
</div>
```

**기능:**
- 여러 교재/강의 선택
- 일괄 삭제
- 일괄 내보내기 (CSV, JSON 등)

**기대 효과:**
- 대량 작업 시 효율성 향상
- 데이터 백업 용이

---

### 6. 🔗 연결된 교재 표시 개선 (우선순위: 중간)

**현재:**
- 강의 상세 페이지에서만 연결된 교재 확인 가능

**제안:**
```typescript
// 목록에서도 연결된 교재 표시
<ContentCard>
  <div className="flex items-center gap-2">
    <span>🎧 강의명</span>
    {linkedBook && (
      <Link href={`/contents/books/${linkedBook.id}`}>
        📚 {linkedBook.title}
      </Link>
    )}
  </div>
</ContentCard>
```

**기대 효과:**
- 목록에서 바로 연결 관계 확인 가능
- 관련 콘텐츠 간 빠른 이동

---

### 7. 🏷️ 태그/카테고리 시스템 (우선순위: 낮음)

**제안:**
```typescript
// 교재/강의에 태그 추가
<div className="flex gap-2">
  <Tag>수능대비</Tag>
  <Tag>내신대비</Tag>
  <Tag>심화</Tag>
</div>
```

**기능:**
- 사용자 정의 태그 추가
- 태그별 필터링
- 태그별 그룹화

**기대 효과:**
- 더 세밀한 콘텐츠 분류
- 학습 목적에 따른 관리

---

### 8. 📱 반응형 개선 (우선순위: 중간)

**현재:**
- 기본적인 반응형은 구현되어 있음

**제안:**
- 모바일에서 필터를 드로어/모달로 표시
- 카드 레이아웃 최적화
- 터치 친화적인 버튼 크기

---

### 9. 🔄 최근 본 콘텐츠 (우선순위: 낮음)

**제안:**
```typescript
// 상단에 최근 본 콘텐츠 섹션
<div className="mb-6">
  <h3>최근 본 콘텐츠</h3>
  <div className="flex gap-2 overflow-x-auto">
    {recentContents.map(content => (
      <RecentContentCard key={content.id} content={content} />
    ))}
  </div>
</div>
```

**기대 효과:**
- 빠른 재접근
- 학습 연속성 유지

---

### 10. 📤 내보내기/가져오기 기능 (우선순위: 낮음)

**제안:**
```typescript
// 설정 메뉴에 추가
<button>데이터 내보내기 (JSON/CSV)</button>
<button>데이터 가져오기</button>
```

**기능:**
- 모든 교재/강의 정보를 JSON/CSV로 내보내기
- 다른 계정으로 이전 시 유용
- 백업 용도

---

## 🎯 우선순위별 구현 계획

### Phase 1: 핵심 기능 개선
1. ✅ 검색 기능 추가
2. ✅ 페이지네이션 추가
3. ✅ 정렬 옵션 확장

### Phase 2: 사용성 개선
4. ✅ 연결된 교재 표시 개선
5. ✅ 반응형 개선

### Phase 3: 고급 기능
6. ✅ 통계 대시보드
7. ✅ 일괄 작업
8. ✅ 태그 시스템

---

## 💬 추가 제안 사항

### A. 빈 상태 개선
- 현재: 단순한 메시지만 표시
- 제안: 마스터 콘텐츠 추천, 등록 가이드 링크 추가

### B. 로딩 상태 개선
- 현재: 기본 스켈레톤
- 제안: 진행률 표시, 예상 시간 표시

### C. 키보드 단축키
- `Ctrl/Cmd + K`: 검색 포커스
- `Ctrl/Cmd + N`: 새 콘텐츠 등록
- `Esc`: 필터 초기화

### D. 즐겨찾기 기능
- 자주 사용하는 교재/강의 즐겨찾기
- 즐겨찾기 탭 추가

---

## 📝 구현 시 고려사항

1. **성능 최적화**
   - 대량 데이터 처리 시 인덱싱 확인
   - 캐싱 전략 유지

2. **접근성**
   - ARIA 레이블 추가
   - 키보드 네비게이션 지원

3. **사용자 경험**
   - 변경 사항 즉시 피드백
   - 에러 메시지 명확화

4. **데이터 일관성**
   - 삭제 시 연결 관계 확인
   - 외래키 제약 조건 준수

---

어떤 기능부터 구현할까요? 우선순위를 알려주시면 바로 진행하겠습니다! 🚀

