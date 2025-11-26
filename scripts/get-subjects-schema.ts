/**
 * 실제 Supabase 데이터베이스에서 subjects 테이블 스키마 조회
 * 
 * 실행 방법:
 * npx tsx scripts/get-subjects-schema.ts
 */

import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// 환경 변수 로드 (.env.local 우선)
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

// 환경 변수 직접 사용
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("❌ 환경 변수가 설정되지 않았습니다.");
  console.error("   NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY가 필요합니다.");
  process.exit(1);
}

function createSupabaseAdminClient() {
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function getSubjectsSchema() {
  console.log("🔍 Supabase subjects 테이블 스키마 조회 중...\n");

  const adminClient = createSupabaseAdminClient();

  if (!adminClient) {
    console.error("❌ Admin Client를 생성할 수 없습니다.");
    console.error("   SUPABASE_SERVICE_ROLE_KEY 환경 변수를 확인해주세요.");
    process.exit(1);
  }

  try {
    // 1. 샘플 데이터 조회로 스키마 추론
    console.log("📊 샘플 데이터 조회 중...\n");
    const { data: sampleData, error: sampleError } = await adminClient
      .from("subjects")
      .select("*")
      .limit(5);

    if (sampleError) {
      console.error("❌ 데이터 조회 실패:", sampleError.message);
      console.error("   상세:", sampleError);
      return;
    }

    if (!sampleData || sampleData.length === 0) {
      console.log("⚠️  테이블이 비어있습니다. 구조만 확인합니다.\n");
      
      // 빈 테이블이어도 구조는 확인 가능
      const { data: emptyData, error: emptyError } = await adminClient
        .from("subjects")
        .select("*")
        .limit(0);
      
      if (emptyError) {
        console.error("❌ 테이블 접근 실패:", emptyError.message);
        return;
      }
    }

    // 2. 실제 데이터로 스키마 분석
    if (sampleData && sampleData.length > 0) {
      const firstRow = sampleData[0];
      const schema: Record<string, {
        type: string;
        nullable: boolean;
        sampleValues: any[];
      }> = {};

      // 모든 행을 분석하여 타입 추론
      sampleData.forEach((row: any) => {
        Object.keys(row).forEach((key) => {
          if (!schema[key]) {
            schema[key] = {
              type: inferType(row[key]),
              nullable: row[key] === null,
              sampleValues: []
            };
          }
          
          if (row[key] !== null && schema[key].sampleValues.length < 3) {
            schema[key].sampleValues.push(row[key]);
          }
          
          if (row[key] === null) {
            schema[key].nullable = true;
          }
        });
      });

      console.log("=" .repeat(80));
      console.log("✅ subjects 테이블 스키마 (실제 데이터 기반 분석)\n");
      console.log("=" .repeat(80));

      Object.entries(schema).forEach(([fieldName, info], index) => {
        console.log(`\n${index + 1}. ${fieldName}`);
        console.log(`   타입: ${info.type}`);
        console.log(`   NULL 허용: ${info.nullable ? 'YES' : 'NO'}`);
        if (info.sampleValues.length > 0) {
          console.log(`   샘플 값: ${info.sampleValues.map(v => 
            typeof v === 'string' && v.length > 30 ? v.substring(0, 30) + '...' : String(v)
          ).join(', ')}`);
        }
      });

      console.log("\n" + "=" .repeat(80));
    }

    // 3. 관련 테이블과의 관계 확인 (JOIN 시도)
    console.log("\n\n🔗 관련 테이블 관계 확인 중...\n");
    
    // subject_groups와의 관계 확인
    const { data: withGroups, error: groupsError } = await adminClient
      .from("subjects")
      .select(`
        *,
        subject_groups:subject_group_id (
          id,
          name,
          curriculum_revision_id
        )
      `)
      .limit(1);

    if (!groupsError && withGroups && withGroups.length > 0) {
      console.log("✅ subject_groups 관계 확인됨");
      console.log("   FK: subject_group_id → subject_groups(id)");
    }

    // subject_types와의 관계 확인
    const { data: withTypes, error: typesError } = await adminClient
      .from("subjects")
      .select(`
        *,
        subject_types:subject_type_id (
          id,
          name
        )
      `)
      .limit(1);

    if (!typesError && withTypes && withTypes.length > 0) {
      console.log("✅ subject_types 관계 확인됨");
      console.log("   FK: subject_type_id → subject_types(id)");
    }

    // 4. 통계 정보
    console.log("\n\n📊 테이블 통계:\n");
    const { count, error: countError } = await adminClient
      .from("subjects")
      .select("*", { count: "exact", head: true });

    if (!countError) {
      console.log(`   총 레코드 수: ${count ?? 0}개`);
    }

    // 5. Supabase 대시보드에서 실행할 SQL 쿼리 제공
    console.log("\n\n📋 Supabase 대시보드에서 실행할 SQL 쿼리:\n");
    console.log("=" .repeat(80));
    console.log(`
-- subjects 테이블 스키마 상세 조회
SELECT 
  column_name,
  data_type,
  character_maximum_length,
  numeric_precision,
  numeric_scale,
  is_nullable,
  column_default,
  udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'subjects'
ORDER BY ordinal_position;

-- 제약조건 및 외래키 조회
SELECT
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.update_rule,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
LEFT JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'subjects'
ORDER BY tc.constraint_type, tc.constraint_name;

-- 인덱스 조회
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'subjects';
    `.trim());
    console.log("=" .repeat(80));

  } catch (error: any) {
    console.error("❌ 오류 발생:", error.message);
    console.error(error);
  }
}

function inferType(value: any): string {
  if (value === null) return 'unknown';
  
  if (typeof value === 'string') {
    // UUID 형식 확인
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      return 'uuid';
    }
    // ISO 날짜 형식 확인
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      return 'timestamptz';
    }
    return `varchar(${value.length > 50 ? '50+' : value.length})`;
  }
  
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'integer' : 'numeric';
  }
  
  if (typeof value === 'boolean') {
    return 'boolean';
  }
  
  if (value instanceof Date) {
    return 'timestamptz';
  }
  
  return typeof value;
}

// 실행
getSubjectsSchema()
  .then(() => {
    console.log("\n✅ 완료");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ 실패:", error);
    process.exit(1);
  });

