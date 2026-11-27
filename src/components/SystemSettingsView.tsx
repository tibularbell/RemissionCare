import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  KeyRound,
  RotateCcw,
  Save,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import {
  DEFAULT_SYSTEM_SETTINGS,
  FIELD_LIMITS,
  type ActivityCode,
  type CareDelegation,
  type CarePermission,
  type CareRole,
  type DelegationStatus,
  type SystemSettings,
} from '../types';
import { formatThaiDate } from '../utils/clinicalAnalytics';

interface SystemSettingsViewProps {
  settings: SystemSettings;
  delegations: CareDelegation[];
  isAdminUser: boolean;
  currentUserEmail: string;
  onSaveSettings: (next: Omit<SystemSettings, 'updatedBy' | 'updatedAt'>) => Promise<void>;
  onAddDelegation: () => void;
  onEditDelegation: (delegation: CareDelegation) => void;
  onUpdateDelegationStatus: (id: string, status: DelegationStatus) => Promise<void>;
  onDeleteDelegation: (id: string) => Promise<void>;
  onGrantCloudAdmin?: (uid: string, displayName: string) => Promise<void>;
}

const ROLE_LABELS: Record<CareRole, string> = {
  system_admin: 'ผู้ดูแลระบบ (System Admin)',
  physician: 'แพทย์ผู้ดูแล (Physician)',
  care_coordinator: 'ผู้ประสานงานคลินิก (Care Coordinator)',
  nurse_auditor: 'พยาบาลตรวจสอบ 43 แฟ้ม (Nurse Auditor)',
};

const PERMISSION_LABELS: Record<CarePermission, string> = {
  manage_settings: 'แก้ไขตั้งค่าระบบ',
  manage_patients: 'จัดการทะเบียนผู้ป่วย',
  edit_hba1c: 'บันทึก/ตรวจผล HbA1c',
  manage_appointments: 'จัดการนัดหมายแพทย์',
  export_reports: 'ส่งออกรายงาน PDF/CSV',
  audit_43files: 'ตรวจสอบ 43 แฟ้ม/REP',
};

const STATUS_LABELS: Record<DelegationStatus, string> = {
  active: 'ปฏิบัติหน้าที่ (Active)',
  paused: 'พักสิทธิ์ชั่วคราว',
  revoked: 'เพิกถอนสิทธิ์แล้ว',
};

