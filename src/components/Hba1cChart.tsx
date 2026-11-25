import React, { useMemo, useState } from 'react';
import { Activity, Plus } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Hba1cRecord } from '../types';
import { formatThaiDate } from '../utils/clinicalAnalytics';

interface Hba1cChartProps {
  records: Hba1cRecord[];
  targetHba1c: number;
  onAddRecord: () => void;
}

interface ChartPoint {
  id: string;
  testDate: string;
  label: string;
  value: number;
  delta: number | null;
  loincCode: string;
  icd10Code: string;
  facilityName: string;
  activityCode: string;
  notes: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
}

const CustomHba1cTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const pt = payload[0].payload;
  const isRemission = pt.value < 6.5;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm text-xs space-y-1.5 min-w-[200px]">
      <div className="flex items-center justify-between gap-4">
        <span className="font-medium text-slate-600">{formatThaiDate(pt.testDate)}</span>
        <span
          className={`font-mono font-semibold tabular-nums ${
            isRemission ? 'text-teal-700' : pt.value < 7.5 ? 'text-amber-700' : 'text-red-600'
          }`}
        >
          {pt.value.toFixed(1)}%
        </span>
      </div>
      {pt.delta !== null && (
        <div className="text-slate-600 font-mono tabular-nums">
          เปลี่ยนแปลง: {pt.delta > 0 ? `+${pt.delta.toFixed(1)}%` : `${pt.delta.toFixed(1)}%`} จากครั้งก่อน
        </div>
      )}
      <div className="pt-1 border-t border-slate-100 text-slate-500 space-y-0.5">
        <div>{pt.facilityName}</div>
        <div className="font-mono">
          LOINC {pt.loincCode} · {pt.icd10Code} · รหัส {pt.activityCode === '120' ? '120' : 'Std'}
        </div>
      </div>
    </div>
  );
};

export const Hba1cChart: React.FC<Hba1cChartProps> = ({
  records,
  targetHba1c,
  onAddRecord,
}) => {
  const [range, setRange] = useState<'all' | '12m'>('all');

  const chartData = useMemo<ChartPoint[]>(() => {
    const sorted = [...records].sort((a, b) => a.testDate.localeCompare(b.testDate));
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 1);
    const cutoffIso = cutoff.toISOString().slice(0, 10);

    const scoped =
      range === '12m' ? sorted.filter((r) => r.testDate >= cutoffIso) : sorted;

    const listToMap = scoped.length > 0 ? scoped : sorted;

    return listToMap.map((rec, idx) => {
      const prev = idx > 0 ? listToMap[idx - 1] : null;
      const delta = prev ? Number((rec.value - prev.value).toFixed(2)) : null;
      return {
        id: rec.id,
        testDate: rec.testDate,
        label: formatThaiDate(rec.testDate),
        value: rec.value,
        delta,
        loincCode: rec.loincCode,
        icd10Code: rec.icd10Code,
        facilityName: rec.facilityName,
        activityCode: rec.activityCode,
        notes: rec.notes,
      };
    });
  }, [records, range]);

  if (records.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center min-h-[300px] gap-4">
        <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
          <Activity className="w-5 h-5" />
        </div>
        <div className="space-y-1 max-w-sm">
          <h3 className="text-base font-semibold text-slate-900">
            ยังไม่มีข้อมูลกราฟแนวโน้ม HbA1c
          </h3>
          <p className="text-sm text-slate-600">
            บันทึกผลตรวจ HbA1c ครั้งแรกเพื่อแสดงกราฟเส้นแนวโน้มเทียบกับเกณฑ์เป้าหมาย DM Remission (&lt; 6.5%)
          </p>
        </div>
        <button
          type="button"
          onClick={onAddRecord}
          className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-xl transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>บันทึกผล HbA1c แรก</span>
        </button>
      </div>
    );
  }

  const minVal = Math.min(4.5, ...chartData.map((d) => d.value - 0.5));
  const maxVal = Math.max(8.5, targetHba1c + 0.5, ...chartData.map((d) => d.value + 0.8));
  const yDomain: [number, number] = [
    Math.floor(minVal * 2) / 2,
    Math.ceil(maxVal * 2) / 2,
  ];
  const latestPoint = chartData[chartData.length - 1];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            กราฟแนวโน้มค่า HbA1c ย้อนหลัง (%)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            พื้นที่สีเขียวอ่อนคือช่วง DM Remission (&lt; 6.5%) · ชี้ที่จุดบนเส้นเพื่อดูรายละเอียดผลตรวจ
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl self-start sm:self-center">
          <button
            type="button"
            onClick={() => setRange('all')}
            className={`min-h-[34px] px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              range === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ทั้งหมด ({records.length})
          </button>
          <button
            type="button"
            onClick={() => setRange('12m')}
            className={`min-h-[34px] px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              range === '12m' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            12 เดือนล่าสุด
          </button>
        </div>
      </div>

      <div className="w-full h-[260px]">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={chartData} margin={{ top: 12, right: 16, left: -12, bottom: 4 }}>
            <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" vertical={false} />
            <ReferenceArea
              y1={yDomain[0]}
              y2={6.5}
              fill="#ECFDF5"
              fillOpacity={0.8}
              ifOverflow="extendDomain"
            />
            <XAxis
              dataKey="label"
              tick={{ fill: '#64748B', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#E2E8F0' }}
              dy={6}
            />
            <YAxis
              domain={yDomain}
              tick={{ fill: '#64748B', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val: number) => `${val.toFixed(1)}%`}
            />
            <Tooltip content={<CustomHba1cTooltip />} />
            <ReferenceLine
              y={6.5}
              stroke="#0D9488"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: 'เกณฑ์ Remission 6.5%',
                position: 'insideTopRight',
                fill: '#0F766E',
                fontSize: 11,
              }}
            />
            {Math.abs(targetHba1c - 6.5) >= 0.15 && (
              <ReferenceLine
                y={targetHba1c}
                stroke="#0F766E"
                strokeDasharray="2 3"
                strokeWidth={1}
              />
            )}
            <Line
              type="monotone"
              dataKey="value"
              stroke="#0D9488"
              strokeWidth={2.5}
              dot={(dotProps) => {
                const { cx, cy, payload } = dotProps as {
                  cx?: number;
                  cy?: number;
                  payload?: ChartPoint;
                };
                if (cx === undefined || cy === undefined || !payload) {
                  return <g key={dotProps.key} />;
                }
                const color =
                  payload.value < 6.5 ? '#0D9488' : payload.value < 7.5 ? '#D97706' : '#DC2626';
                return (
                  <circle
                    key={payload.id}
                    cx={cx}
                    cy={cy}
                    r={5}
                    fill="#FFFFFF"
                    stroke={color}
                    strokeWidth={2.5}
                  />
                );
              }}
              activeDot={{ r: 7, fill: '#0D9488', stroke: '#FFFFFF', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {latestPoint && (
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-slate-900">ล่าสุด: {latestPoint.value.toFixed(1)}%</span>
            <span aria-hidden="true">·</span>
            <span>{latestPoint.label}</span>
            <span aria-hidden="true">·</span>
            <span>{latestPoint.facilityName}</span>
          </div>
          <span className="font-mono text-slate-500">
            LOINC {latestPoint.loincCode} · ICD-10 {latestPoint.icd10Code}
          </span>
        </div>
      )}
    </div>
  );
};
