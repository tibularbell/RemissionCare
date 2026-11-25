import React, { useMemo } from 'react';
import type { DeviceReading } from '../types';

interface GlucoseSparklineProps {
  readings: DeviceReading[];
}

export const GlucoseSparkline: React.FC<GlucoseSparklineProps> = ({ readings }) => {
  const glucosePoints = useMemo(() => {
    return [...readings]
      .filter((r) => r.glucoseMgDl > 0)
      .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
      .slice(-12);
  }, [readings]);

  if (glucosePoints.length < 2) {
    return (
      <div className="h-28 flex items-center justify-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl">
        ซิงค์ค่าน้ำตาลจากอุปกรณ์อย่างน้อย 2 ครั้งเพื่อแสดงแนวโน้มรายวัน
      </div>
    );
  }

  const width = 420;
  const height = 120;
  const padX = 16;
  const padY = 16;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const minG = Math.min(65, ...glucosePoints.map((p) => p.glucoseMgDl - 10));
  const maxG = Math.max(160, ...glucosePoints.map((p) => p.glucoseMgDl + 15));

  const toX = (i: number) => padX + (i / (glucosePoints.length - 1)) * innerW;
  const toY = (g: number) => padY + innerH - ((g - minG) / (maxG - minG)) * innerH;

  const path = glucosePoints
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(pt.glucoseMgDl).toFixed(1)}`)
    .join(' ');

  const y140 = toY(140);
  const y70 = toY(70);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-28" role="img" aria-label="กราฟค่าน้ำตาลจากอุปกรณ์">
      <rect
        x={padX}
        y={y140}
        width={innerW}
        height={Math.max(0, y70 - y140)}
        fill="#F0FDFA"
        rx={4}
      />
      <line x1={padX} y1={y140} x2={padX + innerW} y2={y140} stroke="#CBD5E1" strokeDasharray="3 3" />
      <path d={path} fill="none" stroke="#0D9488" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      {glucosePoints.map((pt, i) => (
        <circle
          key={pt.id}
          cx={toX(i)}
          cy={toY(pt.glucoseMgDl)}
          r={3.5}
          fill="#FFFFFF"
          stroke={pt.glucoseMgDl > 140 ? '#D97706' : '#0D9488'}
          strokeWidth={2}
        />
      ))}
    </svg>
  );
};
