import React, { useMemo, useState } from 'react';
import { Droplets, Smartphone } from 'lucide-react';
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
import type { DeviceReading, MealContext } from '../types';
import { formatThaiDateTime } from '../utils/clinicalAnalytics';

interface GlucoseTrendChartProps {
  readings: DeviceReading[];
  latestHba1c: number | null;
  onSyncDevice: () => void;
}

interface GlucosePoint {
  id: string;
  recordedAt: string;
  shortLabel: string;
  glucoseMgDl: number;
  deviceName: string;
  mealContext: MealContext;
}

const MEAL_LABELS: Record<MealContext, string> = {
  fasting: 'อดอาหารเช้า',
  pre_meal: 'ก่อนอาหาร',
  post_meal: 'หลังอาหาร 2 ชม.',
  bedtime: 'ก่อนนอน',
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: GlucosePoint }>;
}

const CustomGlucoseTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const pt = payload[0].payload;
  const isNormal = pt.glucoseMgDl >= 70 && pt.glucoseMgDl <= 140;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm text-xs space-y-1.5 min-w-[190px]">
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-600">{MEAL_LABELS[pt.mealContext]}</span>
        <span
          className={`font-mono font-semibold tabular-nums ${
            isNormal ? 'text-teal-700' : pt.glucoseMgDl > 180 ? 'text-red-600' : 'text-amber-700'
          }`}
        >
          {pt.glucoseMgDl} mg/dL
        </span>
      </div>
      <div className="pt-1 border-t border-slate-100 text-slate-500 space-y-0.5">
        <div className="font-mono tabular-nums">{formatThaiDateTime(pt.recordedAt)}</div>
        <div>{pt.deviceName}</div>
      </div>
    </div>
  );
};

