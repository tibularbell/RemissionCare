import React, { useMemo, useState } from 'react';
import { Activity, Plus, Smartphone } from 'lucide-react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DeviceReading, Hba1cRecord } from '../types';
import { formatThaiDate } from '../utils/clinicalAnalytics';

interface CombinedHealthChartProps {
  records: Hba1cRecord[];
  readings: DeviceReading[];
  onAddHba1c: () => void;
  onSyncDevice: () => void;
}

interface CombinedPoint {
  timestamp: number;
  dateKey: string;
  label: string;
  dailyGlucose: number | null;
  glucoseReadingCount: number;
  hba1cMonthlyAvg: number | null;
  hba1cCount: number;
}

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

function formatThaiMonth(ym: string): string {
  const [yStr, mStr] = ym.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  if (!y || !m) return ym;
  return `${THAI_MONTHS_SHORT[m - 1]} ${(y + 543).toString().slice(-2)}`;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: CombinedPoint }>;
}

const CustomCombinedTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const pt = payload[0].payload;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm text-xs space-y-1.5 min-w-[210px]">
      <div className="font-semibold text-slate-900 border-b border-slate-100 pb-1">
        {pt.dateKey.length === 7 ? formatThaiMonth(pt.dateKey) : formatThaiDate(pt.dateKey)}
      </div>

      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-600">น้ำตาลจากอุปกรณ์</span>
        <span className="font-mono font-semibold tabular-nums text-sky-700">
          {pt.dailyGlucose !== null ? `${pt.dailyGlucose} mg/dL` : 'ไม่มีข้อมูล'}
        </span>
      </div>

      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-600">HbA1c เฉลี่ยรายเดือน</span>
        <span className="font-mono font-semibold tabular-nums text-teal-700">
          {pt.hba1cMonthlyAvg !== null ? `${pt.hba1cMonthlyAvg.toFixed(1)}%` : 'ไม่มีผลตรวจ'}
        </span>
      </div>

      {(pt.glucoseReadingCount > 0 || pt.hba1cCount > 0) && (
        <div className="pt-1 border-t border-slate-100 text-slate-500 font-mono">
          {pt.glucoseReadingCount > 0 && `วัดอุปกรณ์ ${pt.glucoseReadingCount} ครั้ง`}
          {pt.glucoseReadingCount > 0 && pt.hba1cCount > 0 && ' · '}
          {pt.hba1cCount > 0 && `ตรวจ HbA1c ${pt.hba1cCount} ครั้ง`}
        </div>
      )}
    </div>
  );
};

