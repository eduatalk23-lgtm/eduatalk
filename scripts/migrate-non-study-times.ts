/**
 * 비학습시간 데이터 마이그레이션 스크립트
 *
 * 기존 플래너의 비학습시간 템플릿 + 오버라이드를
 * 새 student_non_study_time 테이블로 이관합니다.
 *
 * 사용법:
 *   npx tsx scripts/migrate-non-study-times.ts [--dry-run] [--planner-id=UUID]
 *
 * 옵션:
 *   --dry-run       실제 DB 쓰기 없이 시뮬레이션
 *   --planner-id    특정 플래너만 마이그레이션 (테스트용)
 *   --batch-size    배치 크기 (기본: 100)
 */

import { createClient } from '@supabase/supabase-js';
import { eachDayOfInterval, getDay, format, parseISO } from 'date-fns';

// ============================================
// 환경변수 로드
// ============================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'OK' : 'MISSING');
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'OK' : 'MISSING');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// ============================================
// 타입 정의
// ============================================

interface NonStudyTimeBlock {
  type: string;
  start_time: string;
  end_time: string;
  day_of_week?: number[];
  specific_dates?: string[];
  description?: string;
}

interface Planner {
  id: string;
  tenant_id: string;
  student_id: string;
  period_start: string;
  period_end: string;
  non_study_time_blocks: NonStudyTimeBlock[] | null;
  lunch_time: { start: string; end: string } | null;
}

interface AcademySchedule {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  academy_name: string | null;
  subject: string | null;
  travel_time: number | null;
}

interface DailyOverride {
  override_date: string;
  override_type: string;
  source_index: number | null;
  is_disabled: boolean;
  start_time_override: string | null;
  end_time_override: string | null;
}

interface PlannerExclusion {
  exclusion_date: string;
}

interface NonStudyTimeRecord {
  planner_id: string;
  tenant_id: string;
  plan_date: string;
  type: string;
  start_time: string;
  end_time: string;
  label: string | null;
  academy_schedule_id: string | null;
  sequence: number;
  is_template_based: boolean;
}

// ============================================
// 헬퍼 함수
// ============================================

function toTimeWithSeconds(time: string): string {
  if (time.length === 5) {
    return `${time}:00`;
  }
  return time;
}

function subtractMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const totalMinutes = h * 60 + m - minutes;
  const newH = Math.floor(Math.max(0, totalMinutes) / 60);
  const newM = Math.max(0, totalMinutes) % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

function shouldApplyBlock(
  block: NonStudyTimeBlock,
  date: Date,
  dateString: string
): boolean {
  if (block.specific_dates && block.specific_dates.length > 0) {
    return block.specific_dates.includes(dateString);
  }
  if (block.day_of_week && block.day_of_week.length > 0) {
    const dayOfWeek = getDay(date);
    return block.day_of_week.includes(dayOfWeek);
  }
  return true;
}

// ============================================
// CLI 인자 파싱
// ============================================

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const plannerIdArg = args.find((a) => a.startsWith('--planner-id='));
const specificPlannerId = plannerIdArg?.split('=')[1];
const batchSizeArg = args.find((a) => a.startsWith('--batch-size='));
const BATCH_SIZE = batchSizeArg ? parseInt(batchSizeArg.split('=')[1], 10) : 100;

console.log('='.repeat(60));
console.log('비학습시간 마이그레이션 스크립트');
console.log('='.repeat(60));
console.log(`모드: ${isDryRun ? 'DRY RUN (시뮬레이션)' : 'LIVE (실제 DB 쓰기)'}`);
console.log(`대상: ${specificPlannerId || '모든 플래너'}`);
console.log(`배치 크기: ${BATCH_SIZE}`);
console.log('');

// ============================================
// 메인 마이그레이션 로직
// ============================================

