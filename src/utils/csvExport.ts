import type { DeviceReading, DeviceType, MealContext } from '../types';

const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  glucometer: 'Glucometer (เครื่องตรวจน้ำตาลปลายนิ้ว)',
  cgm: 'CGM (เซ็นเซอร์ตรวจน้ำตาลต่อเนื่อง)',
  bp_monitor: 'Blood Pressure Monitor (เครื่องวัดความดันโลหิต)',
  smart_scale: 'Smart Scale (เครื่องชั่งน้ำหนัก)',
};

const MEAL_CONTEXT_LABELS: Record<MealContext, string> = {
  fasting: 'Fasting (อดอาหารเช้า)',
  pre_meal: 'Pre-meal (ก่อนมื้ออาหาร)',
  post_meal: 'Post-meal (หลังอาหาร 2 ชม.)',
  bedtime: 'Bedtime (ก่อนนอน)',
};

function escapeCsvCell(raw: string | number): string {
  const str = String(raw ?? '');
  const formulaSafe = /^[=+\-@\t\r]/.test(str) && Number.isNaN(Number(str)) ? `'${str}` : str;
  if (/[",\r\n]/.test(formulaSafe)) {
    return `"${formulaSafe.replace(/"/g, '""')}"`;
  }
  return formulaSafe;
}

export function convertDeviceReadingsToCsv(readings: DeviceReading[]): string {
  const headers = [
    'Recorded At (ISO)',
    'Device Type',
    'Device Name',
    'Glucose (mg/dL)',
    'Systolic (mmHg)',
    'Diastolic (mmHg)',
    'Weight (kg)',
    'Meal Context',
  ];

  const sorted = [...readings].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));

  const rows = sorted.map((r) => [
    r.recordedAt,
    DEVICE_TYPE_LABELS[r.deviceType] || r.deviceType,
    r.deviceName,
    r.glucoseMgDl > 0 ? r.glucoseMgDl : '',
    r.systolic > 0 ? r.systolic : '',
    r.diastolic > 0 ? r.diastolic : '',
    r.weightKg > 0 ? r.weightKg.toFixed(1) : '',
    r.glucoseMgDl > 0 ? MEAL_CONTEXT_LABELS[r.mealContext] || r.mealContext : '',
  ]);

  return [headers, ...rows]
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
    .join('\r\n');
}

export function downloadDeviceReadingsCsv(
  readings: DeviceReading[],
  customFilename?: string
): { filename: string; rowCount: number } {
  const csvContent = convertDeviceReadingsToCsv(readings);
  const dateTag = new Date().toISOString().slice(0, 10);
  const filename = customFilename || `remissioncare-device-readings-${dateTag}.csv`;

  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return { filename, rowCount: readings.length };
}
