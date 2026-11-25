import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileDown,
  HeartPulse,
  Lock,
  Plus,
  ShieldCheck,
  Stethoscope,
  UserCheck,
} from 'lucide-react';
import type {
  DeviceReading,
  DoctorRecommendation,
  Hba1cRecord,
  PatientPrivatePii,
  PatientProfile,
  RecommendationCategory,
} from '../types';
import {
  analyzeBloodPressure,
  analyzeHbA1cTrend,
  formatThaiDate,
  formatThaiDateTime,
} from '../utils/clinicalAnalytics';
import { generateHba1cSummaryPdf } from '../utils/pdfReport';

interface RecommendationsViewProps {
  profile: PatientProfile;
  pii: PatientPrivatePii | null;
  records: Hba1cRecord[];
  deviceReadings: DeviceReading[];
  recommendations: DoctorRecommendation[];
  onAddRecommendation: () => void;
  onAcknowledge: (recId: string) => Promise<void>;
  onEditProfile: () => void;
  onOpenRegistration: () => void;
}

const CATEGORY_LABELS: Record<RecommendationCategory, string> = {
  nutrition: 'โภชนาการ',
  exercise: 'การออกกำลังกาย',
  medication: 'การปรับยา',
  lab_schedule: 'ตารางตรวจแล็บ',
  remission_plan: 'แผน DM Remission',
};

