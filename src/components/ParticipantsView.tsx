import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Plus,
  Search,
  Trash2,
  TrendingDown,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ProgramParticipant, RemissionStage } from '../types';
import { formatThaiDate, getRemissionStageLabelTh } from '../utils/clinicalAnalytics';

interface ParticipantsViewProps {
  participants: ProgramParticipant[];
  onEnrollParticipant: () => void;
  onUpdateProgress: (participant: ProgramParticipant) => void;
  onDeleteParticipant: (id: string) => Promise<void>;
}

type StageFilter = 'all' | RemissionStage;

const STAGE_FILTERS: Array<{ id: StageFilter; label: string }> = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'sustained_remission', label: 'ระยะสงบยั่งยืน' },
  { id: 'in_remission', label: 'เข้าเกณฑ์ Remission' },
  { id: 'improving', label: 'กำลังดีขึ้น' },
  { id: 'active_dm', label: 'กำลังควบคุม' },
];

export const ParticipantsView: React.FC<ParticipantsViewProps> = ({
  participants,
  onEnrollParticipant,
  onUpdateProgress,
  onDeleteParticipant,
}) => {
  const [stageFilter, setStageFilter] = useState<StageFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const sortedParticipants = useMemo(() => {
    return [...participants].sort((a, b) => b.enrolledDate.localeCompare(a.enrolledDate));
  }, [participants]);

  const filteredParticipants = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sortedParticipants.filter((p) => {
      if (stageFilter !== 'all' && p.remissionStage !== stageFilter) return false;
      if (!q) return true;
      return (
        p.displayName.toLowerCase().includes(q) ||
        p.participantCode.toLowerCase().includes(q) ||
        p.clinicName.toLowerCase().includes(q) ||
        p.icd10Code.toLowerCase().includes(q)
      );
    });
  }, [sortedParticipants, stageFilter, searchQuery]);

  const stats = useMemo(() => {
    const total = participants.length;
    const remissionCount = participants.filter(
      (p) =>
        p.remissionStage === 'in_remission' ||
        p.remissionStage === 'sustained_remission' ||
        p.currentHba1c < 6.5
    ).length;
    const code120Count = participants.filter((p) => p.activityCode === '120').length;
    const avgDelta =
      total > 0
        ? participants.reduce((acc, p) => acc + (p.currentHba1c - p.baselineHba1c), 0) / total
        : 0;
    const avgMedsFree =
      total > 0
        ? participants.reduce((acc, p) => acc + p.medsFreeMonths, 0) / total
        : 0;

    return { total, remissionCount, code120Count, avgDelta, avgMedsFree };
  }, [participants]);

  const chartData = useMemo(() => {
    return sortedParticipants.slice(0, 10).map((p) => ({
      name: p.displayName.length > 14 ? `${p.displayName.slice(0, 14)}…` : p.displayName,
      fullName: p.displayName,
      participantCode: p.participantCode,
      baseline: Number(p.baselineHba1c.toFixed(1)),
      current: Number(p.currentHba1c.toFixed(1)),
      delta: Number((p.currentHba1c - p.baselineHba1c).toFixed(1)),
      medsFreeMonths: p.medsFreeMonths,
    }));
  }, [sortedParticipants]);

  const handleConfirmDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDeleteParticipant(id);
      setConfirmDeleteId(null);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            กิจกรรมติดตามผู้ป่วย RemissionCare
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            เพิ่มผู้ป่วยเข้าร่วมกิจกรรมและติดตามความก้าวหน้าค่า HbA1c เป้าหมาย &lt; 6.5% ควบคู่รหัสกิจกรรม Special PP 120
          </p>
        </div>
        <button
          type="button"
          onClick={onEnrollParticipant}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-xl transition-colors whitespace-nowrap shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>เพิ่มผู้ป่วยเข้าร่วมกิจกรรม</span>
        </button>
      </div>

      {/* Summary KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>ผู้ป่วยเข้าร่วมทั้งหมด</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {stats.total} <span className="text-sm font-normal text-slate-500">ราย</span>
          </div>
          <p className="text-xs text-slate-500">
            กิจกรรมรหัส 120 จำนวน <span className="font-mono tabular-nums">{stats.code120Count}</span> ราย
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>เข้าเกณฑ์ HbA1c &lt; 6.5%</span>
            <CheckCircle2 className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-bold text-teal-700 font-mono tabular-nums">
            {stats.remissionCount}{' '}
            <span className="text-sm font-normal text-slate-500">
              {stats.total > 0 ? `(${Math.round((stats.remissionCount / stats.total) * 100)}%)` : ''}
            </span>
          </div>
          <p className="text-xs text-slate-500">ผู้ป่วยที่ระดับน้ำตาลเข้าสู่เกณฑ์สงบ</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>ค่า HbA1c เปลี่ยนแปลงเฉลี่ย</span>
            <TrendingDown className="w-4 h-4 text-emerald-600" />
          </div>
          <div
            className={`text-2xl font-bold font-mono tabular-nums ${
              stats.avgDelta <= 0 ? 'text-emerald-700' : 'text-red-600'
            }`}
          >
            {stats.total > 0
              ? `${stats.avgDelta > 0 ? '+' : ''}${stats.avgDelta.toFixed(1)}%`
              : '--'}
          </div>
          <p className="text-xs text-slate-500">เทียบค่าตั้งต้นวันเข้ากิจกรรม</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>ระยะปลอดยาเฉลี่ย</span>
            <CalendarClock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {stats.total > 0 ? stats.avgMedsFree.toFixed(1) : '--'}{' '}
            <span className="text-sm font-normal text-slate-500">เดือน</span>
          </div>
          <p className="text-xs text-slate-500">ต่อเนื่องโดยไม่ใช้ยาลดระดับน้ำตาล</p>
        </div>
      </section>

      {/* Cohort Progress Comparison Chart */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              เปรียบเทียบความก้าวหน้าค่า HbA1c ตั้งต้น vs ปัจจุบัน (%)
            </h2>
            <p className="text-xs text-slate-500">
              เส้นประสีเขียวแสดงเกณฑ์เป้าหมาย DM Remission (HbA1c &lt; 6.5%)
            </p>
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="py-10 text-center space-y-3 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-sm text-slate-600">ยังไม่มีผู้ป่วยเข้าร่วมกิจกรรม RemissionCare</p>
            <button
              type="button"
              onClick={onEnrollParticipant}
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มผู้ป่วยคนแรก</span>
            </button>
          </div>
        ) : (
          <div className="h-[270px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 12, right: 16, left: -12, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: '#475569' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[4, 12]}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  unit="%"
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const item = payload[0].payload;
                    return (
                      <div className="bg-white border border-slate-200 rounded-xl p-3 text-xs space-y-1 shadow-sm">
                        <div className="font-semibold text-slate-900">
                          {item.fullName}{' '}
                          <span className="font-mono text-slate-500">({item.participantCode})</span>
                        </div>
                        <div className="text-slate-600">
                          ตั้งต้น:{' '}
                          <span className="font-mono font-semibold text-slate-900">
                            {item.baseline.toFixed(1)}%
                          </span>{' '}
                          → ล่าสุด:{' '}
                          <span className="font-mono font-semibold text-teal-700">
                            {item.current.toFixed(1)}%
                          </span>
                        </div>
                        <div className="text-slate-600">
                          เปลี่ยนแปลง:{' '}
                          <span
                            className={`font-mono font-semibold ${
                              item.delta <= 0 ? 'text-emerald-700' : 'text-red-600'
                            }`}
                          >
                            {item.delta > 0 ? `+${item.delta.toFixed(1)}%` : `${item.delta.toFixed(1)}%`}
                          </span>
                          {' · '}
                          ปลอดยา <span className="font-mono">{item.medsFreeMonths}</span> เดือน
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                  formatter={(value) =>
                    value === 'baseline' ? 'HbA1c ตั้งต้น (%)' : 'HbA1c ล่าสุด (%)'
                  }
                />
                <ReferenceLine
                  y={6.5}
                  stroke="#0f766e"
                  strokeDasharray="4 4"
                  label={{
                    value: 'เกณฑ์ 6.5%',
                    position: 'right',
                    fill: '#0f766e',
                    fontSize: 11,
                  }}
                />
                <Bar dataKey="baseline" name="baseline" fill="#cbd5e1" radius={[6, 6, 0, 0]} maxBarSize={36} />
                <Bar dataKey="current" name="current" fill="#0d9488" radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Filter Tabs & Search */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 border-b border-slate-200">
            {STAGE_FILTERS.map((f) => {
              const active = stageFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStageFilter(f.id)}
                  className={`min-h-[40px] px-3 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'border-teal-600 text-teal-700 font-semibold'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อ รหัส หรือหน่วยบริการ..."
              className="w-full min-h-[44px] pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-teal-600"
            />
          </div>
        </div>

        {/* Participant Tracking List */}
        {filteredParticipants.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-2">
            <p className="text-sm font-medium text-slate-700">
              {participants.length === 0
                ? 'ยังไม่มีรายชื่อผู้ป่วยในกิจกรรม RemissionCare'
                : 'ไม่พบผู้ป่วยที่ตรงกับเงื่อนไขการค้นหา'}
            </p>
            <p className="text-xs text-slate-500">
              กดปุ่ม &ldquo;เพิ่มผู้ป่วยเข้าร่วมกิจกรรม&rdquo; เพื่อลงทะเบียนผู้ป่วยใหม่และเริ่มติดตามความก้าวหน้า
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredParticipants.map((p) => {
              const delta = p.currentHba1c - p.baselineHba1c;
              const isImproving = delta <= 0;
              const totalGap = p.baselineHba1c - p.targetHba1c;
              const achievedGap = p.baselineHba1c - p.currentHba1c;
              const progressPct =
                p.currentHba1c <= p.targetHba1c
                  ? 100
                  : totalGap > 0
                    ? Math.max(0, Math.min(100, Math.round((achievedGap / totalGap) * 100)))
                    : 0;
              const outOfArea = p.typeArea === 2 || p.typeArea === 4 || p.typeArea === 5;
              const stageLabel = getRemissionStageLabelTh(p.remissionStage);
              const isRemission =
                p.remissionStage === 'in_remission' ||
                p.remissionStage === 'sustained_remission' ||
                p.currentHba1c < 6.5;

              return (
                <article
                  key={p.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4"
                >
                  {/* Top Header Row */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        <h3 className="text-base font-semibold text-slate-900">{p.displayName}</h3>
                        <span className="text-xs font-mono text-slate-500">{p.participantCode}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                        <span>ICD-10 {p.icd10Code}</span>
                        <span aria-hidden="true">·</span>
                        <span className={outOfArea ? 'text-amber-700 font-medium' : ''}>
                          Type Area {p.typeArea}
                          {outOfArea ? ' (นอกเขต)' : ' (ในเขต)'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {p.activityCode === '120' ? 'กิจกรรมรหัส 120 (Special PP)' : 'ติดตามมาตรฐาน'}
                        </span>
                        {p.clinicName && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{p.clinicName}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onUpdateProgress(p)}
                        className="min-h-[40px] px-3.5 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs sm:text-sm font-medium rounded-xl transition-colors whitespace-nowrap"
                      >
                        อัปเดตผลติดตาม
                      </button>
                      {confirmDeleteId === p.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={deletingId === p.id}
                            onClick={() => handleConfirmDelete(p.id)}
                            className="min-h-[40px] px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-xl whitespace-nowrap disabled:opacity-60"
                          >
                            {deletingId === p.id ? 'กำลังลบ...' : 'ยืนยันลบ'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="min-h-[40px] px-2.5 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
                          >
                            ยกเลิก
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(p.id)}
                          aria-label={`ลบ ${p.displayName}`}
                          className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Clinical Progress Metrics Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-100">
                    <div>
                      <div className="text-xs text-slate-500">ความเปลี่ยนแปลง HbA1c</div>
                      <div className="flex flex-wrap items-baseline gap-2 mt-1">
                        <span className="text-sm text-slate-500 font-mono tabular-nums">
                          {p.baselineHba1c.toFixed(1)}%
                        </span>
                        <span className="text-slate-400 text-xs">→</span>
                        <span
                          className={`text-xl font-bold font-mono tabular-nums ${
                            p.currentHba1c < 6.5 ? 'text-teal-700' : 'text-slate-900'
                          }`}
                        >
                          {p.currentHba1c.toFixed(1)}%
                        </span>
                        <span
                          className={`inline-flex items-center gap-0.5 text-xs font-semibold font-mono tabular-nums ${
                            isImproving ? 'text-emerald-700' : 'text-red-600'
                          }`}
                        >
                          {delta <= 0 ? (
                            <ArrowDownRight className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          )}
                          {delta > 0 ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`}
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-500">สถานะและระยะปลอดยา</div>
                      <div className="mt-1 space-y-0.5">
                        <div
                          className={`text-sm font-semibold ${
                            isRemission ? 'text-teal-700' : 'text-slate-900'
                          }`}
                        >
                          {stageLabel}
                        </div>
                        <div className="text-xs text-slate-600">
                          ปลอดยา <span className="font-mono font-semibold tabular-nums">{p.medsFreeMonths}</span> เดือน
                          {' · '}
                          เป้าหมาย &lt; <span className="font-mono tabular-nums">{p.targetHba1c.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-500">กำหนดการติดตาม</div>
                      <div className="mt-1 space-y-0.5 text-xs text-slate-600">
                        <div>
                          เข้าร่วม:{' '}
                          <span className="font-mono text-slate-800">{formatThaiDate(p.enrolledDate)}</span>
                        </div>
                        <div>
                          ตรวจล่าสุด:{' '}
                          <span className="font-mono text-slate-800">{formatThaiDate(p.lastCheckupDate)}</span>
                          {' · '}
                          นัดถัดไป:{' '}
                          <span className="font-mono font-medium text-teal-700">
                            {formatThaiDate(p.nextFollowupDate)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar toward Target HbA1c */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>ความคืบหน้าสู่เป้าหมาย HbA1c &lt; {p.targetHba1c.toFixed(1)}%</span>
                      <span className="font-mono font-semibold text-slate-700 tabular-nums">
                        {progressPct}%
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isRemission ? 'bg-teal-600' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    {p.notes && (
                      <p className="text-xs text-slate-600 pt-1 leading-relaxed">
                        หมายเหตุ: {p.notes}
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