export const CombinedHealthChart: React.FC<CombinedHealthChartProps> = ({
  records,
  readings,
  onAddHba1c,
  onSyncDevice,
}) => {
  const [viewMode, setViewMode] = useState<'timeline' | 'monthly'>('timeline');

  const glucoseReadings = useMemo(
    () => readings.filter((r) => r.glucoseMgDl > 0),
    [readings]
  );

  // Build monthly average HbA1c map (YYYY-MM -> { avg, count, anchorDate })
  const monthlyHba1cMap = useMemo(() => {
    const groups = new Map<string, { values: number[]; dates: string[] }>();
    for (const r of records) {
      const ym = r.testDate.slice(0, 7);
      const entry = groups.get(ym) || { values: [], dates: [] };
      entry.values.push(r.value);
      entry.dates.push(r.testDate);
      groups.set(ym, entry);
    }

    const result = new Map<string, { avg: number; count: number; anchorDate: string }>();
    groups.forEach((entry, ym) => {
      const avg = Number(
        (entry.values.reduce((a, b) => a + b, 0) / entry.values.length).toFixed(2)
      );
      const sortedDates = [...entry.dates].sort();
      result.set(ym, {
        avg,
        count: entry.values.length,
        anchorDate: sortedDates[sortedDates.length - 1],
      });
    });
    return result;
  }, [records]);

  // Build daily glucose map (YYYY-MM-DD -> { avg, count })
  const dailyGlucoseMap = useMemo(() => {
    const groups = new Map<string, number[]>();
    for (const r of glucoseReadings) {
      const dateKey = r.recordedAt.slice(0, 10);
      const list = groups.get(dateKey) || [];
      list.push(r.glucoseMgDl);
      groups.set(dateKey, list);
    }
    const result = new Map<string, { avg: number; count: number }>();
    groups.forEach((vals, dateKey) => {
      const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
      result.set(dateKey, { avg, count: vals.length });
    });
    return result;
  }, [glucoseReadings]);

  // Mode 1: Continuous timeline (daily device glucose + monthly average HbA1c points)
  const timelineData = useMemo<CombinedPoint[]>(() => {
    const merged = new Map<string, CombinedPoint>();

    dailyGlucoseMap.forEach((g, dateKey) => {
      const ts = new Date(`${dateKey}T12:00:00Z`).getTime();
      merged.set(dateKey, {
        timestamp: ts,
        dateKey,
        label: formatThaiDate(dateKey),
        dailyGlucose: g.avg,
        glucoseReadingCount: g.count,
        hba1cMonthlyAvg: null,
        hba1cCount: 0,
      });
    });

    monthlyHba1cMap.forEach((h) => {
      const existing = merged.get(h.anchorDate);
      if (existing) {
        existing.hba1cMonthlyAvg = h.avg;
        existing.hba1cCount = h.count;
      } else {
        const ts = new Date(`${h.anchorDate}T12:00:00Z`).getTime();
        merged.set(h.anchorDate, {
          timestamp: ts,
          dateKey: h.anchorDate,
          label: formatThaiDate(h.anchorDate),
          dailyGlucose: null,
          glucoseReadingCount: 0,
          hba1cMonthlyAvg: h.avg,
          hba1cCount: h.count,
        });
      }
    });

    return Array.from(merged.values()).sort((a, b) => a.timestamp - b.timestamp);
  }, [dailyGlucoseMap, monthlyHba1cMap]);

  // Mode 2: Monthly aggregated view (monthly avg glucose + monthly avg HbA1c)
  const monthlyData = useMemo<CombinedPoint[]>(() => {
    const monthGlucose = new Map<string, { sum: number; count: number }>();
    for (const r of glucoseReadings) {
      const ym = r.recordedAt.slice(0, 7);
      const curr = monthGlucose.get(ym) || { sum: 0, count: 0 };
      curr.sum += r.glucoseMgDl;
      curr.count += 1;
      monthGlucose.set(ym, curr);
    }

    const allMonths = new Set<string>([
      ...Array.from(monthGlucose.keys()),
      ...Array.from(monthlyHba1cMap.keys()),
    ]);

    return Array.from(allMonths)
      .sort()
      .map((ym) => {
        const g = monthGlucose.get(ym);
        const h = monthlyHba1cMap.get(ym);
        const ts = new Date(`${ym}-15T12:00:00Z`).getTime();
        return {
          timestamp: ts,
          dateKey: ym,
          label: formatThaiMonth(ym),
          dailyGlucose: g ? Math.round(g.sum / g.count) : null,
          glucoseReadingCount: g ? g.count : 0,
          hba1cMonthlyAvg: h ? h.avg : null,
          hba1cCount: h ? h.count : 0,
        };
      });
  }, [glucoseReadings, monthlyHba1cMap]);

  const activeData = viewMode === 'timeline' ? timelineData : monthlyData;

  const sortedHba1c = useMemo(
    () => [...records].sort((a, b) => a.testDate.localeCompare(b.testDate)),
    [records]
  );
  const firstHba1c = sortedHba1c.length > 0 ? sortedHba1c[0].value : null;
  const latestHba1c = sortedHba1c.length > 0 ? sortedHba1c[sortedHba1c.length - 1].value : null;
  const longTermHba1cChange =
    firstHba1c !== null && latestHba1c !== null
      ? Number((latestHba1c - firstHba1c).toFixed(1))
      : null;

  const avgDailyGlucose =
    glucoseReadings.length > 0
      ? Math.round(glucoseReadings.reduce((s, r) => s + r.glucoseMgDl, 0) / glucoseReadings.length)
      : null;

  const latestEag = latestHba1c !== null ? Math.round(28.7 * latestHba1c - 46.7) : null;

  if (records.length === 0 && glucoseReadings.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center min-h-[260px] gap-4">
        <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
          <Activity className="w-5 h-5" />
        </div>
        <div className="space-y-1 max-w-md">
          <h3 className="text-base font-semibold text-slate-900">
            แดชบอร์ดสรุปความสัมพันธ์ HbA1c และระดับน้ำตาลรายวัน
          </h3>
          <p className="text-sm text-slate-600">
            เพิ่มผลตรวจ HbA1c หรือซิงค์ค่าน้ำตาลจากอุปกรณ์เพื่อแสดงกราฟเปรียบเทียบแนวโน้มระยะยาว
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={onAddHba1c}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-xl"
          >
            <Plus className="w-4 h-4" />
            <span>บันทึกผล HbA1c</span>
          </button>
          <button
            type="button"
            onClick={onSyncDevice}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-xl"
          >
            <Smartphone className="w-4 h-4" />
            <span>ซิงค์อุปกรณ์</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5">
      {/* Header & Mode Switch */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-slate-900">
            สรุปผลสุขภาพรวมระยะยาว: น้ำตาลรายวันเทียบ HbA1c เฉลี่ยรายเดือน
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            เปรียบเทียบระดับน้ำตาลรายวันจากอุปกรณ์ (แกนซ้าย mg/dL) ร่วมกับจุดค่า HbA1c เฉลี่ยรายเดือน (แกนขวา %)
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl self-start md:self-center">
          <button
            type="button"
            onClick={() => setViewMode('timeline')}
            className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              viewMode === 'timeline'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ไทม์ไลน์รายวัน + รายเดือน
          </button>
          <button
            type="button"
            onClick={() => setViewMode('monthly')}
            className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              viewMode === 'monthly'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            สรุปค่าเฉลี่ยรายเดือน
          </button>
        </div>
      </div>

      {/* Long-Term Correlation Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
          <div className="text-xs text-slate-500">แนวโน้ม HbA1c ระยะยาว</div>
          <div className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-0.5">
            {longTermHba1cChange !== null
              ? `${longTermHba1cChange > 0 ? '+' : ''}${longTermHba1cChange.toFixed(1)}%`
              : latestHba1c !== null
                ? `${latestHba1c.toFixed(1)}%`
                : '--'}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {firstHba1c !== null && latestHba1c !== null && sortedHba1c.length > 1
              ? `จาก ${firstHba1c.toFixed(1)}% เป็น ${latestHba1c.toFixed(1)}% (${monthlyHba1cMap.size} เดือน)`
              : 'บันทึกต่อเนื่องเพื่อดูความเปลี่ยนแปลง'}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
          <div className="text-xs text-slate-500">น้ำตาลเฉลี่ยจากอุปกรณ์</div>
          <div className="text-lg font-bold text-sky-700 font-mono tabular-nums mt-0.5">
            {avgDailyGlucose !== null ? `${avgDailyGlucose} mg/dL` : '--'}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {dailyGlucoseMap.size > 0
              ? `วัดแล้ว ${dailyGlucoseMap.size} วัน (${glucoseReadings.length} ครั้ง)`
              : 'ยังไม่มีข้อมูลน้ำตาลจากอุปกรณ์'}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
          <div className="text-xs text-slate-500">ความสอดคล้องกับค่า HbA1c (eAG)</div>
          <div className="text-lg font-bold text-teal-700 font-mono tabular-nums mt-0.5">
            {latestEag !== null ? `≈ ${latestEag} mg/dL` : '--'}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {avgDailyGlucose !== null && latestEag !== null
              ? Math.abs(avgDailyGlucose - latestEag) <= 15
                ? 'ค่าน้ำตาลรายวันสอดคล้องกับผล HbA1c'
                : avgDailyGlucose < latestEag
                  ? 'ค่าน้ำตาลช่วงหลังดีขึ้นกว่าค่าเฉลี่ยเดิม'
                  : 'ค่าน้ำตาลรายวันสูงกว่าค่าเฉลี่ย HbA1c เดิม'
              : 'เปรียบเทียบเมื่อมีข้อมูลทั้งสองส่วน'}
          </div>
        </div>
      </div>

      {/* Recharts ComposedChart */}
      <div className="w-full h-[300px]">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <ComposedChart data={activeData} margin={{ top: 14, right: 12, left: -8, bottom: 4 }}>
            <defs>
              <linearGradient id="combinedGlucoseArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0284C7" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#0284C7" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" vertical={false} />

            {viewMode === 'timeline' ? (
              <XAxis
                dataKey="timestamp"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(ts: number) => {
                  const d = new Date(ts);
                  return `${THAI_MONTHS_SHORT[d.getMonth()]} ${(d.getFullYear() + 543).toString().slice(-2)}`;
                }}
                tick={{ fill: '#64748B', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#E2E8F0' }}
                minTickGap={36}
              />
            ) : (
              <XAxis
                dataKey="label"
                tick={{ fill: '#64748B', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#E2E8F0' }}
              />
            )}

            <YAxis
              yAxisId="glucose"
              orientation="left"
              domain={[60, 220]}
              tick={{ fill: '#0369A1', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v}`}
            />
            <YAxis
              yAxisId="hba1c"
              orientation="right"
              domain={[4.5, 10.5]}
              tick={{ fill: '#0F766E', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v.toFixed(1)}%`}
            />

            <Tooltip content={<CustomCombinedTooltip />} />
            <Legend
              verticalAlign="top"
              height={32}
              wrapperStyle={{ fontSize: '12px' }}
            />

            <ReferenceLine
              yAxisId="hba1c"
              y={6.5}
              stroke="#0D9488"
              strokeDasharray="4 4"
              strokeWidth={1.2}
            />
            <ReferenceLine
              yAxisId="glucose"
              y={140}
              stroke="#94A3B8"
              strokeDasharray="2 3"
              strokeWidth={1}
            />

            <Area
              yAxisId="glucose"
              type="monotone"
              dataKey="dailyGlucose"
              name="น้ำตาลจากอุปกรณ์ (mg/dL)"
              stroke="#0284C7"
              strokeWidth={2}
              fill="url(#combinedGlucoseArea)"
              connectNulls
              dot={{ r: 3.5, fill: '#FFFFFF', stroke: '#0284C7', strokeWidth: 2 }}
              activeDot={{ r: 5.5, fill: '#0284C7', stroke: '#FFFFFF', strokeWidth: 2 }}
            />

            <Line
              yAxisId="hba1c"
              type="monotone"
              dataKey="hba1cMonthlyAvg"
              name="HbA1c เฉลี่ยรายเดือน (%)"
              stroke="#0D9488"
              strokeWidth={2.5}
              connectNulls
              dot={{ r: 5.5, fill: '#0D9488', stroke: '#FFFFFF', strokeWidth: 2 }}
              activeDot={{ r: 7.5, fill: '#0F766E', stroke: '#FFFFFF', strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
