import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type {
  ActivityCode,
  AppointmentPurpose,
  DeviceType,
  EClaimStatus,
  Icd10Code,
  InsuranceScheme,
  MealContext,
  PatientPrivatePii,
  PatientProfile,
  ProgramParticipant,
  RecommendationCategory,
  RecommendationPriority,
  RemissionStage,
} from '../types';
import { FIELD_LIMITS, VALID_ICD10_CODES } from '../types';

interface ModalWrapperProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

const ModalWrapper: React.FC<ModalWrapperProps> = ({ title, onClose, children }) => (
  <div
    className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
    role="dialog"
    aria-modal="true"
  >
    <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl border border-slate-200 max-h-[90vh] flex flex-col overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิดหน้าต่าง"
          className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-5 overflow-y-auto">{children}</div>
    </div>
  </div>
);

export const AddHba1cModal: React.FC<{
  defaultIcd10: Icd10Code;
  defaultFacility: string;
  isEligibleNow: boolean;
  eligibilityReason: string;
  onClose: () => void;
  onSubmit: (data: {
    value: number;
    testDate: string;
    loincCode: string;
    icd10Code: Icd10Code;
    facilityName: string;
    activityCode: ActivityCode;
    eClaimStatus: EClaimStatus;
    notes: string;
  }) => Promise<void>;
}> = ({
  defaultIcd10,
  defaultFacility,
  isEligibleNow,
  eligibilityReason,
  onClose,
  onSubmit,
}) => {
  const [valueStr, setValueStr] = useState('6.1');
  const [testDate, setTestDate] = useState(new Date().toISOString().slice(0, 10));
  const [loincCode, setLoincCode] = useState('4548-4');
  const [icd10Code, setIcd10Code] = useState<string>(defaultIcd10);
  const [facilityName, setFacilityName] = useState(defaultFacility);
  const [activityCode, setActivityCode] = useState<ActivityCode>('120');
  const [eClaimStatus, setEClaimStatus] = useState<EClaimStatus>('synced');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (/[<>]/.test(valueStr)) {
      setErrorMsg('ห้ามใส่เครื่องหมาย < หรือ > ในช่องผลตรวจ HbA1c ตามมาตรฐาน LABFU เพื่อป้องกัน REP Error');
      return;
    }
    const parsedVal = Number(valueStr);
    if (Number.isNaN(parsedVal) || parsedVal < 3.0 || parsedVal > 20.0) {
      setErrorMsg('กรุณากรอกค่า HbA1c เป็นตัวเลขระหว่าง 3.0 ถึง 20.0%');
      return;
    }
    if (!VALID_ICD10_CODES.includes(icd10Code as Icd10Code)) {
      setErrorMsg('รหัสวินิจฉัยต้องเป็น E10–E14 เท่านั้น (ห้ามใช้ Z13.1 เพื่อการคัดกรองในการบันทึกผล HbA1c)');
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        value: Number(parsedVal.toFixed(1)),
        testDate,
        loincCode: loincCode.trim() || '4548-4',
        icd10Code: icd10Code as Icd10Code,
        facilityName: facilityName.trim() || 'คลินิกเบาหวาน',
        activityCode,
        eClaimStatus,
        notes: notes.trim(),
      });
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'ไม่สามารถบันทึกข้อมูลได้');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalWrapper title="บันทึกผลตรวจ HbA1c ในเลือด" onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4">
        {!isEligibleNow && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              <strong>แจ้งเตือนเกณฑ์ 90 วัน:</strong> {eligibilityReason}
            </span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              ค่า HbA1c (%) — ตัวเลขเท่านั้น
            </label>
            <input
              type="text"
              inputMode="decimal"
              required
              value={valueStr}
              onChange={(e) => setValueStr(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-teal-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">วันที่ตรวจ</label>
            <input
              type="date"
              required
              value={testDate}
              onChange={(e) => setTestDate(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-teal-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">รหัสวินิจฉัย ICD-10</label>
            <select
              value={icd10Code}
              onChange={(e) => setIcd10Code(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-teal-600"
            >
              {VALID_ICD10_CODES.map((c) => (
                <option key={c} value={c}>
                  {c} (โรคเบาหวาน)
                </option>
              ))}
              <option value="Z13.1">Z13.1 (คัดกรอง - ระบบจะบล็อก)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">รหัส LOINC มาตรฐาน</label>
            <input
              type="text"
              maxLength={FIELD_LIMITS.loincCode}
              value={loincCode}
              onChange={(e) => setLoincCode(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-teal-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">กิจกรรม (Special PP)</label>
            <select
              value={activityCode}
              onChange={(e) => setActivityCode(e.target.value as ActivityCode)}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-teal-600"
            >
              <option value="120">รหัส 120 (DM Remission)</option>
              <option value="standard">ตรวจติดตามมาตรฐาน</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">สถานะส่งข้อมูล 43 แฟ้ม</label>
            <select
              value={eClaimStatus}
              onChange={(e) => setEClaimStatus(e.target.value as EClaimStatus)}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-teal-600"
            >
              <option value="synced">ส่งสำเร็จ (Synced)</option>
              <option value="pending">รอประมวลผล (Pending)</option>
              <option value="rep_error">พบ REP Error</option>
              <option value="late_submission">ส่งล่าช้า (&gt;30 วัน)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">สถานพยาบาล</label>
          <input
            type="text"
            required
            maxLength={FIELD_LIMITS.facilityName}
            value={facilityName}
            onChange={(e) => setFacilityName(e.target.value)}
            className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-teal-600"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">หมายเหตุทางคลินิก</label>
          <textarea
            rows={2}
            maxLength={FIELD_LIMITS.notes}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="ระบุรายละเอียดเพิ่มเติม เช่น หยุดยาต่อเนื่อง, ส่งแล็บจาก HIS..."
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-teal-600"
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={saving}
            className="min-h-[44px] px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-xl disabled:opacity-60"
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึกผลตรวจ'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
};

export const AddDeviceModal: React.FC<{
  onClose: () => void;
  onSubmit: (data: {
    deviceType: DeviceType;
    deviceName: string;
    glucoseMgDl: number;
    systolic: number;
    diastolic: number;
    weightKg: number;
    mealContext: MealContext;
  }) => Promise<void>;
}> = ({ onClose, onSubmit }) => {
  const [deviceType, setDeviceType] = useState<DeviceType>('glucometer');
  const [deviceName, setDeviceName] = useState('Accu-Chek Instant BLE');
  const [glucose, setGlucose] = useState('98');
  const [systolic, setSystolic] = useState('118');
  const [diastolic, setDiastolic] = useState('76');
  const [weightKg, setWeightKg] = useState('66.5');
  const [mealContext, setMealContext] = useState<MealContext>('fasting');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        deviceType,
        deviceName: deviceName.trim() || 'Health Device',
        glucoseMgDl: deviceType === 'glucometer' || deviceType === 'cgm' ? Number(glucose) || 0 : 0,
        systolic: deviceType === 'bp_monitor' ? Number(systolic) || 0 : 0,
        diastolic: deviceType === 'bp_monitor' ? Number(diastolic) || 0 : 0,
        weightKg: deviceType === 'smart_scale' ? Number(weightKg) || 0 : 0,
        mealContext,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalWrapper title="บันทึกค่าจากอุปกรณ์สุขภาพ" onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">ประเภทอุปกรณ์</label>
          <select
            value={deviceType}
            onChange={(e) => {
              const t = e.target.value as DeviceType;
              setDeviceType(t);
              if (t === 'glucometer') setDeviceName('Accu-Chek Instant BLE');
              else if (t === 'cgm') setDeviceName('FreeStyle Libre Sensor');
              else if (t === 'bp_monitor') setDeviceName('Omron HEM-7156T');
              else setDeviceName('Mi Body Composition Scale');
            }}
            className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white"
          >
            <option value="glucometer">เครื่องตรวจน้ำตาลปลายนิ้ว</option>
            <option value="cgm">เซ็นเซอร์วัดน้ำตาลต่อเนื่อง (CGM)</option>
            <option value="bp_monitor">เครื่องวัดความดันโลหิต</option>
            <option value="smart_scale">เครื่องชั่งน้ำหนักอัจฉริยะ</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">ชื่อรุ่นอุปกรณ์</label>
          <input
            type="text"
            required
            maxLength={FIELD_LIMITS.deviceName}
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm"
          />
        </div>

        {(deviceType === 'glucometer' || deviceType === 'cgm') && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">ระดับน้ำตาล (mg/dL)</label>
              <input
                type="number"
                min={20}
                max={600}
                required
                value={glucose}
                onChange={(e) => setGlucose(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">ช่วงเวลาวัด</label>
              <select
                value={mealContext}
                onChange={(e) => setMealContext(e.target.value as MealContext)}
                className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white"
              >
                <option value="fasting">อดอาหารเช้า</option>
                <option value="pre_meal">ก่อนอาหาร</option>
                <option value="post_meal">หลังอาหาร 2 ชม.</option>
                <option value="bedtime">ก่อนนอน</option>
              </select>
            </div>
          </div>
        )}

        {deviceType === 'bp_monitor' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">ค่าบน Systolic (mmHg)</label>
              <input
                type="number"
                min={60}
                max={260}
                required
                value={systolic}
                onChange={(e) => setSystolic(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">ค่าล่าง Diastolic (mmHg)</label>
              <input
                type="number"
                min={40}
                max={160}
                required
                value={diastolic}
                onChange={(e) => setDiastolic(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono"
              />
            </div>
          </div>
        )}

        {deviceType === 'smart_scale' && (
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">น้ำหนักตัว (kg)</label>
            <input
              type="number"
              step="0.1"
              min={20}
              max={300}
              required
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono"
            />
          </div>
        )}

        <div className="flex justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={saving}
            className="min-h-[44px] px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-xl disabled:opacity-60"
          >
            {saving ? 'กำลังซิงค์...' : 'บันทึกเข้าคลาวด์'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
};

export const AddAppointmentModal: React.FC<{
  defaultDoctor: string;
  defaultFacility: string;
  onClose: () => void;
  onSubmit: (data: {
    doctorName: string;
    department: string;
    facility: string;
    appointmentDate: string;
    purpose: AppointmentPurpose;
    reminderEnabled: boolean;
    reminderDaysBefore: number;
    notes: string;
  }) => Promise<void>;
}> = ({ defaultDoctor, defaultFacility, onClose, onSubmit }) => {
  const defaultDt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
  const [doctorName, setDoctorName] = useState(defaultDoctor);
  const [department, setDepartment] = useState('คลินิกเบาหวานระยะสงบ');
  const [facility, setFacility] = useState(defaultFacility);
  const [appointmentDate, setAppointmentDate] = useState(defaultDt);
  const [purpose, setPurpose] = useState<AppointmentPurpose>('remission_eval');
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderDaysBefore, setReminderDaysBefore] = useState(7);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        doctorName: doctorName.trim() || defaultDoctor,
        department: department.trim() || 'คลินิกเบาหวาน',
        facility: facility.trim() || defaultFacility,
        appointmentDate: new Date(appointmentDate).toISOString(),
        purpose,
        reminderEnabled,
        reminderDaysBefore,
        notes: notes.trim(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalWrapper title="เพิ่มนัดหมายแพทย์และตั้งแจ้งเตือน" onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">ชื่อแพทย์</label>
            <input
              type="text"
              required
              maxLength={FIELD_LIMITS.attendingDoctor}
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">วัตถุประสงค์</label>
            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value as AppointmentPurpose)}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white"
            >
              <option value="remission_eval">ประเมิน DM Remission (รหัส 120)</option>
              <option value="hba1c_followup">เจาะเลือด HbA1c ติดตามผล</option>
              <option value="nutrition_consult">ปรึกษาโภชนาการ</option>
              <option value="telemed">พบแพทย์ทางไกล (Telemed)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">วันและเวลานัดหมาย</label>
            <input
              type="datetime-local"
              required
              value={appointmentDate}
              onChange={(e) => setAppointmentDate(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">แจ้งเตือนล่วงหน้าอัตโนมัติ</label>
            <select
              value={reminderDaysBefore}
              onChange={(e) => setReminderDaysBefore(Number(e.target.value))}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white"
            >
              <option value={1}>ล่วงหน้า 1 วัน</option>
              <option value={3}>ล่วงหน้า 3 วัน</option>
              <option value={7}>ล่วงหน้า 7 วัน</option>
              <option value={14}>ล่วงหน้า 14 วัน</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">แผนก / คลินิก</label>
            <input
              type="text"
              required
              maxLength={FIELD_LIMITS.department}
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">สถานพยาบาล</label>
            <input
              type="text"
              required
              maxLength={FIELD_LIMITS.facilityName}
              value={facility}
              onChange={(e) => setFacility(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm"
            />
          </div>
        </div>

        <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={reminderEnabled}
            onChange={(e) => setReminderEnabled(e.target.checked)}
            className="w-4 h-4 accent-teal-600 rounded"
          />
          <span>เปิดระบบแจ้งเตือนอัตโนมัติบนหน้าจอหลัก</span>
        </label>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">คำแนะนำเตรียมตัวก่อนพบแพทย์</label>
          <textarea
            rows={2}
            maxLength={FIELD_LIMITS.notes}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="เช่น งดน้ำและอาหารหลังเที่ยงคืนก่อนเจาะเลือด"
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
          />
        </div>

        <div className="flex justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={saving}
            className="min-h-[44px] px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-xl disabled:opacity-60"
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึกนัดหมาย'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
};

export const AddRecommendationModal: React.FC<{
  defaultDoctor: string;
  onClose: () => void;
  onSubmit: (data: {
    doctorName: string;
    category: RecommendationCategory;
    title: string;
    advice: string;
    priority: RecommendationPriority;
    issuedDate: string;
  }) => Promise<void>;
}> = ({ defaultDoctor, onClose, onSubmit }) => {
  const [doctorName, setDoctorName] = useState(defaultDoctor);
  const [category, setCategory] = useState<RecommendationCategory>('remission_plan');
  const [priority, setPriority] = useState<RecommendationPriority>('routine');
  const [title, setTitle] = useState('');
  const [advice, setAdvice] = useState('');
  const [issuedDate, setIssuedDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        doctorName: doctorName.trim() || defaultDoctor,
        category,
        title: title.trim(),
        advice: advice.trim(),
        priority,
        issuedDate,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalWrapper title="เพิ่มคำแนะนำจากแพทย์" onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">หมวดหมู่</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as RecommendationCategory)}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white"
            >
              <option value="remission_plan">แผน DM Remission</option>
              <option value="nutrition">โภชนาการ</option>
              <option value="exercise">การออกกำลังกาย</option>
              <option value="medication">การปรับยา</option>
              <option value="lab_schedule">ตารางตรวจแล็บ</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">ความสำคัญ</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as RecommendationPriority)}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white"
            >
              <option value="routine">ติดตามปกติ</option>
              <option value="attention">ควรให้ความสำคัญ</option>
              <option value="urgent">เร่งด่วน</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">แพทย์ผู้ให้คำแนะนำ</label>
            <input
              type="text"
              required
              maxLength={FIELD_LIMITS.attendingDoctor}
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">วันที่ออกคำแนะนำ</label>
            <input
              type="date"
              required
              value={issuedDate}
              onChange={(e) => setIssuedDate(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">หัวข้อคำแนะนำ</label>
          <input
            type="text"
            required
            maxLength={FIELD_LIMITS.title}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="เช่น ปรับเวลามื้อเย็นและติดตามน้ำตาลก่อนนอน"
            className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">รายละเอียดคำแนะนำ</label>
          <textarea
            rows={3}
            required
            maxLength={FIELD_LIMITS.advice}
            value={advice}
            onChange={(e) => setAdvice(e.target.value)}
            placeholder="ระบุแนวทางปฏิบัติที่เชื่อมโยงกับผลตรวจ HbA1c..."
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
          />
        </div>

        <div className="flex justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={saving}
            className="min-h-[44px] px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-xl disabled:opacity-60"
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึกคำแนะนำ'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
};

export const EditProfileModal: React.FC<{
  profile: PatientProfile;
  pii: PatientPrivatePii | null;
  userEmail: string;
  onClose: () => void;
  onSubmit: (
    nextProfile: Omit<PatientProfile, 'ownerId' | 'createdAt' | 'updatedAt'>,
    nextPii: Omit<PatientPrivatePii, 'ownerId' | 'updatedAt'>
  ) => Promise<void>;
}> = ({ profile, pii, userEmail, onClose, onSubmit }) => {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [icd10Code, setIcd10Code] = useState<Icd10Code>(profile.icd10Code);
  const [typeArea, setTypeArea] = useState(profile.typeArea);
  const [remissionStage, setRemissionStage] = useState<RemissionStage>(profile.remissionStage);
  const [activityCode120, setActivityCode120] = useState(profile.activityCode120);
  const [targetHba1c, setTargetHba1c] = useState(String(profile.targetHba1c));
  const [medsFreeMonths, setMedsFreeMonths] = useState(String(profile.medsFreeMonths));
  const [clinicName, setClinicName] = useState(profile.clinicName);
  const [attendingDoctor, setAttendingDoctor] = useState(profile.attendingDoctor);

  const [cidMasked, setCidMasked] = useState(pii?.cidMasked || '1-XXXX-XXXXX-XX-1');
  const [birthDate, setBirthDate] = useState(pii?.birthDate || '1980-01-01');
  const [phone, setPhone] = useState(pii?.phone || '');
  const [insuranceScheme, setInsuranceScheme] = useState<InsuranceScheme>(
    pii?.insuranceScheme || 'UCS'
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit(
        {
          displayName: displayName.trim() || 'ผู้ป่วย DM Remission',
          icd10Code,
          typeArea,
          remissionStage,
          activityCode120,
          targetHba1c: Math.max(4.5, Math.min(9.0, Number(targetHba1c) || 6.4)),
          medsFreeMonths: Math.max(0, Math.min(600, Number(medsFreeMonths) || 0)),
          clinicName: clinicName.trim(),
          attendingDoctor: attendingDoctor.trim(),
        },
        {
          cidMasked: cidMasked.trim() || 'XXXX',
          fullName: displayName.trim() || 'ผู้ป่วย DM Remission',
          birthDate,
          phone: phone.trim(),
          email: pii?.email || userEmail,
          insuranceScheme,
        }
      );
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalWrapper title="แก้ไขข้อมูลสุขภาพและข้อมูลส่วนบุคคล (PDPA)" onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">ชื่อ-สกุลผู้ป่วย</label>
            <input
              type="text"
              required
              maxLength={FIELD_LIMITS.displayName}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">รหัสโรค ICD-10</label>
            <select
              value={icd10Code}
              onChange={(e) => setIcd10Code(e.target.value as Icd10Code)}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white"
            >
              {VALID_ICD10_CODES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Type Area</label>
            <select
              value={typeArea}
              onChange={(e) => setTypeArea(Number(e.target.value))}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white"
            >
              <option value={1}>1 (ในเขต)</option>
              <option value={2}>2 (นอกเขต)</option>
              <option value={3}>3 (ในเขต/อาศัย)</option>
              <option value={4}>4 (นอกเขต)</option>
              <option value={5}>5 (อื่น ๆ)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">เป้าหมาย HbA1c</label>
            <input
              type="number"
              step="0.1"
              min="4.5"
              max="9.0"
              value={targetHba1c}
              onChange={(e) => setTargetHba1c(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">ปลอดยา (เดือน)</label>
            <input
              type="number"
              min="0"
              max="600"
              value={medsFreeMonths}
              onChange={(e) => setMedsFreeMonths(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">สถานะ DM Remission</label>
            <select
              value={remissionStage}
              onChange={(e) => setRemissionStage(e.target.value as RemissionStage)}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white"
            >
              <option value="sustained_remission">DM Remission ยั่งยืน</option>
              <option value="in_remission">เข้าสู่เกณฑ์ DM Remission</option>
              <option value="improving">กำลังดีขึ้นต่อเนื่อง</option>
              <option value="active_dm">กำลังควบคุมระดับน้ำตาล</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">สิทธิการรักษา</label>
            <select
              value={insuranceScheme}
              onChange={(e) => setInsuranceScheme(e.target.value as InsuranceScheme)}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white"
            >
              <option value="UCS">บัตรทอง (UCS)</option>
              <option value="SSS">ประกันสังคม (SSS)</option>
              <option value="CSMBS">ข้าราชการ (CSMBS)</option>
              <option value="SelfPay">ชำระเอง</option>
              <option value="Other">อื่น ๆ</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">เลขบัตรฯ ปกปิด (CID)</label>
            <input
              type="text"
              maxLength={FIELD_LIMITS.cidMasked}
              value={cidMasked}
              onChange={(e) => setCidMasked(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">วันเดือนปีเกิด</label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">เบอร์โทรศัพท์</label>
            <input
              type="text"
              maxLength={FIELD_LIMITS.phone}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">แพทย์ผู้ดูแล</label>
            <input
              type="text"
              maxLength={FIELD_LIMITS.attendingDoctor}
              value={attendingDoctor}
              onChange={(e) => setAttendingDoctor(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">หน่วยบริการประจำ</label>
          <input
            type="text"
            maxLength={FIELD_LIMITS.clinicName}
            value={clinicName}
            onChange={(e) => setClinicName(e.target.value)}
            className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm"
          />
        </div>

        <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={activityCode120}
            onChange={(e) => setActivityCode120(e.target.checked)}
            className="w-4 h-4 accent-teal-600 rounded"
          />
          <span>เข้าโครงการ DM Remission (บันทึกกิจกรรมรหัส 120 Special PP)</span>
        </label>

        <div className="flex justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={saving}
            className="min-h-[44px] px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-xl disabled:opacity-60"
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
};

function computeParticipantStage(currentHba1c: number, medsFreeMonths: number): RemissionStage {
  if (currentHba1c < 6.5 && medsFreeMonths >= 3) return 'sustained_remission';
  if (currentHba1c < 6.5) return 'in_remission';
  if (currentHba1c <= 7.5) return 'improving';
  return 'active_dm';
}

function addDaysIso(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export const EnrollParticipantModal: React.FC<{
  defaultClinic: string;
  existingCount: number;
  onClose: () => void;
  onSubmit: (data: {
    participantCode: string;
    displayName: string;
    icd10Code: Icd10Code;
    typeArea: number;
    activityCode: ActivityCode;
    enrolledDate: string;
    baselineHba1c: number;
    currentHba1c: number;
    targetHba1c: number;
    medsFreeMonths: number;
    remissionStage: RemissionStage;
    lastCheckupDate: string;
    nextFollowupDate: string;
    clinicName: string;
    notes: string;
  }) => Promise<void>;
}> = ({ defaultClinic, existingCount, onClose, onSubmit }) => {
  const todayIso = new Date().toISOString().slice(0, 10);
  const nextIndex = String(existingCount + 1).padStart(3, '0');
  const [participantCode, setParticipantCode] = useState(`RC-69-${nextIndex}`);
  const [displayName, setDisplayName] = useState('');
  const [icd10Code, setIcd10Code] = useState<string>('E11');
  const [typeArea, setTypeArea] = useState<number>(1);
  const [activityCode, setActivityCode] = useState<ActivityCode>('120');
  const [enrolledDate, setEnrolledDate] = useState(todayIso);
  const [baselineStr, setBaselineStr] = useState('7.8');
  const [currentStr, setCurrentStr] = useState('7.8');
  const [targetStr, setTargetStr] = useState('6.4');
  const [medsFreeStr, setMedsFreeStr] = useState('0');
  const [nextFollowupDate, setNextFollowupDate] = useState(addDaysIso(todayIso, 91));
  const [clinicName, setClinicName] = useState(defaultClinic);
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!displayName.trim()) {
      setErrorMsg('กรุณาระบุชื่อ-สกุลผู้ป่วยที่เข้าร่วมกิจกรรม');
      return;
    }
    if (!participantCode.trim()) {
      setErrorMsg('กรุณาระบุรหัสผู้เข้าร่วมกิจกรรม');
      return;
    }
    if (!VALID_ICD10_CODES.includes(icd10Code as Icd10Code)) {
      setErrorMsg('รหัสวินิจฉัยต้องเป็น E10–E14 เท่านั้น (ไม่อนุญาตรหัส Z13.1 เพื่อคัดกรอง)');
      return;
    }
    if (/[<>]/.test(baselineStr) || /[<>]/.test(currentStr)) {
      setErrorMsg('ห้ามใส่เครื่องหมาย < หรือ > ในช่องค่า HbA1c กรุณาระบุเป็นตัวเลขเท่านั้น');
      return;
    }

    const baselineVal = Number(baselineStr);
    const currentVal = Number(currentStr);
    const targetVal = Number(targetStr);
    const medsFreeVal = Math.max(0, Math.min(600, Math.round(Number(medsFreeStr) || 0)));

    if (
      Number.isNaN(baselineVal) ||
      baselineVal < 3.0 ||
      baselineVal > 20.0 ||
      Number.isNaN(currentVal) ||
      currentVal < 3.0 ||
      currentVal > 20.0
    ) {
      setErrorMsg('กรุณาระบุค่า HbA1c ตั้งต้นและปัจจุบันระหว่าง 3.0 ถึง 20.0%');
      return;
    }
    if (Number.isNaN(targetVal) || targetVal < 4.0 || targetVal > 10.0) {
      setErrorMsg('เป้าหมาย HbA1c ต้องอยู่ระหว่าง 4.0 ถึง 10.0%');
      return;
    }

    const computedStage = computeParticipantStage(currentVal, medsFreeVal);

    setSaving(true);
    try {
      await onSubmit({
        participantCode: participantCode.trim(),
        displayName: displayName.trim(),
        icd10Code: icd10Code as Icd10Code,
        typeArea,
        activityCode,
        enrolledDate,
        baselineHba1c: Number(baselineVal.toFixed(1)),
        currentHba1c: Number(currentVal.toFixed(1)),
        targetHba1c: Number(targetVal.toFixed(1)),
        medsFreeMonths: medsFreeVal,
        remissionStage: computedStage,
        lastCheckupDate: enrolledDate,
        nextFollowupDate,
        clinicName: clinicName.trim() || defaultClinic,
        notes: notes.trim(),
      });
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'ไม่สามารถเพิ่มผู้ป่วยเข้าร่วมกิจกรรมได้');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalWrapper title="เพิ่มผู้ป่วยเข้าร่วมกิจกรรม RemissionCare" onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4">
        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">รหัสผู้เข้าร่วม</label>
            <input
              type="text"
              required
              maxLength={FIELD_LIMITS.participantCode}
              value={participantCode}
              onChange={(e) => setParticipantCode(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-teal-600"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">ชื่อ-สกุลผู้ป่วย</label>
            <input
              type="text"
              required
              maxLength={FIELD_LIMITS.displayName}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="เช่น นางวิภาวรรณ สุขใจ"
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-teal-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">รหัสโรค ICD-10</label>
            <select
              value={icd10Code}
              onChange={(e) => setIcd10Code(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-teal-600"
            >
              {VALID_ICD10_CODES.map((c) => (
                <option key={c} value={c}>
                  {c} (เบาหวาน)
                </option>
              ))}
              <option value="Z13.1">Z13.1 (คัดกรอง - บล็อก)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Type Area</label>
            <select
              value={typeArea}
              onChange={(e) => setTypeArea(Number(e.target.value))}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-teal-600"
            >
              <option value={1}>1 (ในเขต/ทะเบียน)</option>
              <option value={2}>2 (นอกเขต)</option>
              <option value={3}>3 (ในเขต/อาศัย)</option>
              <option value={4}>4 (นอกเขต)</option>
              <option value={5}>5 (อื่น ๆ)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">รหัสกิจกรรม</label>
            <select
              value={activityCode}
              onChange={(e) => setActivityCode(e.target.value as ActivityCode)}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-teal-600"
            >
              <option value="120">รหัส 120 (Special PP)</option>
              <option value="standard">ติดตามมาตรฐาน</option>
            </select>
          </div>
        </div>

        {(typeArea === 2 || typeArea === 4 || typeArea === 5) && (
          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
            Type Area {typeArea} จัดเป็นกลุ่มนอกเขตรับผิดชอบ ระบบจะแสดงป้ายกำกับแยกจากกลุ่มเป้าหมายในเขต (1, 3)
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">HbA1c ตั้งต้น (%)</label>
            <input
              type="text"
              inputMode="decimal"
              required
              value={baselineStr}
              onChange={(e) => setBaselineStr(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-teal-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">HbA1c ล่าสุด (%)</label>
            <input
              type="text"
              inputMode="decimal"
              required
              value={currentStr}
              onChange={(e) => setCurrentStr(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-teal-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">เป้าหมาย (%)</label>
            <input
              type="number"
              step="0.1"
              min="4.0"
              max="10.0"
              required
              value={targetStr}
              onChange={(e) => setTargetStr(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-teal-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">ปลอดยา (เดือน)</label>
            <input
              type="number"
              min="0"
              max="600"
              required
              value={medsFreeStr}
              onChange={(e) => setMedsFreeStr(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-teal-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">วันที่เข้าร่วมกิจกรรม</label>
            <input
              type="date"
              required
              value={enrolledDate}
              onChange={(e) => {
                setEnrolledDate(e.target.value);
                setNextFollowupDate(addDaysIso(e.target.value, 91));
              }}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-teal-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">วันนัดติดตามรอบถัดไป (91+ วัน)</label>
            <input
              type="date"
              required
              value={nextFollowupDate}
              onChange={(e) => setNextFollowupDate(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-teal-600"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">คลินิก / หน่วยบริการ</label>
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
          <label className="block text-xs font-medium text-slate-700 mb-1">แผนดูแล / หมายเหตุเริ่มต้น</label>
          <textarea
            rows={2}
            maxLength={FIELD_LIMITS.notes}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="เช่น ปรับลดคาร์โบไฮเดรตมื้อเย็น นัดติดตามผล HbA1c อีก 3 เดือน"
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-teal-600"
          />
        </div>

        <div className="flex justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={saving}
            className="min-h-[44px] px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-xl disabled:opacity-60"
          >
            {saving ? 'กำลังลงทะเบียน...' : 'เพิ่มเข้าร่วมกิจกรรม'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
};

export const UpdateParticipantProgressModal: React.FC<{
  participant: ProgramParticipant;
  onClose: () => void;
  onSubmit: (
    participantId: string,
    updates: {
      currentHba1c: number;
      targetHba1c: number;
      medsFreeMonths: number;
      remissionStage: RemissionStage;
      activityCode: ActivityCode;
      lastCheckupDate: string;
      nextFollowupDate: string;
      notes: string;
    }
  ) => Promise<void>;
}> = ({ participant, onClose, onSubmit }) => {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [currentStr, setCurrentStr] = useState(String(participant.currentHba1c));
  const [targetStr, setTargetStr] = useState(String(participant.targetHba1c));
  const [medsFreeStr, setMedsFreeStr] = useState(String(participant.medsFreeMonths));
  const [remissionStage, setRemissionStage] = useState<RemissionStage>(participant.remissionStage);
  const [activityCode, setActivityCode] = useState<ActivityCode>(participant.activityCode);
  const [lastCheckupDate, setLastCheckupDate] = useState(todayIso);
  const [nextFollowupDate, setNextFollowupDate] = useState(addDaysIso(todayIso, 91));
  const [notes, setNotes] = useState(participant.notes);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleAutoStage = (nextHba1cStr: string, nextMedsStr: string) => {
    const h = Number(nextHba1cStr);
    const m = Number(nextMedsStr) || 0;
    if (!Number.isNaN(h) && h >= 3 && h <= 20) {
      setRemissionStage(computeParticipantStage(h, m));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (/[<>]/.test(currentStr)) {
      setErrorMsg('ห้ามใส่เครื่องหมาย < หรือ > ในช่องค่า HbA1c กรุณากรอกเป็นตัวเลขเท่านั้น');
      return;
    }
    const currentVal = Number(currentStr);
    const targetVal = Number(targetStr);
    const medsFreeVal = Math.max(0, Math.min(600, Math.round(Number(medsFreeStr) || 0)));

    if (Number.isNaN(currentVal) || currentVal < 3.0 || currentVal > 20.0) {
      setErrorMsg('กรุณากรอกค่า HbA1c ล่าสุดระหว่าง 3.0 ถึง 20.0%');
      return;
    }
    if (Number.isNaN(targetVal) || targetVal < 4.0 || targetVal > 10.0) {
      setErrorMsg('เป้าหมาย HbA1c ต้องอยู่ระหว่าง 4.0 ถึง 10.0%');
      return;
    }

    setSaving(true);
    try {
      await onSubmit(participant.id, {
        currentHba1c: Number(currentVal.toFixed(1)),
        targetHba1c: Number(targetVal.toFixed(1)),
        medsFreeMonths: medsFreeVal,
        remissionStage,
        activityCode,
        lastCheckupDate,
        nextFollowupDate,
        notes: notes.trim(),
      });
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'ไม่สามารถอัปเดตผลติดตามได้');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalWrapper title={`อัปเดตความก้าวหน้า: ${participant.displayName}`} onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4">
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>
            รหัส: <strong className="font-mono text-slate-900">{participant.participantCode}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            HbA1c ตั้งต้น:{' '}
            <strong className="font-mono text-slate-900">{participant.baselineHba1c.toFixed(1)}%</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>เข้าร่วมเมื่อ: {participant.enrolledDate}</span>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">HbA1c ล่าสุด (%)</label>
            <input
              type="text"
              inputMode="decimal"
              required
              value={currentStr}
              onChange={(e) => {
                setCurrentStr(e.target.value);
                handleAutoStage(e.target.value, medsFreeStr);
              }}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-teal-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">เป้าหมาย (%)</label>
            <input
              type="number"
              step="0.1"
              min="4.0"
              max="10.0"
              required
              value={targetStr}
              onChange={(e) => setTargetStr(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-teal-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">ปลอดยา (เดือน)</label>
            <input
              type="number"
              min="0"
              max="600"
              required
              value={medsFreeStr}
              onChange={(e) => {
                setMedsFreeStr(e.target.value);
                handleAutoStage(currentStr, e.target.value);
              }}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-teal-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">สถานะ DM Remission</label>
            <select
              value={remissionStage}
              onChange={(e) => setRemissionStage(e.target.value as RemissionStage)}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-teal-600"
            >
              <option value="sustained_remission">DM Remission ยั่งยืน</option>
              <option value="in_remission">เข้าสู่เกณฑ์ DM Remission</option>
              <option value="improving">กำลังดีขึ้นต่อเนื่อง</option>
              <option value="active_dm">กำลังควบคุมระดับน้ำตาล</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">รหัสกิจกรรม</label>
            <select
              value={activityCode}
              onChange={(e) => setActivityCode(e.target.value as ActivityCode)}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-teal-600"
            >
              <option value="120">รหัส 120 (Special PP)</option>
              <option value="standard">ติดตามมาตรฐาน</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">วันที่ติดตามล่าสุด</label>
            <input
              type="date"
              required
              value={lastCheckupDate}
              onChange={(e) => {
                setLastCheckupDate(e.target.value);
                setNextFollowupDate(addDaysIso(e.target.value, 91));
              }}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-teal-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">วันนัดติดตามครั้งถัดไป</label>
            <input
              type="date"
              required
              value={nextFollowupDate}
              onChange={(e) => setNextFollowupDate(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-teal-600"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">บันทึกความคืบหน้า</label>
          <textarea
            rows={2}
            maxLength={FIELD_LIMITS.notes}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-teal-600"
          />
        </div>

        <div className="flex justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={saving}
            className="min-h-[44px] px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-xl disabled:opacity-60"
          >
            {saving ? 'กำลังอัปเดต...' : 'บันทึกความก้าวหน้า'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
};
