import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarCheck2,
  CheckCircle2,
  ClipboardCheck,
  Lock,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import {
  FIELD_LIMITS,
  VALID_ICD10_CODES,
  type Icd10Code,
  type InsuranceScheme,
  type PatientPrivatePii,
  type PatientProfile,
  type RemissionStage,
} from '../types';
import { formatThaiDate } from '../utils/clinicalAnalytics';

export interface RegistrationPayload {
  profile: Omit<PatientProfile, 'ownerId' | 'createdAt' | 'updatedAt'>;
  pii: Omit<PatientPrivatePii, 'ownerId' | 'updatedAt'>;
  baselineHba1c?: {
    value: number;
    testDate: string;
    facilityName: string;
  };
  autoSchedule91DayFollowup: boolean;
}

interface PatientRegistrationProps {
  userEmail: string;
  initialDisplayName?: string;
  existingProfile?: PatientProfile | null;
  existingPii?: PatientPrivatePii | null;
  isOnboarding?: boolean;
  onSubmit: (payload: RegistrationPayload) => Promise<void>;
  onLoadDemo?: () => Promise<void>;
  onCancel?: () => void;
  onSignOut?: () => Promise<void>;
}

function validateThaiCid13(rawDigits: string): 'empty' | 'valid' | 'invalid' | 'partial' {
  const digits = rawDigits.replace(/\D/g, '');
  if (digits.length === 0) return 'empty';
  if (digits.length !== 13) return 'partial';
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    sum += Number(digits[i]) * (13 - i);
  }
  const check = (11 - (sum % 11)) % 10;
  return check === Number(digits[12]) ? 'valid' : 'invalid';
}

function maskThaiCid(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 13) {
    return `${digits[0]}-${digits.slice(1, 5)}-XXXXX-${digits.slice(10, 12)}-${digits[12]}`;
  }
  return input.trim().slice(0, FIELD_LIMITS.cidMasked) || '1-XXXX-XXXXX-XX-1';
}

