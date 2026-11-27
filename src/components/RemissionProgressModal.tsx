import React, { useEffect } from 'react';
import { Award, CalendarCheck2, CheckCircle2, Clock, Target, X } from 'lucide-react';
import type { Hba1cRecord, PatientProfile, RemissionStage } from '../types';
import { analyzeHbA1cTrend, getRemissionStageLabelTh } from '../utils/clinicalAnalytics';

interface RemissionProgressModalProps {
  profile: PatientProfile;
  records: Hba1cRecord[];
  onClose: () => void;
  onAddHba1c?: () => void;
}

const STAGE_STEPS: Array<{
  id: RemissionStage;
  stepNumber: number;
  shortTitle: string;
  criteria: string;
}> = [
  {
    id: 'active_dm',
    stepNumber: 1,
    shortTitle: 'ควบคุมระดับน้ำตาล',
    criteria: 'HbA1c ≥ 7.0%',
  },
  {
    id: 'improving',
    stepNumber: 2,
    shortTitle: 'กำลังดีขึ้นต่อเนื่อง',
    criteria: 'HbA1c 6.5–6.9% หรือลดลง',
  },
  {
    id: 'in_remission',
    stepNumber: 3,
    shortTitle: 'เข้าเกณฑ์ Remission',
    criteria: 'HbA1c < 6.5%',
  },
  {
    id: 'sustained_remission',
    stepNumber: 4,
    shortTitle: 'DM Remission ยั่งยืน',
    criteria: 'HbA1c < 6.5% · ปลอดยา ≥ 3 ด.',
  },
];

const MEDS_FREE_MILESTONES = [3, 6, 12];

