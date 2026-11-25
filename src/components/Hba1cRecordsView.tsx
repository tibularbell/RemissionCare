import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileCheck2,
  Image as ImageIcon,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import type { EClaimStatus, Hba1cRecord, PatientProfile } from '../types';
import { evaluateHbA1cEligibility, formatThaiDate } from '../utils/clinicalAnalytics';

interface Hba1cRecordsViewProps {
  profile: PatientProfile;
  records: Hba1cRecord[];
  onAddRecord: () => void;
  onUpdateStatus: (recordId: string, nextStatus: EClaimStatus) => Promise<void>;
  onDeleteRecord: (recordId: string) => Promise<void>;
}

const STATUS_LABELS: Record<EClaimStatus, string> = {
  synced: 'ส่งข้อมูล 43 แฟ้มสำเร็จ',
  pending: 'รอประมวลผล e-Claim',
  rep_error: 'พบ REP Error (ต้องแก้ไข)',
  late_submission: 'ส่งล่าช้า (>30 วัน)',
};

export const Hba1cRecordsView: React.FC<Hba1cRecordsViewProps> = ({
  profile,
  records,
  onAddRecord,
  onUpdateStatus,
  onDeleteRecord,
}) => {
  const [filter, setFilter] = useState<'all' | EClaimStatus>('all');
  const [query, setQuery] = useState('');
  const [showGuideImage, setShowGuideImage] = useState(false);
  const [imageError, setImageError] = useState(false);

  const eligibility = evaluateHbA1cEligibility(records);

  const filtered = useMemo(() => {
    return [...records]
      .sort((a, b) => b.testDate.localeCompare(a.testDate))
      .filter((r) => {
        if (filter !== 'all' && r.eClaimStatus !== filter) return false;
        if (!query.trim()) return true;
        const q = query.trim().toLowerCase();
        return (
          r.facilityName.toLowerCase().includes(q) ||
          r.icd10Code.toLowerCase().includes(q) ||
          r.loincCode.toLowerCase().includes(q) ||
          r.notes.toLowerCase().includes(q)
        );
      });
  }, [records, filter, query]);

  return (
    <div className="space-y-6">
      {/* Header Action Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            ประวัติผลตรวจ HbA1c และตรวจสอบมาตรฐานข้อมูลคลินิก
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            ติดตามผลเลือดตามรหัส LOINC 4548-4 · วินิจฉัย {profile.icd10Code} · ตรวจสอบเกณฑ์ 90 วันและสถานะ 43 แฟ้ม / e-Claim
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowGuideImage((prev) => !prev)}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl transition-colors whitespace-nowrap shrink-0"
          >
            <ImageIcon className="w-4 h-4 text-teal-600" />
            <span>{showGuideImage ? 'ซ่อนคู่มือ สปสช.' : 'คู่มือ 43 แฟ้ม / สปสช.'}</span>
          </button>
          <button
            type="button"
            onClick={onAddRecord}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-xl transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>บันทึกผลตรวจ HbA1c</span>
          </button>
        </div>
      </div>

      {/* Expandable Official MOPH Guideline Reference */}
      {showGuideImage && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                แนวทางบันทึกและส่งข้อมูลบริการดูแลผู้ป่วยโรคเบาหวาน (HbA1c)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                กลุ่มโรคไม่ติดต่อ สำนักงานป้องกันควบคุมโรคที่ 4 จังหวัดสระบุรี · ตรวจสอบ PERSON, ICD-10 (E10–E14), รหัส 120 (DM Remission) และเกณฑ์ 90 วัน
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-5 border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
              {!imageError ? (
                <img
                  src="/assets/aistudio/image_07f5bc7b.png"
                  alt="แนวทางบันทึกและส่งข้อมูลบริการดูแลผู้ป่วยโรคเบาหวาน HbA1c"
                  referrerPolicy="no-referrer"
                  onError={() => setImageError(true)}
                  className="w-full h-auto object-contain"
                />
              ) : (
                <div className="p-8 text-center text-xs text-slate-500 space-y-2">
                  <FileCheck2 className="w-8 h-8 mx-auto text-teal-600" />
                  <p>มาตรฐานข้อมูล HbA1c (สคร.4 สระบุรี)</p>
                </div>
              )}
            </div>
            <div className="lg:col-span-7 space-y-3 text-sm text-slate-700">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="font-semibold text-slate-900">1. แฟ้ม PERSON และสิทธิการรักษา:</span>{' '}
                ตรวจสอบเลขบัตรประชาชน (CID 13 หลัก), สัญชาติ, วันเกิด และ Type Area 1 หรือ 3 สำหรับผู้ป่วยในเขตรับผิดชอบ
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="font-semibold text-slate-900">2. รหัสวินิจฉัยและ DM Remission:</span>{' '}
                ใช้รหัส ICD-10 E10–E14 เท่านั้น (ห้ามใช้ Z13.1 คัดกรอง) และผู้ป่วยระยะสงบให้บันทึกกิจกรรม <strong>120</strong> ใน Special PP
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="font-semibold text-slate-900">3. ระยะเวลาและความถี่:</span>{' '}
                ตรวจไม่เกิน 2 ครั้งต่อปีงบประมาณ และห่างกัน ≥ 90 วัน (เริ่มตรวจรอบถัดไปได้ตั้งแต่วันที่ 91 เป็นต้นไป)
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="font-semibold text-slate-900">4. รหัส LABFU / LOINC และ Re-submit:</span>{' '}
                ใช้รหัสมาตรฐาน LOINC 4548-4 และกรอกผลเป็นตัวเลขเท่านั้น (ห้ามมี &lt; &gt;) เพื่อป้องกัน Error ในรายงาน REP
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compliance Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1">
          <div className="text-xs text-slate-500">สิทธิ์ตรวจปีงบฯ ({eligibility.fiscalYearLabel})</div>
          <div className="text-lg font-semibold text-slate-900 font-mono tabular-nums">
            ใช้ไป {eligibility.testsInCurrentFiscalYear} จาก {eligibility.maxTestsPerFiscalYear} ครั้ง
          </div>
          <div className="text-xs text-slate-600">
            {eligibility.isEligibleNow ? 'พร้อมส่งตรวจได้ในรอบนี้' : `รอครบ 90 วัน (อีก ${eligibility.daysRemainingToWait} วัน)`}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1">
          <div className="text-xs text-slate-500">ความครบถ้วนรหัสคลินิก</div>
          <div className="text-lg font-semibold text-slate-900 font-mono tabular-nums">
            ICD-10 {profile.icd10Code} · LOINC 4548-4
          </div>
          <div className="text-xs text-slate-600">
            Type Area {profile.typeArea} · กิจกรรม {profile.activityCode120 ? '120 (Remission)' : 'มาตรฐาน'}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1">
          <div className="text-xs text-slate-500">สถานะเชื่อมต่อ HIS / e-Claim</div>
          <div className="text-lg font-semibold text-slate-900 font-mono tabular-nums">
            {records.filter((r) => r.eClaimStatus === 'rep_error').length} รายการต้องแก้ไข
          </div>
          <div className="text-xs text-slate-600">
            ส่งสำเร็จแล้ว {records.filter((r) => r.eClaimStatus === 'synced').length} จาก {records.length} รายการ
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
            {(
              [
                { id: 'all', label: 'ทั้งหมด' },
                { id: 'synced', label: 'ส่งสำเร็จ' },
                { id: 'pending', label: 'รอประมวลผล' },
                { id: 'rep_error', label: 'REP Error' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  filter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาสถานพยาบาล, รหัส, หมายเหตุ..."
              className="w-full min-h-[40px] pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-600"
            />
          </div>
        </div>

        {/* Records Table */}
        {filtered.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-sm font-medium text-slate-900">ไม่พบรายการผลตรวจ HbA1c</p>
            <p className="text-xs text-slate-500">
              ลองเปลี่ยนตัวกรองสถานะ หรือกดปุ่มบันทึกผลตรวจ HbA1c เพื่อเพิ่มข้อมูลใหม่
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4 whitespace-nowrap">วันที่ตรวจ</th>
                  <th className="py-3 px-4 whitespace-nowrap text-right">ค่า HbA1c</th>
                  <th className="py-3 px-4 whitespace-nowrap">รหัส LOINC / ICD-10</th>
                  <th className="py-3 px-4 whitespace-nowrap">สถานพยาบาล</th>
                  <th className="py-3 px-4 whitespace-nowrap">สถานะส่งข้อมูล 43 แฟ้ม</th>
                  <th className="py-3 px-4 whitespace-nowrap text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filtered.map((rec) => {
                  const isError = rec.eClaimStatus === 'rep_error';
                  const isGoodValue = rec.value < 6.5;
                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono tabular-nums text-slate-900">
                        {formatThaiDate(rec.testDate)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-right font-mono tabular-nums font-semibold">
                        <span className={isGoodValue ? 'text-teal-700' : 'text-amber-700'}>
                          {rec.value.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-600 font-mono">
                        {rec.loincCode} · {rec.icd10Code} · รหัส {rec.activityCode === '120' ? '120' : 'Std'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">
                        <div className="font-medium text-slate-900">{rec.facilityName}</div>
                        {rec.notes && (
                          <div className="text-xs text-slate-500 max-w-xs truncate">{rec.notes}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 text-xs font-medium">
                          {isError ? (
                            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                          ) : (
                            <CheckCircle2
                              className={`w-4 h-4 shrink-0 ${
                                rec.eClaimStatus === 'synced' ? 'text-emerald-600' : 'text-amber-600'
                              }`}
                            />
                          )}
                          <span
                            className={
                              isError
                                ? 'text-red-700'
                                : rec.eClaimStatus === 'synced'
                                  ? 'text-emerald-700'
                                  : 'text-amber-700'
                            }
                          >
                            {STATUS_LABELS[rec.eClaimStatus]}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          {rec.eClaimStatus !== 'synced' && (
                            <button
                              type="button"
                              onClick={() => onUpdateStatus(rec.id, 'synced')}
                              title="ส่งข้อมูลซ้ำ (Re-submit)"
                              className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50 rounded-lg transition-colors"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>Re-submit</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onDeleteRecord(rec.id)}
                            aria-label="ลบผลตรวจ"
                            className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