export const SystemSettingsView: React.FC<SystemSettingsViewProps> = ({
  settings,
  delegations,
  isAdminUser,
  currentUserEmail,
  onSaveSettings,
  onAddDelegation,
  onEditDelegation,
  onUpdateDelegationStatus,
  onDeleteDelegation,
  onGrantCloudAdmin,
}) => {
  const [organizationName, setOrganizationName] = useState(settings.organizationName);
  const [hba1cTargetStr, setHba1cTargetStr] = useState(String(settings.hba1cRemissionTarget));
  const [intervalDaysStr, setIntervalDaysStr] = useState(String(settings.hba1cIntervalDays));
  const [maxTestsStr, setMaxTestsStr] = useState(String(settings.maxTestsPerFiscalYear));
  const [reminderDaysStr, setReminderDaysStr] = useState(
    String(settings.defaultReminderDaysBefore)
  );
  const [specialPpCode, setSpecialPpCode] = useState<ActivityCode>(settings.specialPpActivityCode);
  const [enforceNumeric, setEnforceNumeric] = useState(settings.enforceNumericHba1cOnly);
  const [blockZ131, setBlockZ131] = useState(settings.blockZ131Screening);
  const [auto91Day, setAuto91Day] = useState(settings.auto91DayFollowup);

  const [savingSettings, setSavingSettings] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<'all' | CareRole>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setOrganizationName(settings.organizationName);
    setHba1cTargetStr(String(settings.hba1cRemissionTarget));
    setIntervalDaysStr(String(settings.hba1cIntervalDays));
    setMaxTestsStr(String(settings.maxTestsPerFiscalYear));
    setReminderDaysStr(String(settings.defaultReminderDaysBefore));
    setSpecialPpCode(settings.specialPpActivityCode);
    setEnforceNumeric(settings.enforceNumericHba1cOnly);
    setBlockZ131(settings.blockZ131Screening);
    setAuto91Day(settings.auto91DayFollowup);
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    setErrorMsg(null);

    const target = Number(hba1cTargetStr);
    const intervalDays = Math.round(Number(intervalDaysStr));
    const maxTests = Math.round(Number(maxTestsStr));
    const reminderDays = Math.round(Number(reminderDaysStr));

    if (!organizationName.trim()) {
      setErrorMsg('กรุณาระบุชื่อหน่วยงานหรือคลินิกหลัก');
      return;
    }
    if (Number.isNaN(target) || target < 4.5 || target > 8.0) {
      setErrorMsg('เกณฑ์เป้าหมาย HbA1c ต้องอยู่ระหว่าง 4.5 ถึง 8.0%');
      return;
    }
    if (Number.isNaN(intervalDays) || intervalDays < 30 || intervalDays > 180) {
      setErrorMsg('ระยะห่างขั้นต่ำการตรวจ HbA1c ต้องอยู่ระหว่าง 30 ถึง 180 วัน');
      return;
    }
    if (Number.isNaN(maxTests) || maxTests < 1 || maxTests > 6) {
      setErrorMsg('โควตาการตรวจต่อปีงบประมาณต้องอยู่ระหว่าง 1 ถึง 6 ครั้ง');
      return;
    }
    if (Number.isNaN(reminderDays) || reminderDays < 1 || reminderDays > 30) {
      setErrorMsg('จำนวนวันแจ้งเตือนล่วงหน้าต้องอยู่ระหว่าง 1 ถึง 30 วัน');
      return;
    }

    setSavingSettings(true);
    try {
      await onSaveSettings({
        organizationName: organizationName.trim().slice(0, FIELD_LIMITS.clinicName),
        hba1cRemissionTarget: Number(target.toFixed(1)),
        hba1cIntervalDays: intervalDays,
        maxTestsPerFiscalYear: maxTests,
        defaultReminderDaysBefore: reminderDays,
        specialPpActivityCode: specialPpCode,
        enforceNumericHba1cOnly: enforceNumeric,
        blockZ131Screening: blockZ131,
        auto91DayFollowup: auto91Day,
      });
      setNotice('บันทึกข้อมูลการตั้งค่าระบบลงบนคลาวด์เรียบร้อยแล้ว');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'ไม่สามารถบันทึกการตั้งค่าระบบได้');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleResetDefaults = () => {
    setOrganizationName(DEFAULT_SYSTEM_SETTINGS.organizationName);
    setHba1cTargetStr(String(DEFAULT_SYSTEM_SETTINGS.hba1cRemissionTarget));
    setIntervalDaysStr(String(DEFAULT_SYSTEM_SETTINGS.hba1cIntervalDays));
    setMaxTestsStr(String(DEFAULT_SYSTEM_SETTINGS.maxTestsPerFiscalYear));
    setReminderDaysStr(String(DEFAULT_SYSTEM_SETTINGS.defaultReminderDaysBefore));
    setSpecialPpCode(DEFAULT_SYSTEM_SETTINGS.specialPpActivityCode);
    setEnforceNumeric(DEFAULT_SYSTEM_SETTINGS.enforceNumericHba1cOnly);
    setBlockZ131(DEFAULT_SYSTEM_SETTINGS.blockZ131Screening);
    setAuto91Day(DEFAULT_SYSTEM_SETTINGS.auto91DayFollowup);
    setNotice('โหลดค่ามาตรฐาน 43 แฟ้ม / สปสช. ลงในฟอร์มแล้ว กรุณากด "บันทึกการตั้งค่าระบบ" เพื่อยืนยัน');
  };

  const filteredDelegations = delegations
    .filter((d) => roleFilter === 'all' || d.role === roleFilter)
    .sort((a, b) => b.assignedDate.localeCompare(a.assignedDate));

  const activeCount = delegations.filter((d) => d.status === 'active').length;
  const adminRoleCount = delegations.filter(
    (d) => d.status === 'active' && d.role === 'system_admin'
  ).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            การมอบหมายการดูแลระบบและตั้งค่าระบบ
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            กำหนดเกณฑ์ทางคลินิก มาตรฐาน 43 แฟ้ม / LOINC และมอบหมายสิทธิ์ทีมสหวิชาชีพในการดูแลระบบ
          </p>
        </div>
        <button
          type="button"
          onClick={onAddDelegation}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-xl transition-colors whitespace-nowrap shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>มอบหมายการดูแลระบบ</span>
        </button>
      </div>

      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center gap-2.5 text-sm text-emerald-900">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-center gap-2.5 text-sm text-red-900">
          <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: System Configuration Form */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <Settings2 className="w-4 h-4 text-teal-600 shrink-0" />
                <span>ข้อมูลการตั้งค่าระบบคลินิก</span>
              </div>
              <p className="text-xs text-slate-500">
                อัปเดตล่าสุดโดย {settings.updatedBy || 'ระบบ'}
              </p>
            </div>
            <span
              className={`text-xs font-medium whitespace-nowrap shrink-0 ${
                isAdminUser ? 'text-teal-700' : 'text-amber-700'
              }`}
            >
              {isAdminUser ? 'สิทธิ์ System Admin' : 'โหมดดูข้อมูล'}
            </span>
          </div>

          {!isAdminUser && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
              บัญชี <strong>{currentUserEmail}</strong> อยู่ในโหมดอ่านการตั้งค่ากลางของระบบ หากต้องการแก้ไขพารามิเตอร์กลาง กรุณาให้ผู้ดูแลระบบหลักเพิ่มสิทธิ์ในคอลเลกชัน Admin
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                ชื่อหน่วยงาน / คลินิกหลัก
              </label>
              <input
                type="text"
                required
                disabled={!isAdminUser}
                maxLength={FIELD_LIMITS.clinicName}
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-teal-600 disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  เกณฑ์เป้าหมาย HbA1c (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="4.5"
                  max="8.0"
                  required
                  disabled={!isAdminUser}
                  value={hba1cTargetStr}
                  onChange={(e) => setHba1cTargetStr(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono tabular-nums focus:outline-none focus:border-teal-600 disabled:bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  ระยะห่างตรวจขั้นต่ำ (วัน)
                </label>
                <input
                  type="number"
                  min="30"
                  max="180"
                  required
                  disabled={!isAdminUser}
                  value={intervalDaysStr}
                  onChange={(e) => setIntervalDaysStr(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono tabular-nums focus:outline-none focus:border-teal-600 disabled:bg-slate-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  โควตาตรวจ/ปีงบฯ (ครั้ง)
                </label>
                <input
                  type="number"
                  min="1"
                  max="6"
                  required
                  disabled={!isAdminUser}
                  value={maxTestsStr}
                  onChange={(e) => setMaxTestsStr(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono tabular-nums focus:outline-none focus:border-teal-600 disabled:bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  แจ้งเตือนนัดล่วงหน้า (วัน)
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  required
                  disabled={!isAdminUser}
                  value={reminderDaysStr}
                  onChange={(e) => setReminderDaysStr(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono tabular-nums focus:outline-none focus:border-teal-600 disabled:bg-slate-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                รหัสกิจกรรมมาตรฐาน (Special PP)
              </label>
              <select
                disabled={!isAdminUser}
                value={specialPpCode}
                onChange={(e) => setSpecialPpCode(e.target.value as ActivityCode)}
                className="w-full min-h-[44px] px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-teal-600 disabled:bg-slate-50"
              >
                <option value="120">รหัส 120 (DM Remission Special PP)</option>
                <option value="standard">ตรวจติดตามมาตรฐาน</option>
              </select>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <label className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!isAdminUser}
                  checked={enforceNumeric}
                  onChange={(e) => setEnforceNumeric(e.target.checked)}
                  className="w-4 h-4 accent-teal-600 rounded mt-0.5 shrink-0"
                />
                <span>บังคับผล HbA1c เป็นตัวเลขเท่านั้น (ป้องกัน &lt; / &gt; ที่ทำให้เกิด REP Error)</span>
              </label>

              <label className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!isAdminUser}
                  checked={blockZ131}
                  onChange={(e) => setBlockZ131(e.target.checked)}
                  className="w-4 h-4 accent-teal-600 rounded mt-0.5 shrink-0"
                />
                <span>บล็อกรหัสคัดกรอง Z13.1 ในแฟ้มผลแล็บเบาหวาน (อนุญาตเฉพาะ E10–E14)</span>
              </label>

              <label className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!isAdminUser}
                  checked={auto91Day}
                  onChange={(e) => setAuto91Day(e.target.checked)}
                  className="w-4 h-4 accent-teal-600 rounded mt-0.5 shrink-0"
                />
                <span>เปิดนัดติดตามผล HbA1c รอบวันที่ 91+ อัตโนมัติหลังลงทะเบียนผู้ป่วยใหม่</span>
              </label>
            </div>

            {isAdminUser && (
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>ค่ามาตรฐาน 43 แฟ้ม</span>
                </button>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-60"
                >
                  <Save className="w-4 h-4" />
                  <span>{savingSettings ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าระบบ'}</span>
                </button>
              </div>
            )}
          </form>
        </section>

        {/* Right: Care & System Administration Delegation */}
        <section className="lg:col-span-7 space-y-4">
          {/* Summary KPI Row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1">
              <div className="text-xs text-slate-500">ผู้รับมอบหมายทั้งหมด</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                {delegations.length}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1">
              <div className="text-xs text-slate-500">ปฏิบัติหน้าที่อยู่</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-teal-700">
                {activeCount}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1">
              <div className="text-xs text-slate-500">ผู้ดูแลระบบ (Admin)</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                {adminRoleCount}
              </div>
            </div>
          </div>

          {/* Role Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1 border-b border-slate-200">
            <button
              type="button"
              onClick={() => setRoleFilter('all')}
              className={`min-h-[40px] px-3 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                roleFilter === 'all'
                  ? 'border-teal-600 text-teal-700 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              ทุกบทบาท
            </button>
            {(Object.keys(ROLE_LABELS) as CareRole[]).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setRoleFilter(role)}
                className={`min-h-[40px] px-3 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  roleFilter === role
                    ? 'border-teal-600 text-teal-700 font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {ROLE_LABELS[role].split(' (')[0]}
              </button>
            ))}
          </div>

          {/* Delegation Cards */}
          {filteredDelegations.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
              <UserCheck className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-700">
                  ยังไม่มีรายการมอบหมายการดูแลระบบในหมวดนี้
                </p>
                <p className="text-xs text-slate-500">
                  เพิ่มแพทย์ พยาบาลตรวจสอบ 43 แฟ้ม หรือผู้ดูแลระบบร่วมเพื่อให้ช่วยติดตามผู้ป่วยได้อย่างเป็นระบบ
                </p>
              </div>
              <button
                type="button"
                onClick={onAddDelegation}
                className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-xl transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                <span>เพิ่มการมอบหมายใหม่</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDelegations.map((item) => {
                const isActive = item.status === 'active';
                return (
                  <article
                    key={item.id}
                    className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                          <h3 className="text-base font-semibold text-slate-900">
                            {item.delegateName}
                          </h3>
                          <span
                            className={`text-xs font-medium ${
                              isActive
                                ? 'text-teal-700'
                                : item.status === 'paused'
                                  ? 'text-amber-700'
                                  : 'text-slate-400'
                            }`}
                          >
                            {STATUS_LABELS[item.status]}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                          <span className="font-medium text-slate-700">
                            {ROLE_LABELS[item.role]}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{item.department}</span>
                          {item.delegateEmail && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono">{item.delegateEmail}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => onEditDelegation(item)}
                          className="min-h-[38px] px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-medium rounded-xl transition-colors whitespace-nowrap"
                        >
                          แก้ไขสิทธิ์
                        </button>
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={async () => {
                            setBusyId(item.id);
                            try {
                              await onUpdateDelegationStatus(
                                item.id,
                                isActive ? 'paused' : 'active'
                              );
                            } finally {
                              setBusyId(null);
                            }
                          }}
                          className="min-h-[38px] px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-medium rounded-xl transition-colors whitespace-nowrap disabled:opacity-60"
                        >
                          {isActive ? 'พักสิทธิ์' : 'เปิดใช้งาน'}
                        </button>

                        {confirmDeleteId === item.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={busyId === item.id}
                              onClick={async () => {
                                setBusyId(item.id);
                                try {
                                  await onDeleteDelegation(item.id);
                                  setConfirmDeleteId(null);
                                } finally {
                                  setBusyId(null);
                                }
                              }}
                              className="min-h-[38px] px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-xl"
                            >
                              ยืนยันลบ
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="min-h-[38px] px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
                            >
                              ยกเลิก
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(item.id)}
                            aria-label={`ลบการมอบหมาย ${item.delegateName}`}
                            className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-slate-100 space-y-2 text-xs">
                      <div className="text-slate-600">
                        <span className="font-medium text-slate-700">ขอบเขตสิทธิ์: </span>
                        {item.permissions.map((perm, idx) => (
                          <React.Fragment key={perm}>
                            {idx > 0 && <span aria-hidden="true"> · </span>}
                            <span>{PERMISSION_LABELS[perm] || perm}</span>
                          </React.Fragment>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-slate-500">
                        <div>
                          มอบหมาย:{' '}
                          <span className="font-mono text-slate-700">
                            {formatThaiDate(item.assignedDate)}
                          </span>
                          {' · '}
                          หมดอายุ:{' '}
                          <span className="font-mono text-slate-700">
                            {formatThaiDate(item.expiryDate)}
                          </span>
                        </div>

                        {isAdminUser && item.delegateUid && onGrantCloudAdmin && (
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={async () => {
                              setBusyId(item.id);
                              setNotice(null);
                              setErrorMsg(null);
                              try {
                                await onGrantCloudAdmin(item.delegateUid, item.delegateName);
                                setNotice(
                                  `บันทึกสิทธิ์ Cloud Admin ให้ UID ${item.delegateUid} เรียบร้อยแล้ว`
                                );
                              } catch (err) {
                                setErrorMsg(
                                  err instanceof Error
                                    ? err.message
                                    : 'ไม่สามารถเพิ่มสิทธิ์ Cloud Admin ได้'
                                );
                              } finally {
                                setBusyId(null);
                              }
                            }}
                            className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-800 font-medium"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>ซิงค์สิทธิ์ Cloud Admin ({item.delegateUid.slice(0, 8)}…)</span>
                          </button>
                        )}
                      </div>

                      {item.notes && (
                        <p className="text-slate-600 leading-relaxed">
                          หมายเหตุ: {item.notes}
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-start gap-2.5 text-xs text-slate-600 leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
            <span>
              ข้อมูลการมอบหมายสิทธิ์และตั้งค่าระบบถูกตรวจสอบความถูกต้องผ่าน Firestore Security Rules โดยจำกัดการแก้ไขพารามิเตอร์กลางเฉพาะบัญชีผู้ดูแลระบบที่ยืนยันตัวตนแล้วเท่านั้น
            </span>
          </div>
        </section>
      </div>
    </div>
  );
};
