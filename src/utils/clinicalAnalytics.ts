import type { Appointment, DeviceReading, Hba1cRecord, RemissionStage } from '../types';

export interface FiscalEligibilityStatus {
  fiscalYearLabel: string;
  testsInCurrentFiscalYear: number;
  maxTestsPerFiscalYear: number;
  daysSinceLastTest: number | null;
  nextEligibleDate: string | null;
  daysRemainingToWait: number;
  isEligibleNow: boolean;
  reasonTh: string;
}

export interface TrendAnalysis {
  latestValue: number | null;
  previousValue: number | null;
  deltaFromPrevious: number | null;
  overallDelta: number | null;
  direction: 'improving' | 'stable' | 'rising' | 'insufficient';
  projectedNextValue: number | null;
  inRemissionZone: boolean;
  clinicalSummaryTh: string;
  recommendedActionTh: string;
  computedStage: RemissionStage;
}

export interface ActiveReminder {
  appointment: Appointment;
  daysUntil: number;
  isDueNow: boolean;
}

export interface BloodPressureAnalysis {
  readingCount: number;
  latestSystolic: number | null;
  latestDiastolic: number | null;
  latestRecordedAt: string | null;
  avgSystolic: number | null;
  avgDiastolic: number | null;
  highReadingCount: number;
  consecutiveHighCount: number;
  isPersistentHigh: boolean;
  status: 'insufficient' | 'normal' | 'elevated' | 'persistent_high' | 'urgent';
  statusLabelTh: string;
  summaryTh: string;
  preliminaryAdviceTh: string[];
}

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

export function formatThaiDate(dateStr: string): string {
  if (!dateStr) return '-';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  const day = parsed.getDate();
  const month = THAI_MONTHS_SHORT[parsed.getMonth()];
  const yearBe = parsed.getFullYear() + 543;
  return `${day} ${month} ${yearBe}`;
}