export const GlucoseTrendChart: React.FC<GlucoseTrendChartProps> = ({
  readings,
  latestHba1c,
  onSyncDevice,
}) => {
  const [contextFilter, setContextFilter] = useState<'all' | 'fasting' | 'post_meal'>('all');

  const allGlucoseReadings = useMemo(
    () =>
      [...readings]
        .filter((r) => r.glucoseMgDl > 0)
        .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt)),
    [readings]
  );

  const chartData = useMemo<GlucosePoint[]>(() => {
    const filtered =
      contextFilter === 'all'
        ? allGlucoseReadings
        : allGlucoseReadings.filter((r) => r.mealContext === contextFilter);

    return filtered.slice(-20).map((r) => {
      const d = new Date(r.recordedAt);
      const shortLabel = Number.isNaN(d.getTime())
        ? r.recordedAt.slice(5, 10)
        : `${d.getDate()}/${d.getMonth() + 1}`;
      return {
        id: r.id,
        recordedAt: r.recordedAt,
        shortLabel,
        glucoseMgDl: r.glucoseMgDl,
        deviceName: r.deviceName,
        mealContext: r.mealContext,
      };
    });
  }, [allGlucoseReadings, contextFilter]);

  // ADAG formula: eAG (mg/dL) = 28.7 * HbA1c - 46.7
  const estimatedAvgFromHba1c =
    latestHba1c !== null ? Math.round(28.7 * latestHba1c - 46.7) : null;

  const currentAvg =
    chartData.length > 0
      ? Math.round(chartData.reduce((sum, p) => sum + p.glucoseMgDl, 0) / chartData.length)
      : null;

  if (allGlucoseReadings.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center min-h-[300px] gap-4">
        <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
          <Droplets className="w-5 h-5" />
        </div>
        <div className="space-y-1 max-w-sm">
          <h3 className="text-base font-semibold text-slate-900">
            ยังไม่มีข้อมูลน้ำตาลจากอุปกรณ์เชื่อมต่อ
          </h3>
          <p className="text-sm text-slate-600">
            ซิงค์ค่าน้ำตาลในเลือด (mg/dL) จากเครื่องตรวจน้ำตาลหรือ CGM เพื่อเปรียบเทียบกับค่า HbA1c
          </p>
        </div>
        <button
          type="button"
          onClick={onSyncDevice}
          className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-xl transition-colors whitespace-nowrap shrink-0"
        >
          <Smartphone className="w-4 h-4" />
          <span>ซิงค์ข้อมูลอุปกรณ์</span>
        </button>
      </div>
    );
  }

  const minG = Math.min(60, ...chartData.map((d) => d.glucoseMgDl - 15));
  const maxG = Math.max(
    160,
    estimatedAvgFromHba1c ? estimatedAvgFromHba1c + 20 : 160,
    ...chartData.map((d) => d.glucoseMgDl + 20)
  );
  const yDomain: [number, number] = [
    Math.floor(minG / 10) * 10,
    Math.ceil(maxG / 10) * 10,
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            แนวโน้มระดับน้ำตาลในเลือดจากอุปกรณ์ (mg/dL)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            พื้นที่สีฟ้าอ่อนคือช่วงเป้าหมาย 70–140 mg/dL · เปรียบเทียบกับค่าเฉลี่ยที่แปลงจาก HbA1c
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl self-start sm:self-center">
          {(
            [
              { id: 'all', label: 'ทั้งหมด' },
              { id: 'fasting', label: 'อดอาหาร' },
              { id: 'post_meal', label: 'หลังอาหาร' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setContextFilter(tab.id)}
              className={`min-h-[34px] px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                contextFilter === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="h-[260px] flex items-center justify-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-xl">
          ไม่มีค่าน้ำตาลในช่วงเวลาที่เลือก
        </div>
      ) : (
        <div className="w-full h-[260px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={chartData} margin={{ top: 12, right: 16, left: -10, bottom: 4 }}>
              <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" vertical={false} />
              <ReferenceArea
                y1={70}
                y2={140}
                fill="#F0FDFA"
                fillOpacity={0.9}
                ifOverflow="extendDomain"
              />
              <XAxis
                dataKey="shortLabel"
                tick={{ fill: '#64748B', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                tickLine={false}
                axisLine={{ stroke: '#E2E8F0' }}
                dy={6}
              />
              <YAxis
                domain={yDomain}
                tick={{ fill: '#64748B', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomGlucoseTooltip />} />
              <ReferenceLine
                y={140}
                stroke="#94A3B8"
                strokeDasharray="3 3"
                strokeWidth={1}
              />
              {estimatedAvgFromHba1c !== null && (
                <ReferenceLine
                  y={estimatedAvgFromHba1c}
                  stroke="#0F766E"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: `เฉลี่ยจาก HbA1c (${estimatedAvgFromHba1c} mg/dL)`,
                    position: 'insideTopRight',
                    fill: '#0F766E',
                    fontSize: 11,
                  }}
                />
              )}
              <Line
                type="monotone"
                dataKey="glucoseMgDl"
                stroke="#0284C7"
                strokeWidth={2.5}
                dot={(dotProps) => {
                  const { cx, cy, payload } = dotProps as {
                    cx?: number;
                    cy?: number;
                    payload?: GlucosePoint;
                  };
                  if (cx === undefined || cy === undefined || !payload) {
                    return <g key={dotProps.key} />;
                  }
                  const color =
                    payload.glucoseMgDl <= 140
                      ? '#0284C7'
                      : payload.glucoseMgDl <= 180
                        ? '#D97706'
                        : '#DC2626';
                  return (
                    <circle
                      key={payload.id}
                      cx={cx}
                      cy={cy}
                      r={4.5}
                      fill="#FFFFFF"
                      stroke={color}
                      strokeWidth={2.3}
                    />
                  );
                }}
                activeDot={{ r: 6.5, fill: '#0284C7', stroke: '#FFFFFF', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono tabular-nums">
          <span className="font-medium text-slate-900">
            ค่าเฉลี่ยอุปกรณ์: {currentAvg !== null ? `${currentAvg} mg/dL` : '--'}
          </span>
          {estimatedAvgFromHba1c !== null && latestHba1c !== null && (
            <>
              <span aria-hidden="true">·</span>
              <span>
                เทียบ HbA1c {latestHba1c.toFixed(1)}% (≈ {estimatedAvgFromHba1c} mg/dL)
              </span>
            </>
          )}
        </div>
        <span className="text-slate-500">ทั้งหมด {chartData.length} ค่า</span>
      </div>
    </div>
  );
};