async function migratePlanner(planner: Planner): Promise<{ success: boolean; recordCount: number; error?: string }> {
  const records: NonStudyTimeRecord[] = [];

  // 1. 제외일 목록 조회
  const { data: exclusions } = await supabase
    .from('planner_exclusions')
    .select('exclusion_date')
    .eq('planner_id', planner.id);

  const excludedDates = new Set((exclusions || []).map((e: PlannerExclusion) => e.exclusion_date));

  // 2. 학원 일정 조회 (planner_academy_schedules)
  const { data: academySchedules } = await supabase
    .from('planner_academy_schedules')
    .select('id, day_of_week, start_time, end_time, academy_name, subject, travel_time')
    .eq('planner_id', planner.id);

  // 3. 오버라이드 목록 조회
  const { data: overrides } = await supabase
    .from('planner_daily_overrides')
    .select('override_date, override_type, source_index, is_disabled, start_time_override, end_time_override')
    .eq('planner_id', planner.id);

  // 오버라이드를 날짜+타입+인덱스로 인덱싱
  const overrideMap = new Map<string, DailyOverride>();
  (overrides || []).forEach((o: DailyOverride) => {
    const key = `${o.override_date}:${o.override_type}:${o.source_index ?? 'null'}`;
    overrideMap.set(key, o);
  });

  // 4. 비학습시간 블록 준비 (lunch_time 통합)
  let nonStudyBlocks = planner.non_study_time_blocks || [];
  const hasLunchBlock = nonStudyBlocks.some((b) => b.type === '점심식사');
  if (!hasLunchBlock && planner.lunch_time?.start && planner.lunch_time?.end) {
    nonStudyBlocks = [
      ...nonStudyBlocks,
      {
        type: '점심식사',
        start_time: planner.lunch_time.start,
        end_time: planner.lunch_time.end,
      },
    ];
  }

  // 5. 날짜별 레코드 생성
  const start = parseISO(planner.period_start);
  const end = parseISO(planner.period_end);
  const dateInterval = eachDayOfInterval({ start, end });

  for (const date of dateInterval) {
    const dateString = format(date, 'yyyy-MM-dd');
    const dayOfWeek = getDay(date);

    // 제외일이면 스킵
    if (excludedDates.has(dateString)) {
      continue;
    }

    const typeSequenceMap = new Map<string, number>();

    // 5.1 일반 비학습시간
    for (let i = 0; i < nonStudyBlocks.length; i++) {
      const block = nonStudyBlocks[i];

      if (!shouldApplyBlock(block, date, dateString)) {
        continue;
      }

      // 오버라이드 확인
      let overrideKey = `${dateString}:non_study_time:${i}`;
      let override = overrideMap.get(overrideKey);

      // 점심식사의 경우 lunch 타입 오버라이드도 확인
      if (!override && block.type === '점심식사') {
        overrideKey = `${dateString}:lunch:null`;
        override = overrideMap.get(overrideKey);
      }

      // 비활성화된 경우 스킵
      if (override?.is_disabled) {
        continue;
      }

      const currentSeq = typeSequenceMap.get(block.type) ?? 0;
      typeSequenceMap.set(block.type, currentSeq + 1);

      const startTime = override?.start_time_override ?? block.start_time;
      const endTime = override?.end_time_override ?? block.end_time;

      records.push({
        planner_id: planner.id,
        tenant_id: planner.tenant_id,
        plan_date: dateString,
        type: block.type,
        start_time: toTimeWithSeconds(startTime),
        end_time: toTimeWithSeconds(endTime),
        label: block.description || null,
        academy_schedule_id: null,
        sequence: currentSeq,
        is_template_based: true,
      });
    }

    // 5.2 학원 일정
    const dayAcademies = (academySchedules || []).filter(
      (a: AcademySchedule) => a.day_of_week === dayOfWeek
    );

    for (let i = 0; i < dayAcademies.length; i++) {
      const academy = dayAcademies[i];

      // 학원 오버라이드 확인
      const overrideKey = `${dateString}:academy:${i}`;
      const override = overrideMap.get(overrideKey);

      // 비활성화된 경우 스킵
      if (override?.is_disabled) {
        continue;
      }

      const academyStart = override?.start_time_override ?? academy.start_time.substring(0, 5);
      const academyEnd = override?.end_time_override ?? academy.end_time.substring(0, 5);

      // 이동시간
      if (academy.travel_time && academy.travel_time > 0) {
        const travelSeq = typeSequenceMap.get('이동시간') ?? 0;
        typeSequenceMap.set('이동시간', travelSeq + 1);

        const travelStart = subtractMinutes(academyStart, academy.travel_time);

        records.push({
          planner_id: planner.id,
          tenant_id: planner.tenant_id,
          plan_date: dateString,
          type: '이동시간',
          start_time: toTimeWithSeconds(travelStart),
          end_time: toTimeWithSeconds(academyStart),
          label: academy.academy_name ? `${academy.academy_name} 이동` : '학원 이동',
          academy_schedule_id: academy.id,
          sequence: travelSeq,
          is_template_based: true,
        });
      }

      // 학원 본 일정
      const academySeq = typeSequenceMap.get('학원') ?? 0;
      typeSequenceMap.set('학원', academySeq + 1);

      const subjectLabel = academy.subject ? ` (${academy.subject})` : '';
      const academyLabel = academy.academy_name
        ? `${academy.academy_name}${subjectLabel}`
        : `학원${subjectLabel}`;

      records.push({
        planner_id: planner.id,
        tenant_id: planner.tenant_id,
        plan_date: dateString,
        type: '학원',
        start_time: toTimeWithSeconds(academyStart),
        end_time: toTimeWithSeconds(academyEnd),
        label: academyLabel,
        academy_schedule_id: academy.id,
        sequence: academySeq,
        is_template_based: true,
      });
    }
  }

  // 6. DB에 저장 (dry-run이 아닌 경우)
  if (records.length === 0) {
    return { success: true, recordCount: 0 };
  }

  if (isDryRun) {
    return { success: true, recordCount: records.length };
  }

  // 배치 삽입
  const INSERT_BATCH_SIZE = 500;
  for (let i = 0; i < records.length; i += INSERT_BATCH_SIZE) {
    const batch = records.slice(i, i + INSERT_BATCH_SIZE);
    const { error } = await supabase.from('student_non_study_time').insert(batch);

    if (error) {
      return { success: false, recordCount: i, error: error.message };
    }
  }

  return { success: true, recordCount: records.length };
}

