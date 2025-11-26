/**
 * 학교 초기 데이터 로드 스크립트
 * 사용법: npx tsx scripts/load-schools-data.ts
 */

import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

// .env.local 파일 로드
config({ path: resolve(process.cwd(), ".env.local") });

// 환경 변수 직접 읽기
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ 환경 변수가 설정되지 않았습니다.");
  console.error("   .env.local 파일에 다음 변수가 필요합니다:");
  console.error("   - NEXT_PUBLIC_SUPABASE_URL");
  console.error("   - NEXT_PUBLIC_SUPABASE_ANON_KEY");
  console.error("   - SUPABASE_SERVICE_ROLE_KEY (선택사항, 권장)");
  process.exit(1);
}

// 서비스 키가 있으면 사용, 없으면 anon key 사용
const supabaseKey = supabaseServiceKey || supabaseAnonKey;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface InitialData {
  regions: Array<{
    name: string;
    display_order: number;
  }>;
  schools: Array<{
    name: string;
    type: "중학교" | "고등학교" | "대학교";
    region: string;
    address?: string;
    display_order: number;
  }>;
}

async function loadInitialData() {
  try {
    console.log("📂 초기 데이터 파일 읽기...");
    const dataPath = join(process.cwd(), "data", "schools-initial.json");
    const fileContent = readFileSync(dataPath, "utf-8");
    const data: InitialData = JSON.parse(fileContent);

    console.log(`✅ 데이터 파일 로드 완료`);
    console.log(`   - 지역: ${data.regions.length}개`);
    console.log(`   - 학교: ${data.schools.length}개`);

    // 1. 지역 데이터 로드
    console.log("\n📍 지역 데이터 로드 중...");
    const regionMap = new Map<string, string>(); // region name -> region id

    for (const region of data.regions) {
      const { data: insertedRegion, error } = await supabase
        .from("regions")
        .upsert(
          {
            name: region.name,
            display_order: region.display_order,
            is_active: true,
          },
          {
            onConflict: "name",
            ignoreDuplicates: false,
          }
        )
        .select("id")
        .single();

      if (error) {
        console.error(`❌ 지역 "${region.name}" 삽입 실패:`, error.message);
        continue;
      }

      if (insertedRegion) {
        regionMap.set(region.name, insertedRegion.id);
        console.log(`   ✓ ${region.name} (ID: ${insertedRegion.id})`);
      }
    }

    console.log(`✅ 지역 데이터 로드 완료: ${regionMap.size}개`);

    // 2. 학교 데이터 로드
    console.log("\n🏫 학교 데이터 로드 중...");
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const school of data.schools) {
      const regionId = regionMap.get(school.region);

      if (!regionId) {
        console.error(`❌ 지역을 찾을 수 없음: "${school.region}" (학교: ${school.name})`);
        errorCount++;
        continue;
      }

      // 기존 학교 확인 (이름 + 타입으로 중복 체크)
      const { data: existing } = await supabase
        .from("schools")
        .select("id")
        .eq("name", school.name)
        .eq("type", school.type)
        .maybeSingle();

      if (existing) {
        // 기존 데이터 업데이트
        const { error: updateError } = await supabase
          .from("schools")
          .update({
            region_id: regionId,
            address: school.address || null,
            display_order: school.display_order,
            is_active: true,
          })
          .eq("id", existing.id);

        if (updateError) {
          console.error(`❌ 학교 업데이트 실패 "${school.name}":`, updateError.message);
          errorCount++;
        } else {
          console.log(`   ↻ ${school.name} (${school.type}) - 업데이트됨`);
          successCount++;
        }
      } else {
        // 새 학교 삽입
        const { error: insertError } = await supabase.from("schools").insert({
          name: school.name,
          type: school.type,
          region_id: regionId,
          address: school.address || null,
          display_order: school.display_order,
          is_active: true,
        });

        if (insertError) {
          console.error(`❌ 학교 삽입 실패 "${school.name}":`, insertError.message);
          errorCount++;
        } else {
          console.log(`   ✓ ${school.name} (${school.type})`);
          successCount++;
        }
      }
    }

    console.log(`\n✅ 학교 데이터 로드 완료`);
    console.log(`   - 성공: ${successCount}개`);
    console.log(`   - 업데이트: ${successCount}개`);
    console.log(`   - 실패: ${errorCount}개`);

    // 3. 최종 확인
    console.log("\n📊 최종 데이터 확인...");
    const { count: regionCount } = await supabase
      .from("regions")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);

    const { count: schoolCount } = await supabase
      .from("schools")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);

    console.log(`   - 활성 지역: ${regionCount || 0}개`);
    console.log(`   - 활성 학교: ${schoolCount || 0}개`);

    console.log("\n✅ 초기 데이터 로드 완료!");
  } catch (error) {
    console.error("❌ 오류 발생:", error);
    process.exit(1);
  }
}

// 실행
loadInitialData();









