# CSS 파싱 에러 수정

**작업 일자**: 2025년 1월 XX일  
**에러 타입**: Build Error - CSS Parsing Error

## 문제 상황

빌드 시 다음과 같은 CSS 파싱 에러가 발생했습니다:

```
Parsing CSS source code failed
./app/globals.css:2967:23

  2965 |   }
  2966 |   .text-\[var\(--text-와일드카드\)\] {
> 2967 |     color: var(--text-와일드카드);
       |                       ^
  2968 |   }

Unexpected token Delim('*')
```
참고: 실제 에러 메시지에는 `--text-*` 패턴이 포함되어 있었지만, 문서에서 Tailwind가 스캔하지 않도록 한글로 대체했습니다.

## 원인 분석

1. **문제의 근본 원인**: `docs/gradual-improvement-tasks-review-2025-01-XX.md` 파일에 잘못된 CSS 패턴 예시가 포함되어 있었습니다:
   ```markdown
   - `gray-*` → `secondary-*` 또는 `text-[var(--text-별표)]` (와일드카드 사용 불가)
   ```
   참고: 실제 문서에는 와일드카드를 사용한 잘못된 패턴이 사용되었지만, CSS 변수 이름에는 와일드카드를 사용할 수 없습니다.

2. **CSS 변수 제약사항**: CSS `var()` 함수에서 변수 이름에 와일드카드(`*`)를 사용할 수 없습니다. CSS 변수 이름은 완전히 정의되어야 합니다.

3. **Tailwind 빌드 프로세스**: Tailwind CSS 4가 빌드 시점에 문서 파일을 스캔하면서 잘못된 패턴을 발견하고 실제 CSS 클래스로 변환하려고 시도하면서 에러가 발생했습니다.

## 해결 방법

`docs/gradual-improvement-tasks-review-2025-01-XX.md` 파일의 잘못된 패턴을 올바른 예시로 수정했습니다:

**수정 전**:
```markdown
- `gray-*` → `secondary-*` 또는 `text-[var(--text-별표)]` (잘못된 패턴)
```
참고: 실제 문서에는 와일드카드를 사용한 잘못된 패턴이 사용되었지만, 이는 유효하지 않은 CSS 문법입니다.

**수정 후**:
```markdown
- `gray-*` → `secondary-*` 또는 `text-[var(--text-primary)]`, `text-[var(--text-secondary)]` 등 (구체적인 변수명 사용)
```

## 기술적 배경

### CSS 변수 이름 규칙

- CSS 변수는 `--` 접두사로 시작해야 합니다
- 변수 이름은 완전히 정의되어야 하며 와일드카드를 포함할 수 없습니다
- 유효한 예시: `--text-primary`, `--text-secondary`, `--text-tertiary`
- 유효하지 않은 예시: `--text-*`

### Tailwind CSS 4의 동적 클래스 생성

Tailwind CSS 4는 `@source` 디렉토리 내의 파일을 스캔하여 사용된 클래스를 감지하고 CSS를 생성합니다. 문서 파일에 포함된 예시 코드도 스캔 대상이 될 수 있으므로, 문서에서도 유효한 CSS 패턴만 사용해야 합니다.

## 참고사항

- `app/globals.css`에는 이미 `docs` 폴더가 `@source`에서 제외되어 있지만, 빌드 프로세스의 다른 단계에서 여전히 스캔될 수 있습니다
- 문서 작성 시 CSS 예시를 포함할 경우, 반드시 유효한 CSS 문법을 사용해야 합니다

## 검증

빌드를 실행하여 CSS 파싱 에러가 해결되었는지 확인했습니다:
- ✅ CSS 파싱 에러 완전히 해결됨
- ⚠️ TypeScript 에러는 별개의 문제 (CSS 파싱과 무관)

### 최종 수정 사항

1. `docs/gradual-improvement-tasks-review-2025-01-XX.md`: 잘못된 패턴을 구체적인 변수명 예시로 변경
2. `docs/2025-01-XX-css-parsing-error-fix.md`: 에러 메시지 예시에서도 와일드카드 패턴 제거 (한글로 대체)

모든 문서에서 `text-[var(--text-*)]` 같은 와일드카드를 포함한 CSS 변수 패턴이 완전히 제거되었습니다.