export const RemissionProgressModal: React.FC<RemissionProgressModalProps> = ({
  profile,
  records,
  onClose,
  onAddHba1c,
}) => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const trend = analyzeHbA1cTrend(records, profile.medsFreeMonths);
  const activeStage = trend.computedStage;
  const activeStageIndex = Math.max(
    0,
    STAGE_STEPS.findIndex((s) => s.id === activeStage)
  );
  const stagePercent = Math.round(((activeStageIndex + 1) / STAGE_STEPS.length) * 100);

  const medsFree = Math.max(0, profile.medsFreeMonths);
  const remainingToCoreRemission = Math.max(0, 3 - medsFree);
  const nextMilestone =
    MEDS_FREE_MILESTONES.find((m) => medsFree < m) ?? 12;
  const remainingToNextMilestone = Math.max(0, nextMilestone - medsFree);
  const remainingToAnnualGoal = Math.max(0, 12 - medsFree);
  const medsFreePercent = Math.min(100, Math.round((medsFree / 12) * 100));

  const sortedRecords = [...records].sort((a, b) => a.testDate.localeCompare(b.testDate));
  const baselineVal = sortedRecords.length > 0 ? sortedRecords[0].value : null;
  const latestVal = trend.latestValue;

  let hba1cGoalProgress = 0;
  if (latestVal !== null) {
    if (latestVal <= profile.targetHba1c) {
      hba1cGoalProgress = 100;
    } else if (baselineVal !== null && baselineVal > profile.targetHba1c) {
      hba1cGoalProgress = Math.max(
        0,
        Math.min(
          100,
          Math.round(((baselineVal - latestVal) / (baselineVal - profile.targetHba1c)) * 100)
        )
      );
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="remission-progress-modal-title"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl border border-slate-200 max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div>
            <h3 id="remission-progress-modal-title" className="text-base sm:text-lg font-semibold text-slate-900">
              ความคืบหน้าภาวะเบาหวานระยะสงบ (DM Remission)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {profile.displayName} · รหัสวินิจฉัย {profile.icd10Code} ·{' '}
              {profile.activityCode120 ? 'กิจกรรม Special PP รหัส 120' : 'ติดตามมาตรฐาน'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          {/* Section 1: Remission Stage Visual Stepper & Progress Bar */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-teal-600 shrink-0" />
                <h4 className="text-sm font-semibold text-slate-900">
                  ระดับสถานะปัจจุบัน (Remission Stage)
                </h4>
              </div>
              <span className="text-sm font-bold font-mono tabular-nums text-teal-700">
                ขั้นที่ {activeStageIndex + 1} / {STAGE_STEPS.length} ({stagePercent}%)
              </span>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-900">
                  {getRemissionStageLabelTh(activeStage)}
                </span>
                {latestVal !== null && (
                  <span className="text-xs font-mono tabular-nums text-slate-600">
                    HbA1c ล่าสุด {latestVal.toFixed(1)}% (เป้า &lt; {profile.targetHba1c.toFixed(1)}%)
                  </span>
                )}
              </div>

              {/* Smooth Linear Stage Progress Bar */}
              <div
                className="h-3 w-full bg-slate-200 rounded-full overflow-hidden"
                role="progressbar"
                aria-valuenow={stagePercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="ความคืบหน้า Remission Stage"
              >
                <div
                  className="h-full bg-teal-600 rounded-full transition-all duration-500"
                  style={{ width: `${stagePercent}%` }}
                />
              </div>

              {/* 4-Stage Step Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                {STAGE_STEPS.map((step, idx) => {
                  const isCompleted = idx < activeStageIndex;
                  const isCurrent = idx === activeStageIndex;
                  return (
                    <div
                      key={step.id}
                      className={`p-2.5 rounded-xl border text-left transition-colors ${
                        isCurrent
                          ? 'bg-teal-50 border-teal-300'
                          : isCompleted
                            ? 'bg-white border-emerald-200'
                            : 'bg-white/60 border-slate-200 opacity-75'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 text-[11px] font-mono tabular-nums">
                        <span
                          className={
                            isCurrent
                              ? 'font-bold text-teal-700'
                              : isCompleted
                                ? 'font-semibold text-emerald-700'
                                : 'text-slate-400'
                          }
                        >
                          ขั้น {step.stepNumber}
                        </span>
                        {(isCompleted || isCurrent) && (
                          <CheckCircle2
                            className={`w-3.5 h-3.5 ${
                              isCurrent ? 'text-teal-600' : 'text-emerald-600'
                            }`}
                          />
                        )}
                      </div>
                      <div className="text-xs font-semibold text-slate-900 mt-1 leading-snug">
                        {step.shortTitle}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        {step.criteria}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Section 2: Meds-Free Months Visual Progress Bar & Remaining Months */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-teal-600 shrink-0" />
                <h4 className="text-sm font-semibold text-slate-900">
                  ระยะเวลาปลอดยาลดระดับน้ำตาล (Meds-Free Months)
                </h4>
              </div>
              <span className="text-sm font-bold font-mono tabular-nums text-slate-900">
                {medsFree} / 12 เดือน
              </span>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <div className="text-xs text-slate-500">ปลอดยาต่อเนื่องแล้ว</div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-teal-700 mt-0.5">
                    {medsFree} <span className="text-xs font-normal text-slate-500">เดือน</span>
                  </div>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <div className="text-xs text-slate-500">เกณฑ์ยั่งยืนขั้นต้น (3 เดือน)</div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                    {remainingToCoreRemission === 0 ? (
                      <span className="text-base text-emerald-700">ครบเกณฑ์แล้ว</span>
                    ) : (
                      <>
                        เหลือ {remainingToCoreRemission}{' '}
                        <span className="text-xs font-normal text-slate-500">เดือน</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <div className="text-xs text-slate-500">เป้าหมาย 1 ปีเต็ม (12 เดือน)</div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                    {remainingToAnnualGoal === 0 ? (
                      <span className="text-base text-emerald-700">สำเร็จครบ 1 ปี</span>
                    ) : (
                      <>
                        เหลือ {remainingToAnnualGoal}{' '}
                        <span className="text-xs font-normal text-slate-500">เดือน</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* 12-Month Milestone Progress Track */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>
                    {medsFree >= 12
                      ? 'รักษาภาวะปลอดยาได้ครบเป้าหมายระยะยาว 12 เดือนแล้ว'
                      : `อีก ${remainingToNextMilestone} เดือน จะถึงหมุดหมายถัดไป (${nextMilestone} เดือน)`}
                  </span>
                  <span className="font-mono font-semibold tabular-nums text-slate-800">
                    {medsFreePercent}%
                  </span>
                </div>

                <div className="relative pt-1 pb-5">
                  <div
                    className="h-3 w-full bg-slate-200 rounded-full overflow-hidden"
                    role="progressbar"
                    aria-valuenow={medsFreePercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="ความคืบหน้าระยะเวลาปลอดยา"
                  >
                    <div
                      className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                      style={{ width: `${medsFreePercent}%` }}
                    />
                  </div>

                  {/* Milestone Tick Labels */}
                  <div className="relative h-4 mt-1.5 text-[11px] font-mono tabular-nums text-slate-500">
                    <span className="absolute left-0">0 ด.</span>
                    <span
                      className={`absolute -translate-x-1/2 ${
                        medsFree >= 3 ? 'text-teal-700 font-semibold' : ''
                      }`}
                      style={{ left: '25%' }}
                    >
                      3 ด. (เกณฑ์ยั่งยืน)
                    </span>
                    <span
                      className={`absolute -translate-x-1/2 ${
                        medsFree >= 6 ? 'text-teal-700 font-semibold' : ''
                      }`}
                      style={{ left: '50%' }}
                    >
                      6 ด.
                    </span>
                    <span
                      className={`absolute right-0 ${
                        medsFree >= 12 ? 'text-emerald-700 font-semibold' : ''
                      }`}
                    >
                      12 ด.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: HbA1c Target Progress */}
          <section className="p-4 border border-slate-200 rounded-xl space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Target className="w-4 h-4 text-teal-600 shrink-0" />
                <span>ระยะทางสู่เป้าหมาย HbA1c &lt; {profile.targetHba1c.toFixed(1)}%</span>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-600">
                {baselineVal !== null && latestVal !== null
                  ? `ตั้งต้น ${baselineVal.toFixed(1)}% → ล่าสุด ${latestVal.toFixed(1)}% (${hba1cGoalProgress}%)`
                  : latestVal !== null
                    ? `ล่าสุด ${latestVal.toFixed(1)}%`
                    : 'ยังไม่มีผล HbA1c'}
              </span>
            </div>
            <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-600 rounded-full transition-all duration-500"
                style={{ width: `${hba1cGoalProgress}%` }}
              />
            </div>
            <p className="text-xs text-slate-600 leading-relaxed flex items-start gap-1.5 pt-0.5">
              <CalendarCheck2 className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
              <span>{trend.recommendedActionTh}</span>
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2.5 bg-slate-50/50">
          {onAddHba1c && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onAddHba1c();
              }}
              className="min-h-[44px] px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 text-sm font-medium rounded-xl transition-colors"
            >
              บันทึกผล HbA1c เพิ่มเติม
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-xl transition-colors"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
