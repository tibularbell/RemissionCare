import React, { useState } from 'react';
import {
  Activity,
  Bluetooth,
  CheckCircle2,
  Droplets,
  FileDown,
  HeartPulse,
  Plus,
  RefreshCw,
  Scale,
  Trash2,
} from 'lucide-react';
import type { DeviceReading, DeviceType, MealContext } from '../types';
import { formatThaiDateTime, summarizeDeviceMetrics } from '../utils/clinicalAnalytics';
import { downloadDeviceReadingsCsv } from '../utils/csvExport';
import { GlucoseSparkline } from './GlucoseSparkline';

interface DevicesViewProps {
  readings: DeviceReading[];
  onQuickSyncDevice: (payload: {
    deviceType: DeviceType;
    deviceName: string;
    glucoseMgDl: number;
    systolic: number;
    diastolic: number;
    weightKg: number;
    mealContext: MealContext;
  }) => Promise<void>;
  onOpenManualModal: () => void;
  onDeleteReading: (readingId: string) => Promise<void>;
}

const MEAL_LABELS: Record<MealContext, string> = {
  fasting: 'อดอาหารเช้า (Fasting)',
  pre_meal: 'ก่อนมื้ออาหาร',
  post_meal: 'หลังอาหาร 2 ชม.',
  bedtime: 'ก่อนนอน',
};

const CONNECTED_DEVICES: Array<{
  type: DeviceType;
  name: string;
  protocol: string;
  metricDesc: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    type: 'glucometer',
    name: 'Accu-Chek Instant BLE',
    protocol: 'Bluetooth Low Energy · Cloud Sync',
    metricDesc: 'น้ำตาลปลายนิ้ว (mg/dL)',
    icon: Droplets,
  },
  {
    type: 'cgm',
    name: 'FreeStyle Libre Sensor',
    protocol: 'NFC / Cloud Real-Time',
    metricDesc: 'ระดับน้ำตาลต่อเนื่อง (CGM)',
    icon: Activity,
  },
  {
    type: 'bp_monitor',
    name: 'Omron HEM-7156T',
    protocol: 'Bluetooth GATT · Blood Pressure',
    metricDesc: 'ความดันโลหิต (mmHg)',
    icon: HeartPulse,
  },
  {
    type: 'smart_scale',
    name: 'Mi Body Composition Scale',
    protocol: 'BLE Weight Telemetry',
    metricDesc: 'น้ำหนักตัว (kg)',
    icon: Scale,
  },
];

