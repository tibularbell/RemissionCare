import React, { useState } from 'react';
import {
  Bell,
  BellOff,
  BellRing,
  CalendarPlus,
  Check,
  Clock,
  MapPin,
  XCircle,
} from 'lucide-react';
import type { Appointment, AppointmentPurpose } from '../types';
import { formatThaiDateTime, getActiveAppointmentReminders } from '../utils/clinicalAnalytics';

interface AppointmentsViewProps {
  appointments: Appointment[];
  onAddAppointment: () => void;
  onToggleReminder: (id: string, enabled: boolean, daysBefore: number) => Promise<void>;
  onUpdateAppointmentStatus: (id: string, status: 'completed' | 'cancelled') => Promise<void>;
}

const PURPOSE_LABELS: Record<AppointmentPurpose, string> = {
  hba1c_followup: 'ตรวจติดตาม HbA1c',
  remission_eval: 'ประเมิน DM Remission (รหัส 120)',
  nutrition_consult: 'ปรึกษาโภชนาการ',
  telemed: 'พบแพทย์ทางไกล (Telemed)',
};

export const AppointmentsView: React.FC<AppointmentsViewProps> = ({
  appointments,
  onAddAppointment,
  onToggleReminder,
  onUpdateAppointmentStatus,
}) => {
  const [notifStatus, setNotifStatus] = useState<string | null>(null);

  const reminders = getActiveAppointmentReminders(appointments);
  const scheduled = [...appointments]
    .filter((a) => a.status === 'scheduled')
    .sort((a, b) => a.appointmentDate.localeCompare(b.appointmentDate));
  const history = [...appointments]
    .filter((a) => a.status !== 'scheduled')
    .sort((a, b) => b.appointmentDate.localeCompare(a.appointmentDate));

  const handleEnableBrowserAlerts = async () => {
    if (!('Notification' in window)) {
      setNotifStatus('เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือนแบบ Pop-up แต่ระบบจะแสดงแถบแจ้งเตือนบนแดชบอร์ดให้อัตโนมัติ');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      new Notification('RemissionCare — เปิดใช้งานแจ้งเตือนนัดหมายแพทย์แล้ว', {
        body:
          reminders.length > 0
            ? `นัดหมายถัดไป: ${reminders[0].appointment.doctorName} (${formatThaiDateTime(reminders[0].appointment.appointmentDate)})`
            : 'ระบบจะแจ้งเตือนล่วงหน้าก่อนวันนัดหมายแพทย์โดยอัตโนมัติ',
      });
      setNotifStatus('เปิดการแจ้งเตือนผ่านเบราว์เซอร์สำเร็จ ระบบส่งการแจ้งเตือนทดสอบแล้ว');
    } else {
      setNotifStatus('ไม่ได้รับสิทธิ์ Pop-up จากเบราว์เซอร์ ระบบจะแสดงแจ้งเตือนภายในแอปให้อัตโนมัติ');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            นัดหมายแพทย์และการแจ้งเตือนอัตโนมัติ
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            แจ้งเตือนล่วงหน้าอัตโนมัติก่อนถึงวันตรวจเลือด HbA1c และนัดประเมินภาวะ DM Remission
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleEnableBrowserAlerts}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl transition-colors whitespace-nowrap shrink-0"
          >
            <BellRing className="w-4 h-4 text-teal-600" />
            <span>ทดสอบแจ้งเตือนอัตโนมัติ</span>
          </button>
          <button
            type="button"
            onClick={onAddAppointment}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-xl transition-colors whitespace-nowrap shrink-0"
          >
            <CalendarPlus className="w-4 h-4" />
            <span>เพิ่มนัดหมายแพทย์</span>
          </button>
        </div>
      </div>

      {notifStatus && (
        <div className="bg-slate-100 border border-slate-200 rounded-xl p-3.5 text-sm text-slate-800">
          {notifStatus}
        </div>
      )}

      {/* Scheduled Appointments */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold text-slate-900">
          นัดหมายที่กำลังจะมาถึง ({scheduled.length})
        </h3>
        {scheduled.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
            <p className="text-sm text-slate-600">ยังไม่มีนัดหมายแพทย์ที่กำลังจะมาถึง</p>
            <button
              type="button"
              onClick={onAddAppointment}
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-xl"
            >
              <CalendarPlus className="w-4 h-4" />
              <span>สร้างนัดหมายแรก</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scheduled.map((appt) => {
              const reminderInfo = reminders.find((r) => r.appointment.id === appt.id);
              const isDue = reminderInfo?.isDueNow;
              return (
                <div
                  key={appt.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs text-slate-500">
                          {PURPOSE_LABELS[appt.purpose]}
                          {isDue && (
                            <>
                              <span aria-hidden="true"> · </span>
                              <span className="font-semibold text-amber-700">
                                ถึงรอบแจ้งเตือนแล้ว
                              </span>
                            </>
                          )}
                        </div>
                        <h4 className="text-base font-semibold text-slate-900 mt-0.5">
                          {appt.doctorName}
                        </h4>
                        <p className="text-xs text-slate-500">{appt.department}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          onToggleReminder(appt.id, !appt.reminderEnabled, appt.reminderDaysBefore)
                        }
                        className={`min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                          appt.reminderEnabled
                            ? 'bg-teal-50 border-teal-200 text-teal-800'
                            : 'bg-slate-50 border-slate-200 text-slate-500'
                        }`}
                      >
                        {appt.reminderEnabled ? (
                          <Bell className="w-3.5 h-3.5" />
                        ) : (
                          <BellOff className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {appt.reminderEnabled
                            ? `เตือนล่วงหน้า ${appt.reminderDaysBefore} วัน`
                            : 'ปิดแจ้งเตือน'}
                        </span>
                      </button>
                    </div>

                    <div className="space-y-1.5 text-xs sm:text-sm text-slate-700 pt-1">
                      <div className="flex items-center gap-2 font-mono tabular-nums">
                        <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>{formatThaiDateTime(appt.appointmentDate)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>{appt.facility}</span>
                      </div>
                    </div>

                    {appt.notes && (
                      <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-xl p-3">
                        {appt.notes}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onUpdateAppointmentStatus(appt.id, 'completed')}
                      className="min-h-[40px] flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-medium rounded-xl transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>เข้าพบแพทย์แล้ว</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateAppointmentStatus(appt.id, 'cancelled')}
                      className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-red-50 text-slate-600 hover:text-red-700 text-xs font-medium rounded-xl transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>ยกเลิก</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Past / Completed Appointments */}
      {history.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">
            ประวัตินัดหมายที่ผ่านมา ({history.length})
          </h3>
          <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
            {history.map((appt) => (
              <div
                key={appt.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm"
              >
                <div>
                  <div className="font-medium text-slate-900">
                    {appt.doctorName} · {PURPOSE_LABELS[appt.purpose]}
                  </div>
                  <div className="text-xs text-slate-500 font-mono tabular-nums">
                    {formatThaiDateTime(appt.appointmentDate)} · {appt.facility}
                  </div>
                </div>
                <span
                  className={`text-xs font-medium whitespace-nowrap ${
                    appt.status === 'completed' ? 'text-emerald-700' : 'text-slate-500'
                  }`}
                >
                  {appt.status === 'completed' ? 'เข้าพบเรียบร้อย' : 'ยกเลิกแล้ว'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
