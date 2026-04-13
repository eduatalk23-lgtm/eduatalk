import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// 커스텀 룰: "use server" 모듈에서 type re-export 금지.
// Next.js는 "use server" 파일의 모든 named export를 런타임 참조로 처리한다.
// import type 로 지워진 심볼을 export type 로 재-export 하면 런타임에
// ReferenceError 를 일으킨다 (CLAUDE.md 및 과거 이슈 750ac11f, 58586dcb, 9558e99e).
const noUseServerTypeReexport = {
  meta: {
    type: "problem",
    docs: {
      description:
        'Disallow "export type" in files with top-level "use server" directive',
    },
    schema: [],
    messages: {
      forbidden:
        '"use server" 모듈에서 type export 금지. Next.js가 런타임 값 참조로 처리하여 ReferenceError 발생. 타입은 별도 파일(.types.ts 등)에서 export 하고, 소비자는 원천에서 직접 import.',
    },
  },
  create(context) {
    let isUseServer = false;
    return {
      Program(node) {
        const first = node.body[0];
        if (
          first &&
          first.type === "ExpressionStatement" &&
          (first.directive === "use server" ||
            (first.expression &&
              first.expression.type === "Literal" &&
              first.expression.value === "use server"))
        ) {
          isUseServer = true;
        }
      },
      ExportNamedDeclaration(node) {
        if (!isUseServer) return;
        // export type { Foo }  또는  export type { Foo } from "..."
        // (로컬 선언은 제외: export type Foo = ..., export interface Foo 는 SWC가 strip)
        if (node.exportKind === "type" && !node.declaration) {
          context.report({ node, messageId: "forbidden" });
          return;
        }
        // export { type Foo, bar } 혼합 지정자에서 type 지정자만 플래그
        if (node.specifiers && node.specifiers.length) {
          for (const spec of node.specifiers) {
            if (spec.exportKind === "type") {
              context.report({ node: spec, messageId: "forbidden" });
            }
          }
        }
      },
    };
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Custom ignores to prevent memory overflow:
    "python/**",
    ".venv/**",
    "**/site-packages/**",
    "node_modules/**",
    // Generated / external — lint 대상 아님
    "lib/supabase/database.types.ts",
    "serena/**",
  ]),
  {
    plugins: {
      local: {
        rules: {
          "no-use-server-type-reexport": noUseServerTypeReexport,
        },
      },
    },
    rules: {
      // "use server" 모듈의 type export 금지 (런타임 ReferenceError 방지)
      "local/no-use-server-type-reexport": "error",
      // React Compiler 미사용 — 컴파일러 전용 린트 규칙 비활성화
      "react-hooks/error-boundaries": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/static-components": "off",
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
      // 점진적 개선 대상: error → warn (CI 비차단, 코드 리뷰 시 확인)
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-this-alias": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/no-unsafe-function-type": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "react/no-unescaped-entities": "warn",
      "@next/next/no-assign-module-variable": "warn",
      "@next/next/no-img-element": "warn",
      // let→const 강제: 선언과 할당 분리 패턴(try-catch 등)에서 오탐 발생
      "prefer-const": "warn",
      // Spacing-First 정책: margin 클래스 사용 금지
      // 형제 요소 간격은 부모의 gap으로, 외곽 여백은 최상단 래퍼의 padding으로 관리
      "no-restricted-syntax": [
        "warn", // error 대신 warn으로 설정하여 기존 코드와의 호환성 유지
        {
          // JSX className 속성의 문자열 리터럴에서 margin 클래스 감지
          selector:
            'JSXAttribute[name.name="className"] > Literal[value=/\\b(mt|mb|ml|mr|mx|my)-\\d+/]',
          message:
            "Spacing-First 정책: margin 클래스를 사용하지 마세요. 형제 요소 간격은 부모의 gap으로, 외곽 여백은 최상단 래퍼의 padding으로 관리하세요.",
        },
        {
          // Template literal에서 margin 클래스 감지
          selector:
            'TemplateLiteral[expressions.length=0] > TemplateElement[value.raw=/\\b(mt|mb|ml|mr|mx|my)-\\d+/]',
          message:
            "Spacing-First 정책: margin 클래스를 사용하지 마세요. 형제 요소 간격은 부모의 gap으로, 외곽 여백은 최상단 래퍼의 padding으로 관리하세요.",
        },
        {
          // 일반 문자열 리터럴에서 margin 클래스 감지 (className 변수 등)
          selector:
            'Literal[value=/\\b(mt|mb|ml|mr|mx|my)-\\d+/]',
          message:
            "Spacing-First 정책: margin 클래스를 사용하지 마세요. 형제 요소 간격은 부모의 gap으로, 외곽 여백은 최상단 래퍼의 padding으로 관리하세요.",
        },
        {
          // 하드코딩된 색상 클래스 사용 금지 (gray-*, indigo-*, red-*, blue-*, yellow-*, green-*, amber-* 등)
          // 디자인 시스템 토큰 사용 권장: --color-*, --text-primary, --text-secondary 등, semantic colors (primary-*, error-*, warning-*, success-*, info-*)
          selector:
            'JSXAttribute[name.name="className"] > Literal[value=/\\b(text|bg|border)-(gray|indigo|red|blue|yellow|green|amber|orange|purple|pink|teal|cyan|emerald|lime|violet|fuchsia|rose|sky|slate|zinc|neutral|stone)-\\d+/]',
          message:
            "디자인 시스템 정책: 하드코딩된 색상 클래스를 사용하지 마세요. 디자인 시스템 토큰을 사용하세요: --color-*, --text-primary, --text-secondary 등, semantic colors (primary-*, error-*, warning-*, success-*, info-*).",
        },
        {
          // Template literal에서 하드코딩된 색상 클래스 감지
          selector:
            'TemplateLiteral[expressions.length=0] > TemplateElement[value.raw=/\\b(text|bg|border)-(gray|indigo|red|blue|yellow|green|amber|orange|purple|pink|teal|cyan|emerald|lime|violet|fuchsia|rose|sky|slate|zinc|neutral|stone)-\\d+/]',
          message:
            "디자인 시스템 정책: 하드코딩된 색상 클래스를 사용하지 마세요. 디자인 시스템 토큰을 사용하세요: --color-*, --text-primary, --text-secondary 등, semantic colors (primary-*, error-*, warning-*, success-*, info-*).",
        },
        {
          // 일반 문자열 리터럴에서 하드코딩된 색상 클래스 감지
          selector:
            'Literal[value=/\\b(text|bg|border)-(gray|indigo|red|blue|yellow|green|amber|orange|purple|pink|teal|cyan|emerald|lime|violet|fuchsia|rose|sky|slate|zinc|neutral|stone)-\\d+/]',
          message:
            "디자인 시스템 정책: 하드코딩된 색상 클래스를 사용하지 마세요. 디자인 시스템 토큰을 사용하세요: --color-*, --text-primary, --text-secondary 등, semantic colors (primary-*, error-*, warning-*, success-*, info-*).",
        },
      ],
    },
  },
]);

export default eslintConfig;