export const PatientRegistration: React.FC<PatientRegistrationProps> = ({
  userEmail,
  initialDisplayName,
  existingProfile,
  existingPii,
  isOnboarding = false,
  onSubmit,
  onLoadDemo,
  onCancel,
  onSignOut,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: PERSON & PDPA
  const [fullName, setFullName] = useState(
    existingPii?.fullName || existingProfile?.displayName || initialDisplayName || ''
  );
  const [cidInput, setCidInput] = useState(existingPii?.cidMasked || '');
  const [birthDate, setBirthDate] = useState(existingPii?.birthDate || '1980-01-01');
  const [phone, setPhone] = useState(existingPii?.phone || '');
  const [insuranceScheme, setInsuranceScheme] = useState<InsuranceScheme>(
    existingPii?.insuranceScheme || 'UCS'
  );
  const [typeArea, setTypeArea] = useState<number>(existingProfile?.typeArea || 1);

  // Step 2: CHRONIC & DM Remission Plan
  const [icd10Code, setIcd10Code] = useState<Icd10Code>(existingProfile?.icd10Code || 'E11');
  const [clinicName, setClinicName] = useState(
    existingProfile?.clinicName || 'คลินิกเบาหวานระยะสงบ รพ.ประจำจังหวัด'
  );
  const [attendingDoctor, setAttendingDoctor] = useState(
    existingProfile?.attendingDoctor || 'นพ. ประจำคลินิกเบาหวาน'
  );
  const [remissionStage, setRemissionStage] = useState<RemissionStage>(
    existingProfile?.remissionStage || 'active_dm'
  );
  const [medsFreeMonths, setMedsFreeMonths] = useState(
    String(existingProfile?.medsFreeMonths ?? 0)
  );
  const [targetHba1c, setTargetHba1c] = useState(
    String(existingProfile?.targetHba1c ?? 6.4)
  );
  const [activityCode120, setActivityCode120] = useState(
    existingProfile?.activityCode120 ?? true
  );

  // Step 3: Baseline HbA1c & Auto 91-Day Follow-up
  const [includeBaseline, setIncludeBaseline] = useState(!existingProfile);
  const [baselineValStr, setBaselineValStr] = useState('7.4');
  const [baselineTestDate, setBaselineTestDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [autoSchedule91Day, setAutoSchedule91Day] = useState(!existingProfile);

  const [submitting, setSubmitting] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cidStatus = useMemo(() => {
    if (cidInput.includes('X')) return 'empty';
    return validateThaiCid13(cidInput);
  }, [cidInput]);

  const next91Date = useMemo(() => {
    const base = new Date(baselineTestDate);
    if (Number.isNaN(base.getTime())) return '';
    const d = new Date(base.getTime() + 91 * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  }, [baselineTestDate]);

  const handleNextStep = () => {
    setErrorMsg(null);
    if (step === 1) {
      if (!fullName.trim()) {
        setErrorMsg('กรุณากรอกชื่อ-นามสกุลผู้ป่วย');
        return;
      }
      if (cidStatus === 'invalid') {
        setErrorMsg('เลขบัตรประชาชน 13 หลักไม่ถูกต้องตามเกณฑ์ตรวจสอบ กรุณาตรวจสอบอีกครั้ง');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!clinicName.trim()) {
        setErrorMsg('กรุณาระบุสถานพยาบาล / หน่วยบริการประจำ');
        return;
      }
      setStep(3);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName.trim()) {
      setErrorMsg('กรุณากรอกชื่อ-นามสกุลผู้ป่วย');
      setStep(1);
      return;
    }

    let baselinePayload: RegistrationPayload['baselineHba1c'] | undefined;
    if (includeBaseline) {
      if (/[<>]/.test(baselineValStr)) {
        setErrorMsg('ห้ามใส่เครื่องหมาย < หรือ > ในช่องค่า HbA1c ตามมาตรฐาน LABFU');
        return;
      }
      const parsed = Number(baselineValStr);
      if (Number.isNaN(parsed) || parsed < 3.0 || parsed > 20.0) {
        setErrorMsg('กรุณากรอกค่า HbA1c ตั้งต้นเป็นตัวเลขระหว่าง 3.0 ถึง 20.0%');
        return;
      }
      baselinePayload = {
        value: Number(parsed.toFixed(1)),
        testDate: baselineTestDate,
        facilityName: clinicName.trim() || 'คลินิกเบาหวาน',
      };
    }

    setSubmitting(true);
    try {
      const cleanName = fullName.trim().slice(0, FIELD_LIMITS.displayName);
      await onSubmit({
        profile: {
          displayName: cleanName,
          icd10Code,
          typeArea,
          remissionStage,
          activityCode120,
          targetHba1c: Math.max(4.5, Math.min(9.0, Number(targetHba1c) || 6.4)),
          medsFreeMonths: Math.max(0, Math.min(600, Number(medsFreeMonths) || 0)),
          clinicName: clinicName.trim().slice(0, FIELD_LIMITS.clinicName),
          attendingDoctor: attendingDoctor.trim().slice(0, FIELD_LIMITS.attendingDoctor) || 'แพทย์ประจำคลินิก',
        },
        pii: {
          cidMasked: maskThaiCid(cidInput),
          fullName: cleanName.slice(0, FIELD_LIMITS.fullName),
          birthDate,
          phone: phone.trim().slice(0, FIELD_LIMITS.phone),
          email: userEmail.slice(0, FIELD_LIMITS.email),
          insuranceScheme,
        },
        baselineHba1c: baselinePayload,
        autoSchedule91DayFollowup: includeBaseline && autoSchedule91Day,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'ไม่สามารถบันทึกการลงทะเบียนได้');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoClick = async () => {
    if (!onLoadDemo) return;
    setErrorMsg(null);
    setLoadingDemo(true);
    try {
      await onLoadDemo();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'ไม่สามารถโหลดชุดข้อมูลตัวอย่างได้');
    } finally {
      setLoadingDemo(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-medium text-teal-700">
            <UserPlus className="w-4 h-4" />
            <span>ลงทะเบียนผู้ป่วยเข้าระบบ RemissionCare · {userEmail}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            {existingProfile ? 'อัปเดตทะเบียนประวัติและค่าตั้งต้นผู้ป่วย' : 'ลงทะเบียนแฟ้มสุขภาพ DM Remission'}
          </h1>
          <p className="text-sm text-slate-600">
            บันทึกข้อมูลบุคคล รหัสวินิจฉัยโรคเบาหวาน และค่าตั้งต้น HbA1c เพื่อติดตามการเปลี่ยนแปลงอย่างต่อเนื่อง
          </p>
        </div>

        {isOnboarding && onLoadDemo && (
          <button
            type="button"
            disabled={loadingDemo || submitting}
            onClick={handleDemoClick}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-xl transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 self-start"
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-700" />
            <span>{loadingDemo ? 'กำลังโหลดตัวอย่าง...' : 'โหลดชุดข้อมูลตัวอย่าง'}</span>
          </button>
        )}
      </div>

      {/* Step Indicator */}
      <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-xl">
        {[
          { num: 1 as const, label: '1. ข้อมูลบุคคล (PERSON)' },
          { num: 2 as const, label: '2. วินิจฉัย & แผนรักษา' },
          { num: 3 as const, label: '3. ค่าตั้งต้นติดตามผล' },
        ].map((item) => (
          <button
            key={item.num}
            type="button"
            onClick={() => setStep(item.num)}
            className={`min-h-[38px] px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors truncate ${
              step === item.num
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 break-words">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Step 1: PERSON & PDPA */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  ชื่อ-นามสกุลผู้ป่วย <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={FIELD_LIMITS.displayName}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="เช่น นายสมชาย ใจดี"
                  className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  เลขประจำตัวประชาชน 13 หลัก (ระบบปกปิดอัตโนมัติ)
                </label>
                <input
                  type="text"
                  maxLength={17}
                  value={cidInput}
                  onChange={(e) => setCidInput(e.target.value)}
                  placeholder="ระบุ 13 หลัก หรือเว้นว่างเพื่อใช้รหัสปกปิด"
                  className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-teal-600"
                />
                {cidStatus === 'valid' && (
                  <p className="text-xs text-emerald-700 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>ตรวจสอบเลขบัตร 13 หลักถูกต้อง (จะจัดเก็บแบบปกปิด {maskThaiCid(cidInput)})</span>
                  </p>
                )}
                {cidStatus === 'invalid' && (
                  <p className="text-xs text-red-600 mt-1">
                    เลขบัตรประชาชน 13 หลักไม่ผ่านการตรวจสอบ Checksum
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">วันเดือนปีเกิด</label>
                <input
                  type="date"
                  required
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">เบอร์โทรศัพท์ติดต่อ</label>
                <input
                  type="tel"
                  maxLength={FIELD_LIMITS.phone}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="08X-XXX-XXXX"
                  className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">สิทธิการรักษา</label>
                <select
                  value={insuranceScheme}
                  onChange={(e) => setInsuranceScheme(e.target.value as InsuranceScheme)}
                  className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-teal-600"
                >
                  <option value="UCS">บัตรทอง (UCS)</option>
                  <option value="SSS">ประกันสังคม (SSS)</option>
                  <option value="CSMBS">ข้าราชการ (CSMBS)</option>
                  <option value="SelfPay">ชำระเงินเอง</option>
                  <option value="Other">สิทธิอื่น ๆ</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                สถานะบุคคลตามทะเบียน (Type Area — แฟ้ม PERSON)
              </label>
              <select
                value={typeArea}
                onChange={(e) => setTypeArea(Number(e.target.value))}
                className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-teal-600"
              >
                <option value={1}>Type 1 — มีชื่อในทะเบียนบ้านและอาศัยอยู่จริงในเขต (กลุ่มเป้าหมายหลัก)</option>
                <option value={3}>Type 3 — อาศัยอยู่จริงในเขตรับผิดชอบแต่ไม่มีชื่อในทะเบียนบ้าน (กลุ่มเป้าหมายหลัก)</option>
                <option value={2}>Type 2 — มีชื่อในทะเบียนบ้านแต่อาศัยอยู่นอกเขต</option>
                <option value={4}>Type 4 — อาศัยอยู่นอกเขตรับผิดชอบ</option>
                <option value={5}>Type 5 — อื่น ๆ (มาขอรับบริการชั่วคราว)</option>
              </select>
              {(typeArea === 2 || typeArea === 4 || typeArea === 5) && (
                <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-xs text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Type Area {typeArea} จัดเป็นผู้ป่วยนอกเขต กรณีขึ้นทะเบียน DM Remission ในเขตแนะนำ Type 1 หรือ Type 3 ตามมาตรฐาน 43 แฟ้ม
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: CHRONIC & Remission Plan */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  รหัสวินิจฉัยโรคเบาหวาน (ICD-10)
                </label>
                <select
                  value={icd10Code}
                  onChange={(e) => setIcd10Code(e.target.value as Icd10Code)}
                  className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-teal-600"
                >
                  {VALID_ICD10_CODES.map((c) => (
                    <option key={c} value={c}>
                      {c} — {c === 'E11' ? 'เบาหวานชนิดที่ 2 (พบบ่อยที่สุด)' : c === 'E10' ? 'เบาหวานชนิดที่ 1' : 'โรคเบาหวานกลุ่มอื่น'}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  ระบบรองรับเฉพาะ E10–E14 เพื่อการขึ้นทะเบียนโรคเรื้อรัง (CHRONIC)
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  ระยะการดูแลปัจจุบัน
                </label>
                <select
                  value={remissionStage}
                  onChange={(e) => setRemissionStage(e.target.value as RemissionStage)}
                  className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-teal-600"
                >
                  <option value="active_dm">กำลังควบคุมระดับน้ำตาล (เริ่มต้น)</option>
                  <option value="improving">ระดับน้ำตาลกำลังลดลงต่อเนื่อง</option>
                  <option value="in_remission">เข้าสู่เกณฑ์ DM Remission (&lt; 6.5%)</option>
                  <option value="sustained_remission">DM Remission ยั่งยืน (≥ 3 เดือน)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  สถานพยาบาล / หน่วยบริการประจำ <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={FIELD_LIMITS.clinicName}
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">แพทย์ผู้ดูแล</label>
                <input
                  type="text"
                  maxLength={FIELD_LIMITS.attendingDoctor}
                  value={attendingDoctor}
                  onChange={(e) => setAttendingDoctor(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-teal-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">เป้าหมาย HbA1c (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="4.5"
                  max="9.0"
                  value={targetHba1c}
                  onChange={(e) => setTargetHba1c(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">ระยะเวลาปลอดยา (เดือน)</label>
                <input
                  type="number"
                  min="0"
                  max="600"
                  value={medsFreeMonths}
                  onChange={(e) => setMedsFreeMonths(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-teal-600"
                />
              </div>
            </div>

            <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={activityCode120}
                onChange={(e) => setActivityCode120(e.target.checked)}
                className="w-4 h-4 accent-teal-600 rounded"
              />
              <span>เข้าร่วมโครงการเบาหวานระยะสงบ (บันทึกกิจกรรมรหัส 120 ใน Special PP)</span>
            </label>
          </div>
        )}

        {/* Step 3: Baseline HbA1c & Follow-up */}
        {step === 3 && (
          <div className="space-y-4">
            <label className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer">
              <input
                type="checkbox"
                checked={includeBaseline}
                onChange={(e) => setIncludeBaseline(e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-teal-600 rounded"
              />
              <div className="space-y-0.5">
                <div className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                  <ClipboardCheck className="w-4 h-4 text-teal-600" />
                  <span>บันทึกค่า HbA1c ตั้งต้น (Baseline) ณ วันลงทะเบียน</span>
                </div>
                <p className="text-xs text-slate-600">
                  ใช้เป็นจุดอ้างอิงแรกในการคำนวณการลดลงของระดับน้ำตาลสะสมและนับเกณฑ์ 90 วัน
                </p>
              </div>
            </label>

            {includeBaseline && (
              <div className="space-y-4 p-4 border border-slate-200 rounded-2xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      ค่า HbA1c ตั้งต้น (%) — ตัวเลขเท่านั้น
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      required={includeBaseline}
                      value={baselineValStr}
                      onChange={(e) => setBaselineValStr(e.target.value)}
                      className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-teal-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      วันที่ตรวจผลเลือดตั้งต้น
                    </label>
                    <input
                      type="date"
                      required={includeBaseline}
                      value={baselineTestDate}
                      onChange={(e) => setBaselineTestDate(e.target.value)}
                      className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-teal-600"
                    />
                  </div>
                </div>

                <label className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoSchedule91Day}
                    onChange={(e) => setAutoSchedule91Day(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-teal-600 rounded"
                  />
                  <span>
                    สร้างนัดหมายแพทย์ติดตามผลรอบถัดไปอัตโนมัติในวันที่ 91 (
                    <strong className="font-mono text-slate-900">
                      {next91Date ? formatThaiDate(next91Date) : '-'}
                    </strong>
                    ) พร้อมเปิดแจ้งเตือนล่วงหน้า 7 วัน
                  </span>
                </label>
              </div>
            )}

            <div className="p-3.5 bg-teal-50/70 border border-teal-200 rounded-xl flex items-start gap-2.5 text-xs text-teal-900">
              <CalendarCheck2 className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
              <span>
                เมื่อยืนยันลงทะเบียน ระบบจะสร้างแฟ้มข้อมูลสุขภาพและคำแนะนำเบื้องต้นให้โดยอัตโนมัติ พร้อมบันทึกการเปลี่ยนแปลงทุกครั้งที่มีการตรวจใหม่หรือซิงค์อุปกรณ์
              </span>
            </div>
          </div>
        )}

        {/* Navigation & Submit Buttons */}
        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Lock className="w-3.5 h-3.5 text-teal-600" />
            <span>ปกป้องข้อมูลส่วนบุคคลด้วย PDPA Vault</span>
            {isOnboarding && onSignOut && (
              <>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="text-slate-600 hover:text-slate-900 font-medium"
                >
                  ออกจากระบบ
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="min-h-[44px] px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl"
              >
                ยกเลิก
              </button>
            )}
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
                className="min-h-[44px] px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-medium rounded-xl"
              >
                ย้อนกลับ
              </button>
            )}
            {step < 3 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="min-h-[44px] px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-xl"
              >
                ถัดไป
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="min-h-[44px] px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl disabled:opacity-60"
              >
                {submitting ? 'กำลังลงทะเบียน...' : existingProfile ? 'บันทึกการลงทะเบียน' : 'ยืนยันลงทะเบียนผู้ป่วย'}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};