export const RecommendationsView: React.FC<RecommendationsViewProps> = ({
  profile,
  pii,
  records,
  deviceReadings,
  recommendations,
  onAddRecommendation,
  onAcknowledge,
  onEditProfile,
  onOpenRegistration,
}) => {
  const [catFilter, setCatFilter] = useState<'all' | RecommendationCategory>('all');
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const trend = analyzeHbA1cTrend(records, profile.medsFreeMonths);
  const bpAnalysis = analyzeBloodPressure(deviceReadings);

  const filtered = recommendations
    .filter((r) => catFilter === 'all' || r.category === catFilter)
    .sort((a, b) => b.issuedDate.localeCompare(a.issuedDate));

  const handleExportReport = () => {
    setExporting(true);
    setExportNotice(null);
    try {
      const { filename } = generateHba1cSummaryPdf({
        profile,
        pii,
        records,
        recommendations,
      });
      setExportNotice(`ดาวน์โหลดรายงาน PDF (${filename}) เรียบร้อยแล้ว`);
    } catch (err) {
      setExportNotice(
        err instanceof Error ? `ไม่สามารถสร้างรายงานได้: ${err.message}` : 'ไม่สามารถสร้างรายงาน PDF ได้'
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            คำแนะนำจากแพทย์และข้อมูลความปลอดภัยส่วนบุคคล
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            เชื่อมโยงแนวโน้มผลตรวจ HbA1c กับคำแนะนำเฉพาะรายบุคคล พร้อมคุ้มครองข้อมูล PII ด้วยมาตรฐาน Zero-Trust
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start sm:self-center">
          <button
            type="button"
            disabled={exporting}
            onClick={handleExportReport}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-sm font-medium rounded-xl transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
          >
            <FileDown className="w-4 h-4 text-teal-600" />
            <span>{exporting ? 'กำลังสร้าง PDF...' : 'Export Report'}</span>
          </button>
          <button
            type="button"
            onClick={onAddRecommendation}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-xl transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มคำแนะนำจากแพทย์</span>
          </button>
        </div>
      </div>

      {exportNotice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center gap-2.5 text-sm text-emerald-900">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{exportNotice}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Physician Recommendations */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-teal-800">
              <Stethoscope className="w-4 h-4" />
              <span>บทวิเคราะห์แนวโน้มผลตรวจเพื่อการรักษา</span>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">{trend.clinicalSummaryTh}</p>
            <p className="text-xs text-slate-600 pt-1">{trend.recommendedActionTh}</p>
          </div>

          {/* Blood Pressure Analysis & Persistent Hypertension Preliminary Advice */}
          <div
            className={`rounded-2xl border p-5 space-y-3 ${
              bpAnalysis.status === 'urgent'
                ? 'bg-red-50/80 border-red-200'
                : bpAnalysis.isPersistentHigh
                  ? 'bg-amber-50/80 border-amber-200'
                  : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div
                  className={`flex items-center gap-2 text-sm font-semibold ${
                    bpAnalysis.status === 'urgent'
                      ? 'text-red-800'
                      : bpAnalysis.isPersistentHigh
                        ? 'text-amber-900'
                        : 'text-slate-900'
                  }`}
                >
                  {bpAnalysis.isPersistentHigh ? (
                    <AlertTriangle
                      className={`w-4 h-4 shrink-0 ${
                        bpAnalysis.status === 'urgent' ? 'text-red-600' : 'text-amber-600'
                      }`}
                    />
                  ) : (
                    <HeartPulse className="w-4 h-4 shrink-0 text-teal-600" />
                  )}
                  <span>{bpAnalysis.statusLabelTh}</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                  {bpAnalysis.summaryTh}
                </p>
              </div>

              {bpAnalysis.latestSystolic !== null && bpAnalysis.latestDiastolic !== null && (
                <div className="text-right shrink-0">
                  <div className="text-xl font-bold font-mono tabular-nums text-slate-900">
                    {bpAnalysis.latestSystolic}/{bpAnalysis.latestDiastolic}{' '}
                    <span className="text-xs font-normal text-slate-500">mmHg</span>
                  </div>
                  {bpAnalysis.latestRecordedAt && (
                    <div className="text-[11px] font-mono text-slate-500">
                      {formatThaiDateTime(bpAnalysis.latestRecordedAt)}
                    </div>
                  )}
                </div>
              )}
            </div>

            {bpAnalysis.preliminaryAdviceTh.length > 0 && (
              <div className="pt-2.5 border-t border-slate-200/70 space-y-1.5">
                <div className="text-xs font-semibold text-slate-800">
                  {bpAnalysis.isPersistentHigh
                    ? 'คำแนะนำเบื้องต้นเมื่อพบความดันโลหิตสูงต่อเนื่อง:'
                    : 'คำแนะนำเบื้องต้นด้านความดันโลหิต:'}
                </div>
                <ul className="space-y-1 text-xs sm:text-sm text-slate-700 list-disc pl-4 leading-relaxed">
                  {bpAnalysis.preliminaryAdviceTh.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
            <button
              type="button"
              onClick={() => setCatFilter('all')}
              className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                catFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              ทั้งหมด
            </button>
            {(Object.keys(CATEGORY_LABELS) as RecommendationCategory[]).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCatFilter(cat)}
                className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  catFilter === cat ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
              ไม่พบคำแนะนำในหมวดหมู่นี้
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((rec) => (
                <article
                  key={rec.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-xs text-slate-500">
                        {CATEGORY_LABELS[rec.category]} · {rec.doctorName} · {formatThaiDate(rec.issuedDate)}
                        {rec.priority === 'urgent' && (
                          <>
                            <span aria-hidden="true"> · </span>
                            <span className="text-red-600 font-semibold">เร่งด่วน</span>
                          </>
                        )}
                      </div>
                      <h3 className="text-base font-semibold text-slate-900">{rec.title}</h3>
                    </div>

                    {rec.acknowledged ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 whitespace-nowrap shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                        รับทราบแล้ว
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onAcknowledge(rec.id)}
                        className="min-h-[40px] px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium rounded-xl transition-colors whitespace-nowrap shrink-0"
                      >
                        รับทราบคำแนะนำ
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">{rec.advice}</p>
                </article>
              ))}
            </div>
          )}
        </div>

        {/* Right: Isolated PII & Clinical Profile Vault */}
        <aside className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Lock className="w-4 h-4 text-teal-600" />
                <span>ข้อมูลสุขภาพและตัวตนผู้ป่วย (PDPA Vault)</span>
              </div>
              <p className="text-xs text-slate-500">
                จัดเก็บแยกคอลเลกชันเฉพาะเจ้าของบัญชี (Owner-Only Firestore Rules)
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onOpenRegistration}
                className="min-h-[38px] px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-medium rounded-xl transition-colors whitespace-nowrap shrink-0"
              >
                ลงทะเบียน/ค่าตั้งต้น
              </button>
              <button
                type="button"
                onClick={onEditProfile}
                className="min-h-[38px] px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-xl transition-colors whitespace-nowrap shrink-0"
              >
                แก้ไข
              </button>
            </div>
          </div>

          <dl className="divide-y divide-slate-100 text-sm">
            <div className="py-2.5 flex justify-between gap-4">
              <dt className="text-slate-500">ชื่อแสดงผล</dt>
              <dd className="font-medium text-slate-900 text-right">{profile.displayName}</dd>
            </div>
            <div className="py-2.5 flex justify-between gap-4">
              <dt className="text-slate-500">รหัสวินิจฉัยโรค</dt>
              <dd className="font-mono font-medium text-slate-900 text-right">
                ICD-10 {profile.icd10Code}
              </dd>
            </div>
            <div className="py-2.5 flex justify-between gap-4">
              <dt className="text-slate-500">Type Area / สิทธิ</dt>
              <dd className="font-mono text-slate-900 text-right">
                Type {profile.typeArea} · {pii?.insuranceScheme || 'UCS'}
              </dd>
            </div>
            <div className="py-2.5 flex justify-between gap-4">
              <dt className="text-slate-500">เลขบัตรประชาชน (ปกปิด)</dt>
              <dd className="font-mono tabular-nums text-slate-900 text-right">
                {pii?.cidMasked || 'ยังไม่ระบุ'}
              </dd>
            </div>
            <div className="py-2.5 flex justify-between gap-4">
              <dt className="text-slate-500">วันเดือนปีเกิด</dt>
              <dd className="font-mono tabular-nums text-slate-900 text-right">
                {pii?.birthDate ? formatThaiDate(pii.birthDate) : '-'}
              </dd>
            </div>
            <div className="py-2.5 flex justify-between gap-4">
              <dt className="text-slate-500">เบอร์โทรติดต่อ</dt>
              <dd className="font-mono tabular-nums text-slate-900 text-right">
                {pii?.phone || '-'}
              </dd>
            </div>
            <div className="py-2.5 flex justify-between gap-4">
              <dt className="text-slate-500">หน่วยบริการประจำ</dt>
              <dd className="text-slate-900 text-right max-w-[200px] truncate">{profile.clinicName}</dd>
            </div>
          </dl>

          <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl flex items-start gap-2.5 text-xs text-slate-600 leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
            <span>
              ข้อมูลส่วนบุคคล (PII) ถูกแยกเก็บในพาธ <code className="font-mono">/private/pii</code> และตรวจสอบสิทธิ์ด้วยอีเมลที่ยืนยันแล้วทุกครั้งก่อนอ่านหรือบันทึก
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <UserCheck className="w-4 h-4 text-slate-400 shrink-0" />
            <span>ซิงค์ข้อมูลผ่านคลาวด์ Firebase เพื่อใช้งานได้ทั้งมือถือและคอมพิวเตอร์</span>
          </div>
        </aside>
      </div>
    </div>
  );
};
