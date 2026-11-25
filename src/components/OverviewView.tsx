import React from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  HeartPulse,
  Plus,
  ShieldCheck,
  Smartphone,
  Stethoscope,
  UserPlus,
  Users,
} from 'lucide-react';
import type {
  Appointment,
  DeviceReading,
  DoctorRecommendation,
  Hba1cRecord,
  PatientProfile,
  ProgramParticipant,
} from '../types';
import {
  analyzeHbA1cTrend,
  evaluateHbA1cEligibility,
  formatThaiDate,
  formatThaiDateTime,
  getActiveAppointmentReminders,
  getRemissionStageLabelTh,
  summarizeDeviceMetrics,
} from '../utils/clinicalAnalytics';
import { CombinedHealthChart } from './CombinedHealthChart';
import { GlucoseTrendChart } from './GlucoseTrendChart';
import { Hba1cChart } from './Hba1cChart';

interface OverviewViewProps {
  profile: PatientProfile;
  records: Hba1cRecord[];
  readings: DeviceReading[];
  appointments: Appointment[];
  recommendations: DoctorRecommendation[];
  participants: ProgramParticipant[];
  onAddHba1c: () => void;
  onSyncDevice: () => void;
  onEnrollParticipant: () => void;
  onNavigate: (
    tab: 'overview' | 'hba1c' | 'devices' | 'appointments' | 'participants' | 'recommendations'
  ) => void;
  onAcknowledgeRec: (recId: string) => Promise<void>;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  profile,
  records,
  readings,
  appointments,
  recommendations,
  participants,
  onAddHba1c,
  onSyncDevice,
  onEnrollParticipant,
  onNavigate,
  onAcknowledgeRec,
}) => {
  const trend = analyzeHbA1cTrend(records, profile.medsFreeMonths);
  const eligibility = evaluateHbA1cEligibility(records);
  const deviceSummary = summarizeDeviceMetrics(readings);
  const reminders = getActiveAppointmentReminders(appointments);
  const dueReminders = reminders.filter((r) => r.isDueNow);
  const nextAppointment = reminders.length > 0 ? reminders[0] : null;
  const unacknowledgedRecs = recommendations.filter((r) => !r.acknowledged);

  const stageLabel = getRemissionStageLabelTh(trend.computedStage);
  const latestIsGood = trend.latestValue !== null && trend.latestValue < 6.5;

  return (
    <div className="space-y-6">
      {/* Automated Appointment Alert Banner (if due within configured reminder window) */}
      {dueReminders.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <BellRing className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-slate-900">
                แจ้งเตือนนัดหมายแพทย์อัตโนมัติ: {dueReminders[0].appointment.doctorName}
              </p>
              <p className="text-xs sm:text-sm text-slate-700">
                {dueReminders[0].daysUntil === 0
                  ? 'นัดหมายวันนี้'
                  : dueReminders[0].daysUntil < 0
                    ? 'เลยกำหนดนัดหมายเล็กน้อย'
                    : `อีก ${dueReminders[0].daysUntil} วัน`}
                {' · '}
                {formatThaiDateTime(dueReminders[0].appointment.appointmentDate)}
                {' · '}
                {dueReminders[0].appointment.facility}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('appointments')}
            className="min-h-[44px] px-4 py-2 bg-white hover:bg-amber-100/60 border border-amber-300 text-slate-900 text-xs sm:text-sm font-medium rounded-xl transition-colors whitespace-nowrap shrink-0 self-start sm:self-center"
          >
            ดูรายละเอียดนัดหมาย
          </button>
        </div>
      )}

      {/* Dominant Focal Anchor: DM Remission Hero Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
              <span>รหัสวินิจฉัย {profile.icd10Code}</span>
              <span aria-hidden="true">·</span>
              <span>Type Area {profile.typeArea}</span>
              <span aria-hidden="true">·</span>
              <span>{profile.activityCode120 ? 'กิจกรรม DM Remission (รหัส 120)' : 'ติดตามมาตรฐาน'}</span>
            </div>

            <div className="flex flex-wrap items-baseline gap-4">
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 font-mono tabular-nums">
                  {trend.latestValue !== null ? trend.latestValue.toFixed(1) : '--'}
                </span>
                <span className="text-lg font-medium text-slate-500">% HbA1c</span>
              </div>

              {trend.deltaFromPrevious !== null && (
                <span
                  className={`inline-flex items-center gap-1 text-sm font-medium font-mono tabular-nums ${
                    trend.deltaFromPrevious <= 0 ? 'text-emerald-700' : 'text-red-600'
                  }`}
                >
                  {trend.deltaFromPrevious < 0 ? (
                    <ArrowDownRight className="w-4 h-4" />
                  ) : trend.deltaFromPrevious > 0 ? (
                    <ArrowUpRight className="w-4 h-4" />
                  ) : (
                    <ArrowRight className="w-4 h-4" />
                  )}
                  {trend.deltaFromPrevious > 0 ? '+' : ''}
                  {trend.deltaFromPrevious.toFixed(1)}% จากครั้งก่อน
                </span>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <CheckCircle2
                  className={`w-4 h-4 shrink-0 ${latestIsGood ? 'text-teal-600' : 'text-amber-600'}`}
                />
                <span>{stageLabel}</span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
                {trend.clinicalSummaryTh}
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
              <span>
                เป้าหมาย: <strong className="font-mono tabular-nums text-slate-900">&lt; {profile.targetHba1c.toFixed(1)}%</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                ระยะปลอดยา: <strong className="font-mono tabular-nums text-slate-900">{profile.medsFreeMonths} เดือน</strong>
              </span>
              {trend.overallDelta !== null && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    เทียบค่าตั้งต้น:{' '}
                    <strong
                      className={`font-mono tabular-nums ${
                        trend.overallDelta <= 0 ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {trend.overallDelta > 0 ? `+${trend.overallDelta.toFixed(1)}%` : `${trend.overallDelta.toFixed(1)}%`}
                    </strong>
                  </span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span>แพทย์ดูแล: {profile.attendingDoctor}</span>
            </div>
            <button
              type="button"
              onClick={onAddHba1c}
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-xl transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>บันทึกผลตรวจ HbA1c</span>
            </button>
          </div>
        </div>

        {/* 90-Day Interval & Fiscal Year Quota Compliance Panel */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between gap-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900">
                เกณฑ์ความถี่การตรวจ HbA1c (90 วัน)
              </h2>
              <span className="text-xs font-mono text-slate-500">
                {eligibility.fiscalYearLabel}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 py-2">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <div className="text-xs text-slate-500">จำนวนครั้งในปีงบฯ</div>
                <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
                  {eligibility.testsInCurrentFiscalYear} / {eligibility.maxTestsPerFiscalYear}
                </div>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <div className="text-xs text-slate-500">ระยะห่างจากครั้งล่าสุด</div>
                <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
                  {eligibility.daysSinceLastTest !== null ? `${eligibility.daysSinceLastTest} วัน` : '-'}
                </div>
              </div>
            </div>

            <div
              className={`p-3.5 rounded-xl border text-xs sm:text-sm leading-relaxed ${
                eligibility.isEligibleNow
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50/70 border-amber-200 text-amber-900'
              }`}
            >
              <div className="font-semibold mb-0.5">
                {eligibility.isEligibleNow
                  ? 'พร้อมรับการตรวจรอบถัดไป (วันที่ 91+)'
                  : `ยังไม่ครบเกณฑ์ความถี่ 90 วัน${eligibility.daysRemainingToWait > 0 ? ` (รออีก ${eligibility.daysRemainingToWait} วัน)` : ''}`}
              </div>
              <p>{eligibility.reasonTh}</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
              <span>อ้างอิงมาตรฐาน 43 แฟ้ม / LOINC 4548-4</span>
            </span>
            <button
              type="button"
              onClick={() => onNavigate('hba1c')}
              className="text-teal-700 hover:text-teal-800 font-medium whitespace-nowrap shrink-0 min-h-[36px] px-2"
            >
              ตรวจสอบข้อมูลแล็บ →
            </button>
          </div>
        </div>
      </section>

      {/* 4-Column Clinical KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>น้ำตาลเฉลี่ยจากอุปกรณ์</span>
            <Smartphone className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {deviceSummary.avgGlucose !== null ? `${deviceSummary.avgGlucose} mg/dL` : '--'}
          </div>
          <p className="text-xs text-slate-500">
            จาก {deviceSummary.glucoseCount} ค่าล่าสุดที่ซิงค์
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>ความดันโลหิตล่าสุด</span>
            <HeartPulse className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {deviceSummary.latestBp
              ? `${deviceSummary.latestBp.systolic}/${deviceSummary.latestBp.diastolic}`
              : '--'}
          </div>
          <p className="text-xs text-slate-500">
            {deviceSummary.latestBp ? `mmHg · ${deviceSummary.latestBp.deviceName}` : 'ยังไม่มีข้อมูลความดัน'}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>น้ำหนักตัวล่าสุด</span>
            <ClipboardCheck className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {deviceSummary.latestWeight ? `${deviceSummary.latestWeight.weightKg.toFixed(1)} kg` : '--'}
          </div>
          <p className="text-xs text-slate-500">
            {trend.projectedNextValue !== null
              ? `คาดการณ์ HbA1c ถัดไป ${trend.projectedNextValue.toFixed(1)}%`
              : 'บันทึกต่อเนื่องเพื่อประเมิน'}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>นัดหมายแพทย์ถัดไป</span>
            <CalendarClock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 font-mono tabular-nums truncate">
            {nextAppointment ? formatThaiDate(nextAppointment.appointment.appointmentDate) : 'ไม่มีนัดหมาย'}
          </div>
          <p className="text-xs text-slate-500 truncate">
            {nextAppointment
              ? `${nextAppointment.appointment.doctorName} · แจ้งเตือน ${nextAppointment.appointment.reminderDaysBefore} วัน`
              : 'เพิ่มนัดหมายเพื่อเปิดแจ้งเตือนอัตโนมัติ'}
          </p>
        </div>
      </section>

      {/* Combined Long-Term Health Summary Dashboard */}
      <section>
        <CombinedHealthChart
          records={records}
          readings={readings}
          onAddHba1c={onAddHba1c}
          onSyncDevice={onSyncDevice}
        />
      </section>

      {/* Comparative Analytics Grid: HbA1c (%) vs Device Blood Glucose (mg/dL) */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
        <Hba1cChart
          records={records}
          targetHba1c={profile.targetHba1c}
          onAddRecord={onAddHba1c}
        />

        <GlucoseTrendChart
          readings={readings}
          latestHba1c={trend.latestValue}
          onSyncDevice={onSyncDevice}
        />
      </section>

      {/* RemissionCare Program Participants Progress Summary */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-teal-600" />
            <h3 className="text-base font-semibold text-slate-900">
              กิจกรรมติดตามผู้ป่วย RemissionCare
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-600">
            เข้าร่วมแล้ว{' '}
            <strong className="font-mono tabular-nums text-slate-900">
              {participants.length}
            </strong>{' '}
            ราย
            <span aria-hidden="true"> · </span>
            เข้าเกณฑ์ HbA1c &lt; 6.5%{' '}
            <strong className="font-mono tabular-nums text-teal-700">
              {
                participants.filter(
                  (p) =>
                    p.remissionStage === 'in_remission' ||
                    p.remissionStage === 'sustained_remission' ||
                    p.currentHba1c < 6.5
                ).length
              }
            </strong>{' '}
            ราย
            <span aria-hidden="true"> · </span>
            ลดลงเฉลี่ย{' '}
            <strong className="font-mono tabular-nums text-emerald-700">
              {participants.length > 0
                ? `${(
                    participants.reduce((acc, p) => acc + (p.currentHba1c - p.baselineHba1c), 0) /
                    participants.length
                  ).toFixed(1)}%`
                : '--'}
            </strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onEnrollParticipant}
            className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-medium rounded-xl transition-colors whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4" />
            <span>เพิ่มผู้ป่วยเข้าร่วมกิจกรรม</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('participants')}
            className="min-h-[44px] px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs sm:text-sm font-medium rounded-xl transition-colors whitespace-nowrap"
          >
            ดูความก้าวหน้าทั้งหมด →
          </button>
        </div>
      </section>

      {/* Physician Recommendations & Quick Action */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-teal-600" />
            <h3 className="text-base font-semibold text-slate-900">
              คำแนะนำจากแพทย์ ({unacknowledgedRecs.length} ใหม่)
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('recommendations')}
            className="text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap shrink-0"
          >
            ดูทั้งหมด
          </button>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
          <div className="text-xs font-medium text-teal-700">สรุปการวิเคราะห์แนวโน้มเพื่อแพทย์</div>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            {trend.recommendedActionTh}
          </p>
        </div>

        {recommendations.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">
            ยังไม่มีคำแนะนำเฉพาะบุคคลจากแพทย์
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            {recommendations.slice(0, 3).map((rec) => (
              <div
                key={rec.id}
                className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex flex-col justify-between gap-3"
              >
                <div className="space-y-1.5">
                  <div className="text-xs text-slate-500">
                    {rec.doctorName} · {formatThaiDate(rec.issuedDate)}
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900">{rec.title}</h4>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed line-clamp-3">
                    {rec.advice}
                  </p>
                </div>

                <div className="flex justify-end">
                  {!rec.acknowledged ? (
                    <button
                      type="button"
                      onClick={() => onAcknowledgeRec(rec.id)}
                      className="min-h-[36px] px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      รับทราบ
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400 whitespace-nowrap shrink-0">รับทราบแล้ว</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pt-2 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onSyncDevice}
            className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Smartphone className="w-4 h-4" />
            <span>ซิงค์ข้อมูลจากอุปกรณ์สุขภาพทันที</span>
          </button>
        </div>
      </section>
    </div>
  );
};