export function formatThaiDateTime(isoStr: string): string {
  if (!isoStr) return '-';
  const parsed = new Date(isoStr);
  if (Number.isNaN(parsed.getTime())) return isoStr;
  const day = parsed.getDate();
  const month = THAI_MONTHS_SHORT[parsed.getMonth()];
  const yearBe = parsed.getFullYear() + 543;
  const hh = String(parsed.getHours()).padStart(2, '0');
  const mm = String(parsed.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${yearBe} · ${hh}:${mm} น.`;
}

/**
 * Thai government fiscal year runs Oct 1 (year-1) to Sep 30 (year).
 */
export function getThaiFiscalYear(date: Date): number {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const fiscalAd = month >= 10 ? year + 1 : year;
  return fiscalAd + 543;
}

export function evaluateHbA1cEligibility(
  records: Hba1cRecord[],
  referenceDate = new Date()
): FiscalEligibilityStatus {
  const currentFy = getThaiFiscalYear(referenceDate);
  const sorted = [...records].sort((a, b) => a.testDate.localeCompare(b.testDate));

  const testsInCurrentFiscalYear = sorted.filter((r) => {
    const d = new Date(r.testDate);
    return !Number.isNaN(d.getTime()) && getThaiFiscalYear(d) === currentFy;
  }).length;

  const latest = sorted.length > 0 ? sorted[sorted.length - 1] : null;
  if (!latest) {
    return {
      fiscalYearLabel: `ปีงบประมาณ ${currentFy}`,
      testsInCurrentFiscalYear: 0,
      maxTestsPerFiscalYear: 2,
      daysSinceLastTest: null,
      nextEligibleDate: null,
      daysRemainingToWait: 0,
      isEligibleNow: true,
      reasonTh: 'ยังไม่มีประวัติการตรวจ HbA1c ในระบบ สามารถเข้ารับการตรวจครั้งที่ 1 ได้ทันที (รหัส LOINC 4548-4)',
    };
  }

  const lastDate = new Date(latest.testDate);
  const diffMs = referenceDate.getTime() - lastDate.getTime();
  const daysSinceLastTest = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  const eligibleDateObj = new Date(lastDate.getTime() + 91 * 24 * 60 * 60 * 1000);
  const nextEligibleDate = eligibleDateObj.toISOString().slice(0, 10);
  const daysRemainingToWait = Math.max(0, 91 - daysSinceLastTest);

  if (testsInCurrentFiscalYear >= 2) {
    return {
      fiscalYearLabel: `ปีงบประมาณ ${currentFy}`,
      testsInCurrentFiscalYear,
      maxTestsPerFiscalYear: 2,
      daysSinceLastTest,
      nextEligibleDate,
      daysRemainingToWait,
      isEligibleNow: false,
      reasonTh: `ครบโควตาการตรวจ HbA1c 2 ครั้งใน${`ปีงบประมาณ ${currentFy}`}แล้ว ตามเกณฑ์ สปสช. เพื่อป้องกันข้อมูลติด REP Error`,
    };
  }

  if (daysSinceLastTest < 90) {
    return {
      fiscalYearLabel: `ปีงบประมาณ ${currentFy}`,
      testsInCurrentFiscalYear,
      maxTestsPerFiscalYear: 2,
      daysSinceLastTest,
      nextEligibleDate,
      daysRemainingToWait,
      isEligibleNow: false,
      reasonTh: `ตรวจครั้งล่าสุดผ่านมา ${daysSinceLastTest} วัน ต้องเว้นระยะห่างอย่างน้อย 90 วัน (เริ่มตรวจได้ตั้งแต่วันที่ 91: ${formatThaiDate(nextEligibleDate)})`,
    };
  }

  return {
    fiscalYearLabel: `ปีงบประมาณ ${currentFy}`,
    testsInCurrentFiscalYear,
    maxTestsPerFiscalYear: 2,
    daysSinceLastTest,
    nextEligibleDate,
    daysRemainingToWait: 0,
    isEligibleNow: true,
    reasonTh: `ผ่านเกณฑ์ระยะห่าง ${daysSinceLastTest} วัน (≥ 90 วัน) และยังไม่เกิน 2 ครั้ง/ปีงบประมาณ พร้อมส่งตรวจรอบถัดไป`,
  };
}

export function analyzeHbA1cTrend(
  records: Hba1cRecord[],
  medsFreeMonths: number
): TrendAnalysis {
  const sorted = [...records].sort((a, b) => a.testDate.localeCompare(b.testDate));
  if (sorted.length === 0) {
    return {
      latestValue: null,
      previousValue: null,
      deltaFromPrevious: null,
      overallDelta: null,
      direction: 'insufficient',
      projectedNextValue: null,
      inRemissionZone: false,
      clinicalSummaryTh: 'ยังไม่มีผลตรวจ HbA1c กรุณาบันทึกผลตรวจแรกเพื่อเริ่มวิเคราะห์แนวโน้ม DM Remission',
      recommendedActionTh: 'บันทึกรหัสวินิจฉัย E10–E14 และค่า HbA1c ที่เป็นตัวเลขมาตรฐาน',
      computedStage: 'active_dm',
    };
  }

  const latest = sorted[sorted.length - 1];
  const prev = sorted.length > 1 ? sorted[sorted.length - 2] : null;
  const first = sorted[0];

  const deltaFromPrevious = prev ? Number((latest.value - prev.value).toFixed(2)) : null;
  const overallDelta = sorted.length > 1 ? Number((latest.value - first.value).toFixed(2)) : null;
  const inRemissionZone = latest.value < 6.5;

  let direction: TrendAnalysis['direction'] = 'stable';
  let projectedNextValue: number | null = latest.value;

  if (sorted.length >= 2) {
    const recent = sorted.slice(-3);
    const n = recent.length;
    const xs = recent.map((_, idx) => idx);
    const ys = recent.map((r) => r.value);
    const meanX = xs.reduce((a, b) => a + b, 0) / n;
    const meanY = ys.reduce((a, b) => a + b, 0) / n;
    const num = xs.reduce((acc, x, i) => acc + (x - meanX) * (ys[i] - meanY), 0);
    const den = xs.reduce((acc, x) => acc + (x - meanX) ** 2, 0);
    const slope = den === 0 ? 0 : num / den;

    projectedNextValue = Number(Math.max(4.5, Math.min(14.0, latest.value + slope)).toFixed(1));
    if (slope <= -0.15) direction = 'improving';
    else if (slope >= 0.15) direction = 'rising';
    else direction = 'stable';
  }

  let computedStage: RemissionStage = 'active_dm';
  if (latest.value < 6.5 && medsFreeMonths >= 3) {
    computedStage = 'sustained_remission';
  } else if (latest.value < 6.5) {
    computedStage = 'in_remission';
  } else if (latest.value < 7.0 || (deltaFromPrevious !== null && deltaFromPrevious <= -0.4)) {
    computedStage = 'improving';
  }

  let clinicalSummaryTh = '';
  let recommendedActionTh = '';

  if (latest.value < 5.7) {
    clinicalSummaryTh = `ค่า HbA1c ล่าสุด ${latest.value.toFixed(1)}% อยู่ในเกณฑ์ปกติ (< 5.7%) ต่อเนื่องเป็นสัญญาณที่ดีเยี่ยมของ DM Remission`;
    recommendedActionTh = 'คงพฤติกรรมโภชนาการ Low-Carb / Real Food และการออกกำลังกายสม่ำเสมอ พร้อมติดตามผลทุก 3–6 เดือนตามนัดแพทย์';
  } else if (latest.value < 6.5) {
    clinicalSummaryTh = `ค่า HbA1c ล่าสุด ${latest.value.toFixed(1)}% เข้าสู่เป้าหมาย DM Remission (< 6.5%)${medsFreeMonths >= 3 ? ` โดยหยุดยาเบาหวานได้แล้ว ${medsFreeMonths} เดือน` : ''}`;
    recommendedActionTh = 'บันทึกกิจกรรมรหัส 120 (Special PP) และนัดประเมินความยั่งยืนของระยะสงบโรคกับแพทย์เจ้าของไข้ในรอบ 91 วันถัดไป';
  } else if (direction === 'improving') {
    clinicalSummaryTh = `ค่า HbA1c ลดลงต่อเนื่องสู่ ${latest.value.toFixed(1)}% (${deltaFromPrevious !== null ? `${deltaFromPrevious > 0 ? '+' : ''}${deltaFromPrevious.toFixed(1)}%` : ''} จากครั้งก่อน) แนวโน้มกำลังเข้าใกล้เกณฑ์ Remission`;
    recommendedActionTh = 'ส่งผลน้ำตาลปลายนิ้วจากอุปกรณ์เชื่อมต่อทุกสัปดาห์เพื่อให้แพทย์พิจารณาปรับลดยาอย่างปลอดภัย';
  } else if (direction === 'rising') {
    clinicalSummaryTh = `ค่า HbA1c มีแนวโน้มสูงขึ้นเป็น ${latest.value.toFixed(1)}% ควรปรึกษาแพทย์เพื่อปรับแผนโภชนาการและยา`;
    recommendedActionTh = 'ตรวจเช็กแนวโน้มน้ำตาลหลังอาหาร (Post-meal) และนัดพบแพทย์ก่อนกำหนดหากค่าน้ำตาลอดอาหารเกิน 130 mg/dL ต่อเนื่อง';
  } else {
    clinicalSummaryTh = `ค่า HbA1c ล่าสุด ${latest.value.toFixed(1)}% ทรงตัวจากรอบก่อนหน้า ควรติดตามค่าน้ำตาลสะสมอย่างต่อเนื่อง`;
    recommendedActionTh = 'ตั้งเป้าลดระดับน้ำตาลเฉลี่ยลงอีก 0.3–0.5% ผ่านการคุมคาร์โบไฮเดรตเชิงซ้อนและการเดินหลังมื้ออาหาร 15 นาที';
  }

  return {
    latestValue: latest.value,
    previousValue: prev ? prev.value : null,
    deltaFromPrevious,
    overallDelta,
    direction,
    projectedNextValue,
    inRemissionZone,
    clinicalSummaryTh,
    recommendedActionTh,
    computedStage,
  };
}

export function getActiveAppointmentReminders(
  appointments: Appointment[],
  now = new Date()
): ActiveReminder[] {
  return appointments
    .filter((a) => a.status === 'scheduled' && a.reminderEnabled)
    .map((appointment) => {
      const apptTime = new Date(appointment.appointmentDate).getTime();
      const diffDays = Math.ceil((apptTime - now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        appointment,
        daysUntil: diffDays,
        isDueNow: diffDays >= -1 && diffDays <= appointment.reminderDaysBefore,
      };
    })
    .filter((r) => r.daysUntil >= -1)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

export function summarizeDeviceMetrics(readings: DeviceReading[]) {
  const glucoseReadings = readings.filter((r) => r.glucoseMgDl > 0);
  const bpReadings = readings.filter((r) => r.systolic > 0 && r.diastolic > 0);
  const weightReadings = readings.filter((r) => r.weightKg > 0);

  const avgGlucose =
    glucoseReadings.length > 0
      ? Math.round(glucoseReadings.reduce((s, r) => s + r.glucoseMgDl, 0) / glucoseReadings.length)
      : null;

  const sortedBp = [...bpReadings].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  const latestBp = sortedBp.length > 0 ? sortedBp[0] : null;

  const sortedWeight = [...weightReadings].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  const latestWeight = sortedWeight.length > 0 ? sortedWeight[0] : null;

  return {
    avgGlucose,
    glucoseCount: glucoseReadings.length,
    latestBp,
    latestWeight,
  };
}

export function getRemissionStageLabelTh(stage: RemissionStage): string {
  switch (stage) {
    case 'sustained_remission':
      return 'DM Remission ยั่งยืน (≥ 3 เดือน)';
    case 'in_remission':
      return 'เข้าสู่เกณฑ์ DM Remission';
    case 'improving':
      return 'กำลังดีขึ้นต่อเนื่อง';
    case 'active_dm':
      return 'กำลังควบคุมระดับน้ำตาล';
  }
}

export function analyzeBloodPressure(readings: DeviceReading[]): BloodPressureAnalysis {
  const bpReadings = [...readings]
    .filter((r) => r.systolic > 0 && r.diastolic > 0)
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));

  if (bpReadings.length === 0) {
    return {
      readingCount: 0,
      latestSystolic: null,
      latestDiastolic: null,
      latestRecordedAt: null,
      avgSystolic: null,
      avgDiastolic: null,
      highReadingCount: 0,
      consecutiveHighCount: 0,
      isPersistentHigh: false,
      status: 'insufficient',
      statusLabelTh: 'ยังไม่มีข้อมูลความดันโลหิต',
      summaryTh: 'ยังไม่มีการซิงค์ค่าความดันโลหิตจากอุปกรณ์ในระบบ กรุณาวัดและซิงค์ค่าเพื่อช่วยประเมินความเสี่ยงร่วมกับเบาหวาน',
      preliminaryAdviceTh: [],
    };
  }

  const latest = bpReadings[0];
  const avgSystolic = Math.round(
    bpReadings.reduce((sum, r) => sum + r.systolic, 0) / bpReadings.length
  );
  const avgDiastolic = Math.round(
    bpReadings.reduce((sum, r) => sum + r.diastolic, 0) / bpReadings.length
  );

  const isHighBp = (r: DeviceReading) => r.systolic >= 140 || r.diastolic >= 90;
  const isUrgentBp = (r: DeviceReading) => r.systolic >= 180 || r.diastolic >= 120;
  const isElevatedBp = (r: DeviceReading) => r.systolic >= 130 || r.diastolic >= 80;

  const highReadingCount = bpReadings.filter(isHighBp).length;

  let consecutiveHighCount = 0;
  for (const r of bpReadings) {
    if (isHighBp(r)) consecutiveHighCount += 1;
    else break;
  }

  const recentThree = bpReadings.slice(0, 3);
  const recentHighCount = recentThree.filter(isHighBp).length;
  const isPersistentHigh =
    consecutiveHighCount >= 2 ||
    recentHighCount >= 2 ||
    (bpReadings.length >= 2 && (avgSystolic >= 140 || avgDiastolic >= 90)) ||
    isUrgentBp(latest);

  if (isUrgentBp(latest)) {
    return {
      readingCount: bpReadings.length,
      latestSystolic: latest.systolic,
      latestDiastolic: latest.diastolic,
      latestRecordedAt: latest.recordedAt,
      avgSystolic,
      avgDiastolic,
      highReadingCount,
      consecutiveHighCount,
      isPersistentHigh: true,
      status: 'urgent',
      statusLabelTh: 'ความดันโลหิตสูงระดับวิกฤต (≥ 180/120 mmHg)',
      summaryTh: `ค่าความดันล่าสุด ${latest.systolic}/${latest.diastolic} mmHg สูงเกินเกณฑ์วิกฤต (ค่าเฉลี่ย ${avgSystolic}/${avgDiastolic} mmHg จาก ${bpReadings.length} ครั้ง)`,
      preliminaryAdviceTh: [
        'นั่งพักนิ่ง 5–10 นาที แล้ววัดซ้ำทันที หากค่าความดันยังคง ≥ 180/120 mmHg ควรรีบไปพบแพทย์หรือติดต่อหน่วยบริการฉุกเฉินทันที',
        'สังเกตอาการอันตรายร่วม เช่น เจ็บแน่นหน้าอก หายใจลำบาก ปวดศีรษะรุนแรง ตาพร่ามัว หรือแขนขาอ่อนแรง',
        'ห้ามหยุดยาความดันหรือปรับขนาดยาเองโดยไม่ได้รับคำแนะนำจากแพทย์',
      ],
    };
  }

  if (isPersistentHigh) {
    return {
      readingCount: bpReadings.length,
      latestSystolic: latest.systolic,
      latestDiastolic: latest.diastolic,
      latestRecordedAt: latest.recordedAt,
      avgSystolic,
      avgDiastolic,
      highReadingCount,
      consecutiveHighCount,
      isPersistentHigh: true,
      status: 'persistent_high',
      statusLabelTh: 'พบภาวะความดันโลหิตสูงต่อเนื่อง (≥ 140/90 mmHg)',
      summaryTh: `ตรวจพบค่าความดันโลหิตสูง ≥ 140/90 mmHg จำนวน ${highReadingCount} จาก ${bpReadings.length} ครั้ง (ล่าสุด ${latest.systolic}/${latest.diastolic} mmHg · เฉลี่ย ${avgSystolic}/${avgDiastolic} mmHg)`,
      preliminaryAdviceTh: [
        'วัดความดันซ้ำในท่านั่งพัก 5 นาที วันละ 2 ช่วงเวลา (เช้าหลังตื่นนอน และก่อนนอน) ต่อเนื่อง 7 วันเพื่อนำผลให้แพทย์ประเมิน',
        'จำกัดโซเดียมไม่เกิน 2,000 มก./วัน ลดอาหารแปรรูป น้ำปลา ซอสปรุงรส และควบคู่กับการคุมคาร์โบไฮเดรตในแผน DM Remission',
        'เดินออกกำลังกายระดับปานกลางอย่างน้อย 30 นาที/วัน หลีกเลี่ยงคาเฟอีนก่อนวัดความดัน และนอนพักผ่อนให้เพียงพอ 7–8 ชั่วโมง',
        'นัดพบแพทย์เพื่อประเมินแผนการควบคุมความดันโลหิตให้ต่ำกว่า 130/80 mmHg เพื่อป้องกันภาวะแทรกซ้อนทางไตและหลอดเลือด',
      ],
    };
  }

  if (isHighBp(latest) || isElevatedBp(latest) || avgSystolic >= 130 || avgDiastolic >= 80) {
    return {
      readingCount: bpReadings.length,
      latestSystolic: latest.systolic,
      latestDiastolic: latest.diastolic,
      latestRecordedAt: latest.recordedAt,
      avgSystolic,
      avgDiastolic,
      highReadingCount,
      consecutiveHighCount,
      isPersistentHigh: false,
      status: 'elevated',
      statusLabelTh: 'ความดันโลหิตเริ่มสูงกว่าเกณฑ์แนะนำ (130–139 / 80–89 mmHg)',
      summaryTh: `ค่าความดันล่าสุด ${latest.systolic}/${latest.diastolic} mmHg และค่าเฉลี่ย ${avgSystolic}/${avgDiastolic} mmHg จาก ${bpReadings.length} ครั้ง`,
      preliminaryAdviceTh: [
        'ในผู้ป่วยเบาหวานแนะนำควบคุมความดันให้ต่ำกว่า 130/80 mmHg โดยลดอาหารเค็มจัดและเพิ่มผักใบเขียวในมื้ออาหาร',
        'บันทึกความดันช่วงเช้า–เย็นสัปดาห์ละ 2–3 วัน เพื่อติดตามว่ามีแนวโน้มสูงต่อเนื่องหรือไม่',
      ],
    };
  }

  return {
    readingCount: bpReadings.length,
    latestSystolic: latest.systolic,
    latestDiastolic: latest.diastolic,
    latestRecordedAt: latest.recordedAt,
    avgSystolic,
    avgDiastolic,
    highReadingCount,
    consecutiveHighCount,
    isPersistentHigh: false,
    status: 'normal',
    statusLabelTh: 'ความดันโลหิตอยู่ในเกณฑ์ควบคุมได้ดี (< 130/80 mmHg)',
    summaryTh: `ค่าความดันล่าสุด ${latest.systolic}/${latest.diastolic} mmHg (ค่าเฉลี่ย ${avgSystolic}/${avgDiastolic} mmHg จาก ${bpReadings.length} ครั้ง)`,
    preliminaryAdviceTh: [],
  };
}