async function main() {
  // 1. 플래너 목록 조회
  let query = supabase
    .from('planners')
    .select('id, tenant_id, student_id, period_start, period_end, non_study_time_blocks, lunch_time')
    .is('deleted_at', null)
    .in('status', ['draft', 'active']);

  if (specificPlannerId) {
    query = query.eq('id', specificPlannerId);
  }

  const { data: planners, error: fetchError } = await query;

  if (fetchError) {
    console.error('플래너 조회 실패:', fetchError.message);
    process.exit(1);
  }

  if (!planners || planners.length === 0) {
    console.log('마이그레이션할 플래너가 없습니다.');
    return;
  }

  console.log(`마이그레이션 대상 플래너: ${planners.length}개`);
  console.log('');

  // 2. 기존 레코드가 있는 플래너 확인
  const { data: existingRecords } = await supabase
    .from('student_non_study_time')
    .select('planner_id')
    .in('planner_id', planners.map((p) => p.id));

  const plannersWithRecords = new Set((existingRecords || []).map((r) => r.planner_id));

  // 3. 플래너별 마이그레이션
  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;
  let totalRecords = 0;

  for (let i = 0; i < planners.length; i += BATCH_SIZE) {
    const batch = planners.slice(i, i + BATCH_SIZE);

    for (const planner of batch) {
      // 이미 레코드가 있으면 스킵
      if (plannersWithRecords.has(planner.id)) {
        console.log(`[SKIP] ${planner.id} - 이미 마이그레이션됨`);
        skipCount++;
        continue;
      }

      const result = await migratePlanner(planner as Planner);

      if (result.success) {
        console.log(`[OK] ${planner.id} - ${result.recordCount}개 레코드`);
        successCount++;
        totalRecords += result.recordCount;
      } else {
        console.error(`[FAIL] ${planner.id} - ${result.error}`);
        failCount++;
      }
    }

    // 진행률 출력
    const progress = Math.min(i + BATCH_SIZE, planners.length);
    console.log(`\n진행률: ${progress}/${planners.length}`);
  }

  // 4. 결과 요약
  console.log('');
  console.log('='.repeat(60));
  console.log('마이그레이션 완료');
  console.log('='.repeat(60));
  console.log(`성공: ${successCount}`);
  console.log(`스킵: ${skipCount} (이미 마이그레이션됨)`);
  console.log(`실패: ${failCount}`);
  console.log(`총 생성 레코드: ${totalRecords}`);

  if (isDryRun) {
    console.log('');
    console.log('※ DRY RUN 모드였습니다. 실제 DB에는 저장되지 않았습니다.');
  }
}

main().catch((error) => {
  console.error('마이그레이션 실패:', error);
  process.exit(1);
});
