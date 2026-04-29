#!/usr/bin/env npx tsx
/**
 * 학생의 최근 pipeline 별 task_results 키 + cascadePlan/mainTheme/slots 시딩 상태 점검.
 *
 * 사용법:
 *   npx tsx scripts/measure-pipeline-keys.ts <studentId>
 *
 * 진단 항목:
 *   - 최근 synthesis pipeline 의 task_results 키 인벤토리
 *   - 모든 최근 pipeline 의 derive_main_theme / _mainTheme / _cascadePlan / _slots 시딩 여부
 *   - status='running' 잔존 진단 (status=completed 가 아니면 D4 belief 시딩 실패)
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createSupabaseAdminClient } from '../lib/supabase/admin';

async function main() {
  const studentId = process.argv[2];
  if (!studentId) {
    console.error('usage: npx tsx scripts/measure-pipeline-keys.ts <studentId>');
    process.exit(1);
  }

  const sb = createSupabaseAdminClient();
  if (!sb) throw new Error('admin client unavailable');

  const { data: rows } = await sb
    .from('student_record_analysis_pipelines')
    .select('id, pipeline_type, mode, status, tasks, task_results')
    .eq('student_id', studentId)
    .eq('pipeline_type', 'synthesis')
    .order('started_at', { ascending: false })
    .limit(1);
  const r = rows?.[0];
  if (r) {
    console.log('=== Latest synthesis ===');
    console.log('id=', r.id, 'status=', r.status);
    console.log('tasks=', JSON.stringify(r.tasks, null, 2));
    const tr = (r.task_results ?? {}) as Record<string, unknown>;
    console.log('task_results keys:', Object.keys(tr));
    for (const k of Object.keys(tr)) {
      const v = tr[k];
      if (Array.isArray(v)) {
        console.log(`  ${k}: array length=${v.length}`);
      } else if (typeof v === 'object' && v !== null) {
        const subKeys = Object.keys(v as Record<string, unknown>);
        console.log(`  ${k}: keys=[${subKeys.slice(0, 10).join(', ')}]`);
      } else {
        console.log(`  ${k}: ${typeof v}`);
      }
    }
  } else {
    console.log('=== Latest synthesis === (none)');
  }

  const { data: all } = await sb
    .from('student_record_analysis_pipelines')
    .select('id, pipeline_type, grade, mode, status, completed_at, task_results, tasks')
    .eq('student_id', studentId)
    .order('started_at', { ascending: false })
    .limit(10);
  console.log('\n=== _cascadePlan / _mainTheme / _slots presence (all pipelines) ===');
  for (const row of (all ?? [])) {
    const trr = (row.task_results ?? {}) as Record<string, unknown>;
    const tasks = (row.tasks ?? {}) as Record<string, string>;
    console.log(
      `[${row.pipeline_type} G${row.grade ?? '-'} ${row.mode ?? '-'}] status=${row.status} ` +
      `derive_main_theme=${tasks.derive_main_theme ?? '-'} ` +
      `_mainTheme=${trr._mainTheme ? 'Y' : 'N'} ` +
      `_cascadePlan=${trr._cascadePlan ? 'Y' : 'N'} ` +
      `_slots=${Array.isArray(trr._slots) ? trr._slots.length : 'N/A'}`,
    );
    if (trr._mainThemeMeta) {
      console.log('   _mainThemeMeta=', JSON.stringify(trr._mainThemeMeta).slice(0, 300));
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
