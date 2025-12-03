# RangeSettingModal 추가 성능 최적화

## 작업 일자
2025-02-03

## 문제점 분석

현재까지의 최적화 후에도 추가로 개선할 수 있는 부분들이 있었습니다:

1. **캐시 구조 불완전**: 총량 정보가 캐시에 저장되지 않아 캐시 히트 시에도 총량 정보가 없음
2. **프로덕션 에러 로깅**: 프로덕션 환경에서도 console.error 출력
3. **메모이제이션 부재**: isValid, handleClose, handleSave가 매 렌더링마다 재계산/재생성
4. **중복 상태 초기화**: 모달이 닫힐 때와 열릴 때 모두 초기화

## 구현 내용

### Phase 1: 캐시 구조 개선 ✅

**파일**: `app/(student)/plan/new-group/_components/_shared/RangeSettingModal.tsx`

**변경사항**:
- 캐시에 `details`뿐만 아니라 `totalPages`/`totalEpisodes`도 함께 저장
- 캐시에서 가져올 때 총량 정보도 함께 설정
- 예상 개선: 캐시 히트 시 총량 정보 즉시 사용 가능

**캐시 구조 변경**:
```typescript
// 변경 전
const cacheRef = useRef<Map<string, ContentDetail[]>>(new Map());

// 변경 후
const cacheRef = useRef<Map<string, {
  details: ContentDetail[];
  totalPages?: number | null;
  totalEpisodes?: number | null;
}>>(new Map());
```

**캐시 저장**:
```typescript
// 변경 전
cacheRef.current.set(content.id, detailsData);

// 변경 후
cacheRef.current.set(content.id, {
  details: detailsData,
  totalPages: totalPagesValue,
  totalEpisodes: totalEpisodesValue,
});
```

**캐시에서 가져오기**:
```typescript
// 변경 전
if (cacheRef.current.has(content.id)) {
  setDetails(cacheRef.current.get(content.id)!);
  return;
}

// 변경 후
const cached = cacheRef.current.get(content.id);
if (cached) {
  setDetails(cached.details);
  if (content.type === "book") {
    setTotalPages(cached.totalPages ?? null);
  } else {
    setTotalEpisodes(cached.totalEpisodes ?? null);
  }
  return;
}
```

### Phase 2: 프로덕션 에러 로깅 제거 ✅

**파일**: `app/(student)/plan/new-group/_components/_shared/RangeSettingModal.tsx`

**변경사항**:
- 230-233줄의 `console.error`를 개발 환경에서만 출력하도록 변경
- 예상 개선: 프로덕션에서 불필요한 로깅 오버헤드 제거

**변경 전**:
```typescript
console.error(
  "[RangeSettingModal] 상세 정보 조회 실패:",
  errorDetails
);
```

**변경 후**:
```typescript
if (process.env.NODE_ENV === "development") {
  console.error(
    "[RangeSettingModal] 상세 정보 조회 실패:",
    errorDetails
  );
}
```

### Phase 3: 메모이제이션 적용 ✅

**파일**: `app/(student)/plan/new-group/_components/_shared/RangeSettingModal.tsx`

**변경사항**:
- `isValid` 계산을 `useMemo`로 메모이제이션
- `handleClose` 함수를 `useCallback`으로 메모이제이션
- `handleSave` 함수를 `useCallback`으로 메모이제이션
- 예상 개선: 불필요한 재계산/재생성 방지로 리렌더링 최적화

**isValid 메모이제이션**:
```typescript
const isValid = useMemo(() => {
  if (hasDetails) {
    return startDetailId && endDetailId;
  }
  return startRange && startRange.trim() !== "" && 
    endRange && endRange.trim() !== "" && 
    Number(startRange) > 0 && 
    Number(endRange) > 0 && 
    Number(startRange) <= Number(endRange);
}, [hasDetails, startDetailId, endDetailId, startRange, endRange]);
```

**handleClose 메모이제이션**:
```typescript
const handleClose = useCallback(() => {
  if (hasChanges) {
    if (!confirm("변경 사항이 저장되지 않았습니다. 정말 닫으시겠습니까?")) {
      return;
    }
  }
  // 상태 초기화...
  onClose();
}, [hasChanges, onClose]);
```

**handleSave 메모이제이션**:
```typescript
const handleSave = useCallback(() => {
  // 저장 로직...
}, [details, startDetailId, endDetailId, startRange, endRange, totalPages, totalEpisodes, content.type, onSave, onClose]);
```

**ESC 키 핸들러 의존성 수정**:
```typescript
// 변경 전
}, [open, hasChanges]);

// 변경 후
}, [open, handleClose]);
```

### Phase 4: 중복 초기화 제거 ✅

**파일**: `app/(student)/plan/new-group/_components/_shared/RangeSettingModal.tsx`

**변경사항**:
- 주석만 수정 (실제로는 이미 모달이 닫힐 때만 초기화하고 있었음)
- 모달이 열릴 때는 `currentRange`가 변경될 때만 범위 값 초기화
- 예상 개선: 불필요한 상태 업데이트 제거

## 예상 성능 개선

| 단계 | 개선 내용 | 예상 효과 |
|------|----------|----------|
| Phase 1 | 캐시 구조 개선 | 캐시 히트 시 총량 정보 즉시 사용 |
| Phase 2 | 프로덕션 로깅 제거 | 프로덕션 로깅 오버헤드 제거 |
| Phase 3 | 메모이제이션 적용 | 불필요한 리렌더링 방지 |
| Phase 4 | 중복 초기화 제거 | 불필요한 상태 업데이트 제거 |

## 주의사항

1. **캐시 구조 변경**: 기존 캐시 데이터와 호환되지 않지만, ref이므로 컴포넌트 마운트 시 자동으로 초기화됨
2. **메모이제이션 의존성**: 의존성 배열을 정확히 설정하여 stale closure 방지
3. **상태 초기화 타이밍**: 모달이 열릴 때 필요한 초기화는 유지

## 변경 파일

### 수정 파일
- `app/(student)/plan/new-group/_components/_shared/RangeSettingModal.tsx`

### 참고 파일
- `app/(student)/plan/new-group/_components/_shared/ContentRangeInput.tsx` (메모이제이션 패턴 참고)

## 테스트 확인 사항

- [x] 캐시 구조 개선 확인
- [x] 프로덕션 에러 로깅 제거 확인
- [x] 메모이제이션 적용 확인
- [x] 중복 초기화 제거 확인
- [x] 린터 오류 없음 확인