export const DevicesView: React.FC<DevicesViewProps> = ({
  readings,
  onQuickSyncDevice,
  onOpenManualModal,
  onDeleteReading,
}) => {
  const [syncingType, setSyncingType] = useState<DeviceType | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const summary = summarizeDeviceMetrics(readings);
  const sorted = [...readings].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));

  const handleSimulateSync = async (device: (typeof CONNECTED_DEVICES)[number]) => {
    setSyncingType(device.type);
    setSyncNotice(null);
    try {
      const payload =
        device.type === 'glucometer'
          ? {
              deviceType: device.type,
              deviceName: device.name,
              glucoseMgDl: Math.round(90 + Math.random() * 18),
              systolic: 0,
              diastolic: 0,
              weightKg: 0,
              mealContext: 'fasting' as MealContext,
            }
          : device.type === 'cgm'
            ? {
                deviceType: device.type,
                deviceName: device.name,
                glucoseMgDl: Math.round(108 + Math.random() * 24),
                systolic: 0,
                diastolic: 0,
                weightKg: 0,
                mealContext: 'post_meal' as MealContext,
              }
            : device.type === 'bp_monitor'
              ? {
                  deviceType: device.type,
                  deviceName: device.name,
                  glucoseMgDl: 0,
                  systolic: Math.round(115 + Math.random() * 10),
                  diastolic: Math.round(72 + Math.random() * 8),
                  weightKg: 0,
                  mealContext: 'fasting' as MealContext,
                }
              : {
                  deviceType: device.type,
                  deviceName: device.name,
                  glucoseMgDl: 0,
                  systolic: 0,
                  diastolic: 0,
                  weightKg: Number((66.2 + Math.random() * 1.2).toFixed(1)),
                  mealContext: 'fasting' as MealContext,
                };

      await onQuickSyncDevice(payload);
      setSyncNotice(`ซิงค์ข้อมูลจาก ${device.name} เข้าสู่ระบบคลาวด์เรียบร้อยแล้ว`);
    } finally {
      setSyncingType(null);
    }
  };

  const handleExportReadings = () => {
    if (readings.length === 0) return;
    const { filename, rowCount } = downloadDeviceReadingsCsv(readings);
    setSyncNotice(`ส่งออกข้อมูลอุปกรณ์จำนวน ${rowCount} รายการ (${filename}) เรียบร้อยแล้ว`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            เชื่อมต่ออุปกรณ์สุขภาพและข้อมูลเรียลไทม์
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            รองรับการซิงค์ค่าน้ำตาลปลายนิ้ว, CGM, ความดันโลหิต และน้ำหนักตัวผ่านระบบคลาวด์ทันที
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start sm:self-center">
          <button
            type="button"
            disabled={sorted.length === 0}
            onClick={handleExportReadings}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-sm font-medium rounded-xl transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <FileDown className="w-4 h-4 text-teal-600" />
            <span>Export Readings</span>
          </button>
          <button
            type="button"
            onClick={onOpenManualModal}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-xl transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>บันทึกค่าจากอุปกรณ์เอง</span>
          </button>
        </div>
      </div>

      {syncNotice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center gap-2.5 text-sm text-emerald-900">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{syncNotice}</span>
        </div>
      )}

      {/* Connected Device Hardware Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {CONNECTED_DEVICES.map((dev) => {
          const Icon = dev.icon;
          const isBusy = syncingType === dev.type;
          return (
            <div
              key={dev.type}
              className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <Bluetooth className="w-3.5 h-3.5 text-teal-600" />
                    พร้อมซิงค์
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{dev.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{dev.metricDesc}</p>
                </div>
              </div>

              <button
                type="button"
                disabled={isBusy}
                onClick={() => handleSimulateSync(dev)}
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-medium rounded-xl transition-colors disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isBusy ? 'animate-spin' : ''}`} />
                <span>{isBusy ? 'กำลังซิงค์...' : 'ซิงค์ค่าล่าสุดทันที'}</span>
              </button>
            </div>
          );
        })}
      </section>

      {/* Glucose Sparkline & Telemetry Summary */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">แนวโน้มระดับน้ำตาลรายวัน</h3>
              <p className="text-xs text-slate-500">เป้าหมายควบคุม 70–140 mg/dL</p>
            </div>
            <div className="text-right font-mono tabular-nums">
              <div className="text-lg font-bold text-slate-900">
                {summary.avgGlucose !== null ? `${summary.avgGlucose} mg/dL` : '--'}
              </div>
              <div className="text-xs text-slate-500">ค่าเฉลี่ย</div>
            </div>
          </div>
          <GlucoseSparkline readings={readings} />
        </div>

        {/* Telemetry History Table */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">
              บันทึกข้อมูลจากอุปกรณ์ ({sorted.length})
            </h3>
            <span className="text-xs text-slate-500">อัปเดตคลาวด์เรียลไทม์</span>
          </div>
          {sorted.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              ยังไม่มีข้อมูลจากอุปกรณ์ กด "ซิงค์ค่าล่าสุดทันที" ด้านบนเพื่อเริ่มต้น
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[340px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                    <th className="py-2.5 px-4 whitespace-nowrap">เวลาที่บันทึก</th>
                    <th className="py-2.5 px-4 whitespace-nowrap">อุปกรณ์</th>
                    <th className="py-2.5 px-4 whitespace-nowrap text-right">ค่าที่วัดได้</th>
                    <th className="py-2.5 px-4 whitespace-nowrap">บริบท</th>
                    <th className="py-2.5 px-4 whitespace-nowrap text-right">ลบ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {sorted.map((item) => {
                    let metricStr = '-';
                    if (item.glucoseMgDl > 0) metricStr = `${item.glucoseMgDl} mg/dL`;
                    else if (item.systolic > 0) metricStr = `${item.systolic}/${item.diastolic} mmHg`;
                    else if (item.weightKg > 0) metricStr = `${item.weightKg.toFixed(1)} kg`;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/60">
                        <td className="py-3 px-4 whitespace-nowrap text-xs font-mono tabular-nums text-slate-600">
                          {formatThaiDateTime(item.recordedAt)}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-900 text-xs sm:text-sm">
                          {item.deviceName}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-right font-mono tabular-nums font-semibold text-teal-700">
                          {metricStr}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-500">
                          {item.glucoseMgDl > 0 ? MEAL_LABELS[item.mealContext] : 'วัดช่วงเช้า'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-right">
                          <button
                            type="button"
                            onClick={() => onDeleteReading(item.id)}
                            aria-label="ลบข้อมูลอุปกรณ์"
                            className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center text-slate-400 hover:text-red-600 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
