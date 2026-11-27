import React, { useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  Activity,
  CalendarClock,
  LayoutDashboard,
  LogOut,
  Plus,
  Settings,
  ShieldCheck,
  Smartphone,
  Stethoscope,
  Users,
} from 'lucide-react';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './firebase';
import {
  clampStr,
  DEFAULT_SYSTEM_SETTINGS,
  FIELD_LIMITS,
  makeSafeDocId,
  type ActivityCode,
  type Appointment,
  type AppointmentPurpose,
  type CareDelegation,
  type CarePermission,
  type CareRole,
  type DelegationStatus,
  type DeviceReading,
  type DeviceType,
  type DoctorRecommendation,
  type EClaimStatus,
  type Hba1cRecord,
  type Icd10Code,
  type MealContext,
  type PatientPrivatePii,
  type PatientProfile,
  type ProgramParticipant,
  type RecommendationCategory,
  type RecommendationPriority,
  type RemissionStage,
  type SystemSettings,
} from './types';
import { analyzeHbA1cTrend, evaluateHbA1cEligibility } from './utils/clinicalAnalytics';
import { seedClinicalDemoProfile } from './utils/seedDemoData';
import { OverviewView } from './components/OverviewView';
import { Hba1cRecordsView } from './components/Hba1cRecordsView';
import { DevicesView } from './components/DevicesView';
import { AppointmentsView } from './components/AppointmentsView';
import { ParticipantsView } from './components/ParticipantsView';
import { RecommendationsView } from './components/RecommendationsView';
import { SystemSettingsView } from './components/SystemSettingsView';
import {
  PatientRegistration,
  type RegistrationPayload,
} from './components/PatientRegistration';
import {
  AddAppointmentModal,
  AddDeviceModal,
  AddHba1cModal,
  AddRecommendationModal,
  CareDelegationModal,
  EditProfileModal,
  EnrollParticipantModal,
  UpdateParticipantProgressModal,
} from './components/Modals';

type NavTab =
  | 'overview'
  | 'hba1c'
  | 'devices'
  | 'appointments'
  | 'participants'
  | 'recommendations'
  | 'settings';

const NAV_ITEMS: Array<{
  id: NavTab;
  label: string;
  mobileLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'overview', label: 'ภาพรวม', mobileLabel: 'ภาพรวม', icon: LayoutDashboard },
  { id: 'hba1c', label: 'ผล HbA1c', mobileLabel: 'HbA1c', icon: Activity },
  { id: 'devices', label: 'อุปกรณ์', mobileLabel: 'อุปกรณ์', icon: Smartphone },
  { id: 'appointments', label: 'นัดหมาย', mobileLabel: 'นัดหมาย', icon: CalendarClock },
  { id: 'participants', label: 'กิจกรรม', mobileLabel: 'กิจกรรม', icon: Users },
  { id: 'recommendations', label: 'คำแนะนำ', mobileLabel: 'แพทย์', icon: Stethoscope },
  { id: 'settings', label: 'ตั้งค่าระบบ', mobileLabel: 'ตั้งค่า', icon: Settings },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [pii, setPii] = useState<PatientPrivatePii | null>(null);
  const [hba1cRecords, setHba1cRecords] = useState<Hba1cRecord[]>([]);
  const [deviceReadings, setDeviceReadings] = useState<DeviceReading[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [recommendations, setRecommendations] = useState<DoctorRecommendation[]>([]);
  const [participants, setParticipants] = useState<ProgramParticipant[]>([]);
  const [careDelegations, setCareDelegations] = useState<CareDelegation[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(DEFAULT_SYSTEM_SETTINGS);
  const [hasAdminDoc, setHasAdminDoc] = useState(false);

  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const [modal, setModal] = useState<
    | null
    | 'hba1c'
    | 'device'
    | 'appointment'
    | 'recommendation'
    | 'profile'
    | 'registration'
    | 'enrollParticipant'
    | 'delegation'
  >(null);
  const [editingParticipant, setEditingParticipant] = useState<ProgramParticipant | null>(null);
  const [editingDelegation, setEditingDelegation] = useState<CareDelegation | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (!nextUser) {
        setProfile(null);
        setProfileLoaded(false);
        setPii(null);
        setHba1cRecords([]);
        setDeviceReadings([]);
        setAppointments([]);
        setRecommendations([]);
        setParticipants([]);
        setCareDelegations([]);
        setSystemSettings(DEFAULT_SYSTEM_SETTINGS);
        setHasAdminDoc(false);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !user) return;

    const uid = user.uid;
    const unsubs: Array<() => void> = [];

    const patientPath = `patients/${uid}`;
    unsubs.push(
      onSnapshot(
        doc(db, 'patients', uid),
        (snap) => {
          setProfile(snap.exists() ? (snap.data() as PatientProfile) : null);
          setProfileLoaded(true);
        },
        (err) => handleFirestoreError(err, OperationType.GET, patientPath)
      )
    );

    const piiPath = `patients/${uid}/private/pii`;
    unsubs.push(
      onSnapshot(
        doc(db, 'patients', uid, 'private', 'pii'),
        (snap) => {
          setPii(snap.exists() ? (snap.data() as PatientPrivatePii) : null);
        },
        (err) => handleFirestoreError(err, OperationType.GET, piiPath)
      )
    );

    const hba1cPath = `patients/${uid}/hba1cRecords`;
    unsubs.push(
      onSnapshot(
        query(collection(db, hba1cPath), where('ownerId', '==', uid)),
        (snap) => {
          setHba1cRecords(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Hba1cRecord, 'id'>) }))
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, hba1cPath)
      )
    );

    const devicePath = `patients/${uid}/deviceReadings`;
    unsubs.push(
      onSnapshot(
        query(collection(db, devicePath), where('ownerId', '==', uid)),
        (snap) => {
          setDeviceReadings(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DeviceReading, 'id'>) }))
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, devicePath)
      )
    );

    const apptPath = `patients/${uid}/appointments`;
    unsubs.push(
      onSnapshot(
        query(collection(db, apptPath), where('ownerId', '==', uid)),
        (snap) => {
          setAppointments(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Appointment, 'id'>) }))
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, apptPath)
      )
    );

    const recPath = `patients/${uid}/recommendations`;
    unsubs.push(
      onSnapshot(
        query(collection(db, recPath), where('ownerId', '==', uid)),
        (snap) => {
          setRecommendations(
            snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<DoctorRecommendation, 'id'>),
            }))
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, recPath)
      )
    );

    const participantsPath = `patients/${uid}/programParticipants`;
    unsubs.push(
      onSnapshot(
        query(collection(db, participantsPath), where('ownerId', '==', uid)),
        (snap) => {
          setParticipants(
            snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<ProgramParticipant, 'id'>),
            }))
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, participantsPath)
      )
    );

    const delegationsPath = `patients/${uid}/careDelegations`;
    unsubs.push(
      onSnapshot(
        query(collection(db, delegationsPath), where('ownerId', '==', uid)),
        (snap) => {
          setCareDelegations(
            snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<CareDelegation, 'id'>),
            }))
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, delegationsPath)
      )
    );

    const settingsPath = 'systemSettings/default';
    unsubs.push(
      onSnapshot(
        doc(db, 'systemSettings', 'default'),
        (snap) => {
          if (snap.exists()) {
            setSystemSettings(snap.data() as SystemSettings);
          } else {
            setSystemSettings(DEFAULT_SYSTEM_SETTINGS);
          }
        },
        (err) => handleFirestoreError(err, OperationType.GET, settingsPath)
      )
    );

    const adminPath = `admins/${uid}`;
    unsubs.push(
      onSnapshot(
        doc(db, 'admins', uid),
        (snap) => {
          setHasAdminDoc(snap.exists());
        },
        (err) => handleFirestoreError(err, OperationType.GET, adminPath)
      )
    );

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [authReady, user]);

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('auth/unauthorized-domain')) {
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        setAuthError(
          `โดเมน "${host}" ยังไม่ได้รับอนุญาตใน Firebase Authentication (auth/unauthorized-domain) กรุณาไปที่ Firebase Console > Authentication > Settings > Authorized domains แล้วเพิ่มโดเมนนี้ลงในรายการ`
        );
      } else if (msg.includes('auth/popup-blocked')) {
        setAuthError('เบราว์เซอร์บล็อกหน้าต่างป๊อปอัป กรุณาอนุญาต Pop-up สำหรับเว็บไซต์นี้แล้วลองใหม่อีกครั้ง');
      } else {
        setAuthError(msg || 'ไม่สามารถเข้าสู่ระบบด้วย Google ได้ กรุณาลองอีกครั้ง');
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const handleSeedDemo = async () => {
    if (!user) return;
    setErrorBanner(null);
    try {
      await seedClinicalDemoProfile(user.uid, user.email || '', user.displayName || undefined);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'ไม่สามารถสร้างข้อมูลตัวอย่างได้');
    }
  };

  const handlePatientRegistration = async (payload: RegistrationPayload) => {
    if (!user) return;
    const uid = user.uid;
    const nowTs = serverTimestamp();

    try {
      if (!profile) {
        await setDoc(doc(db, 'patients', uid), {
          ownerId: uid,
          ...payload.profile,
          createdAt: nowTs,
          updatedAt: nowTs,
        });
      } else {
        await updateDoc(doc(db, 'patients', uid), {
          ...payload.profile,
          updatedAt: nowTs,
        });
      }

      const batch = writeBatch(db);
      batch.set(doc(db, 'patients', uid, 'private', 'pii'), {
        ownerId: uid,
        ...payload.pii,
        updatedAt: nowTs,
      });

      if (payload.baselineHba1c) {
        const recId = makeSafeDocId('hba1c');
        batch.set(doc(db, 'patients', uid, 'hba1cRecords', recId), {
          ownerId: uid,
          value: payload.baselineHba1c.value,
          testDate: payload.baselineHba1c.testDate,
          loincCode: '4548-4',
          icd10Code: payload.profile.icd10Code,
          facilityName: payload.baselineHba1c.facilityName,
          activityCode: payload.profile.activityCode120 ? '120' : 'standard',
          eClaimStatus: 'synced',
          notes: 'ผลตรวจ HbA1c ตั้งต้น ณ วันลงทะเบียนเข้าระบบ RemissionCare',
          createdAt: nowTs,
          updatedAt: nowTs,
        });

        if (payload.autoSchedule91DayFollowup) {
          const baseDate = new Date(payload.baselineHba1c.testDate);
          if (!Number.isNaN(baseDate.getTime())) {
            const followupDate = new Date(baseDate.getTime() + 91 * 24 * 60 * 60 * 1000);
            followupDate.setHours(9, 0, 0, 0);
            const apptId = makeSafeDocId('appt');
            batch.set(doc(db, 'patients', uid, 'appointments', apptId), {
              ownerId: uid,
              doctorName: payload.profile.attendingDoctor,
              department: 'คลินิกเบาหวานระยะสงบ (DM Remission)',
              facility: payload.profile.clinicName,
              appointmentDate: followupDate.toISOString(),
              purpose: payload.profile.activityCode120 ? 'remission_eval' : 'hba1c_followup',
              reminderEnabled: true,
              reminderDaysBefore: 7,
              status: 'scheduled',
              notes: 'นัดหมายติดตามผล HbA1c รอบวันที่ 91+ หลังลงทะเบียน เพื่อประเมินการเปลี่ยนแปลง',
              createdAt: nowTs,
              updatedAt: nowTs,
            });
          }
        }
      }

      if (!profile) {
        const welcomeRecId = makeSafeDocId('rec');
        batch.set(doc(db, 'patients', uid, 'recommendations', welcomeRecId), {
          ownerId: uid,
          doctorName: payload.profile.attendingDoctor,
          category: 'remission_plan',
          title: 'เริ่มต้นแผนติดตาม DM Remission หลังลงทะเบียน',
          advice: payload.baselineHba1c
            ? `บันทึกค่า HbA1c ตั้งต้น ${payload.baselineHba1c.value.toFixed(1)}% เรียบร้อยแล้ว แนะนำซิงค์ค่าน้ำตาลปลายนิ้วหรือ CGM อย่างต่อเนื่อง และตรวจ HbA1c ซ้ำในวันที่ 91 เป็นต้นไป`
            : 'ลงทะเบียนแฟ้มสุขภาพเรียบร้อยแล้ว กรุณาบันทึกผล HbA1c ล่าสุดหรือซิงค์อุปกรณ์วัดน้ำตาลเพื่อเริ่มวิเคราะห์แนวโน้มการเปลี่ยนแปลง',
          priority: 'routine',
          acknowledged: false,
          issuedDate: new Date().toISOString().slice(0, 10),
          createdAt: nowTs,
          updatedAt: nowTs,
        });

        if (payload.baselineHba1c) {
          const enrolledIso = payload.baselineHba1c.testDate;
          const baseDt = new Date(enrolledIso);
          const nextIso = Number.isNaN(baseDt.getTime())
            ? new Date(Date.now() + 91 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
            : new Date(baseDt.getTime() + 91 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
          const partId = makeSafeDocId('part');
          batch.set(doc(db, 'patients', uid, 'programParticipants', partId), {
            ownerId: uid,
            participantCode: 'RC-69-001',
            displayName: clampStr(payload.profile.displayName, FIELD_LIMITS.displayName),
            icd10Code: payload.profile.icd10Code,
            typeArea: payload.profile.typeArea,
            activityCode: payload.profile.activityCode120 ? '120' : 'standard',
            enrolledDate: enrolledIso,
            baselineHba1c: payload.baselineHba1c.value,
            currentHba1c: payload.baselineHba1c.value,
            targetHba1c: payload.profile.targetHba1c,
            medsFreeMonths: payload.profile.medsFreeMonths,
            remissionStage: payload.profile.remissionStage,
            lastCheckupDate: enrolledIso,
            nextFollowupDate: nextIso,
            clinicName: clampStr(payload.profile.clinicName, FIELD_LIMITS.clinicName),
            notes: 'ลงทะเบียนเข้าร่วมกิจกรรม RemissionCare อัตโนมัติเมื่อเปิดแฟ้มสุขภาพ',
            createdAt: nowTs,
            updatedAt: nowTs,
          });
        }
      }

      await batch.commit();
      setModal(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `patients/${uid}`);
    }
  };

  // CRUD Handlers
  const handleAddHba1c = async (data: {
    value: number;
    testDate: string;
    loincCode: string;
    icd10Code: Icd10Code;
    facilityName: string;
    activityCode: ActivityCode;
    eClaimStatus: EClaimStatus;
    notes: string;
  }) => {
    if (!user || !profile) return;
    const id = makeSafeDocId('hba1c');
    const path = `patients/${user.uid}/hba1cRecords/${id}`;
    const nowTs = serverTimestamp();

    const recordPayload = {
      ownerId: user.uid,
      value: data.value,
      testDate: data.testDate,
      loincCode: clampStr(data.loincCode, FIELD_LIMITS.loincCode),
      icd10Code: data.icd10Code,
      facilityName: clampStr(data.facilityName, FIELD_LIMITS.facilityName),
      activityCode: data.activityCode,
      eClaimStatus: data.eClaimStatus,
      notes: clampStr(data.notes, FIELD_LIMITS.notes),
      createdAt: nowTs,
      updatedAt: nowTs,
    };

    try {
      await setDoc(doc(db, 'patients', user.uid, 'hba1cRecords', id), recordPayload);
      const nextTrend = analyzeHbA1cTrend(
        [...hba1cRecords, { id, ...recordPayload }],
        profile.medsFreeMonths
      );
      if (nextTrend.computedStage !== profile.remissionStage) {
        await updateDoc(doc(db, 'patients', user.uid), {
          remissionStage: nextTrend.computedStage,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const handleUpdateHba1cStatus = async (recordId: string, nextStatus: EClaimStatus) => {
    if (!user) return;
    const path = `patients/${user.uid}/hba1cRecords/${recordId}`;
    try {
      await updateDoc(doc(db, 'patients', user.uid, 'hba1cRecords', recordId), {
        eClaimStatus: nextStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleDeleteHba1c = async (recordId: string) => {
    if (!user) return;
    const path = `patients/${user.uid}/hba1cRecords/${recordId}`;
    try {
      await deleteDoc(doc(db, 'patients', user.uid, 'hba1cRecords', recordId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const handleAddDeviceReading = async (data: {
    deviceType: DeviceType;
    deviceName: string;
    glucoseMgDl: number;
    systolic: number;
    diastolic: number;
    weightKg: number;
    mealContext: MealContext;
  }) => {
    if (!user) return;
    const id = makeSafeDocId('dev');
    const path = `patients/${user.uid}/deviceReadings/${id}`;
    try {
      await setDoc(doc(db, 'patients', user.uid, 'deviceReadings', id), {
        ownerId: user.uid,
        deviceType: data.deviceType,
        deviceName: clampStr(data.deviceName, FIELD_LIMITS.deviceName),
        glucoseMgDl: data.glucoseMgDl,
        systolic: data.systolic,
        diastolic: data.diastolic,
        weightKg: data.weightKg,
        mealContext: data.mealContext,
        recordedAt: new Date().toISOString(),
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const handleDeleteDeviceReading = async (readingId: string) => {
    if (!user) return;
    const path = `patients/${user.uid}/deviceReadings/${readingId}`;
    try {
      await deleteDoc(doc(db, 'patients', user.uid, 'deviceReadings', readingId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const handleAddAppointment = async (data: {
    doctorName: string;
    department: string;
    facility: string;
    appointmentDate: string;
    purpose: AppointmentPurpose;
    reminderEnabled: boolean;
    reminderDaysBefore: number;
    notes: string;
  }) => {
    if (!user) return;
    const id = makeSafeDocId('appt');
    const path = `patients/${user.uid}/appointments/${id}`;
    const nowTs = serverTimestamp();
    try {
      await setDoc(doc(db, 'patients', user.uid, 'appointments', id), {
        ownerId: user.uid,
        doctorName: clampStr(data.doctorName, FIELD_LIMITS.attendingDoctor),
        department: clampStr(data.department, FIELD_LIMITS.department),
        facility: clampStr(data.facility, FIELD_LIMITS.facilityName),
        appointmentDate: data.appointmentDate,
        purpose: data.purpose,
        reminderEnabled: data.reminderEnabled,
        reminderDaysBefore: data.reminderDaysBefore,
        status: 'scheduled',
        notes: clampStr(data.notes, FIELD_LIMITS.notes),
        createdAt: nowTs,
        updatedAt: nowTs,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const handleToggleReminder = async (id: string, enabled: boolean, daysBefore: number) => {
    if (!user) return;
    const path = `patients/${user.uid}/appointments/${id}`;
    try {
      await updateDoc(doc(db, 'patients', user.uid, 'appointments', id), {
        reminderEnabled: enabled,
        reminderDaysBefore: daysBefore,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleUpdateAppointmentStatus = async (id: string, status: 'completed' | 'cancelled') => {
    if (!user) return;
    const path = `patients/${user.uid}/appointments/${id}`;
    try {
      await updateDoc(doc(db, 'patients', user.uid, 'appointments', id), {
        status,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleAddRecommendation = async (data: {
    doctorName: string;
    category: RecommendationCategory;
    title: string;
    advice: string;
    priority: RecommendationPriority;
    issuedDate: string;
  }) => {
    if (!user) return;
    const id = makeSafeDocId('rec');
    const path = `patients/${user.uid}/recommendations/${id}`;
    const nowTs = serverTimestamp();
    try {
      await setDoc(doc(db, 'patients', user.uid, 'recommendations', id), {
        ownerId: user.uid,
        doctorName: clampStr(data.doctorName, FIELD_LIMITS.attendingDoctor),
        category: data.category,
        title: clampStr(data.title, FIELD_LIMITS.title),
        advice: clampStr(data.advice, FIELD_LIMITS.advice),
        priority: data.priority,
        acknowledged: false,
        issuedDate: data.issuedDate,
        createdAt: nowTs,
        updatedAt: nowTs,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const handleAcknowledgeRec = async (recId: string) => {
    if (!user) return;
    const path = `patients/${user.uid}/recommendations/${recId}`;
    try {
      await updateDoc(doc(db, 'patients', user.uid, 'recommendations', recId), {
        acknowledged: true,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleSaveProfileAndPii = async (
    nextProfile: Omit<PatientProfile, 'ownerId' | 'createdAt' | 'updatedAt'>,
    nextPii: Omit<PatientPrivatePii, 'ownerId' | 'updatedAt'>
  ) => {
    if (!user) return;
    const uid = user.uid;
    try {
      await updateDoc(doc(db, 'patients', uid), {
        displayName: clampStr(nextProfile.displayName, FIELD_LIMITS.displayName),
        icd10Code: nextProfile.icd10Code,
        typeArea: nextProfile.typeArea,
        remissionStage: nextProfile.remissionStage,
        activityCode120: nextProfile.activityCode120,
        targetHba1c: nextProfile.targetHba1c,
        medsFreeMonths: nextProfile.medsFreeMonths,
        clinicName: clampStr(nextProfile.clinicName, FIELD_LIMITS.clinicName),
        attendingDoctor: clampStr(nextProfile.attendingDoctor, FIELD_LIMITS.attendingDoctor),
        updatedAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'patients', uid, 'private', 'pii'), {
        ownerId: uid,
        cidMasked: clampStr(nextPii.cidMasked, FIELD_LIMITS.cidMasked),
        fullName: clampStr(nextPii.fullName, FIELD_LIMITS.fullName),
        birthDate: nextPii.birthDate,
        phone: clampStr(nextPii.phone, FIELD_LIMITS.phone),
        email: clampStr(nextPii.email, FIELD_LIMITS.email),
        insuranceScheme: nextPii.insuranceScheme,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `patients/${uid}`);
    }
  };

  const handleEnrollParticipant = async (data: {
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
  }) => {
    if (!user) return;
    const id = makeSafeDocId('part');
    const path = `patients/${user.uid}/programParticipants/${id}`;
    const nowTs = serverTimestamp();
    try {
      await setDoc(doc(db, 'patients', user.uid, 'programParticipants', id), {
        ownerId: user.uid,
        participantCode: clampStr(data.participantCode, FIELD_LIMITS.participantCode),
        displayName: clampStr(data.displayName, FIELD_LIMITS.displayName),
        icd10Code: data.icd10Code,
        typeArea: data.typeArea,
        activityCode: data.activityCode,
        enrolledDate: data.enrolledDate,
        baselineHba1c: data.baselineHba1c,
        currentHba1c: data.currentHba1c,
        targetHba1c: data.targetHba1c,
        medsFreeMonths: data.medsFreeMonths,
        remissionStage: data.remissionStage,
        lastCheckupDate: data.lastCheckupDate,
        nextFollowupDate: data.nextFollowupDate,
        clinicName: clampStr(data.clinicName, FIELD_LIMITS.clinicName),
        notes: clampStr(data.notes, FIELD_LIMITS.notes),
        createdAt: nowTs,
        updatedAt: nowTs,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const handleUpdateParticipantProgress = async (
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
  ) => {
    if (!user) return;
    const path = `patients/${user.uid}/programParticipants/${participantId}`;
    try {
      await updateDoc(doc(db, 'patients', user.uid, 'programParticipants', participantId), {
        currentHba1c: updates.currentHba1c,
        targetHba1c: updates.targetHba1c,
        medsFreeMonths: updates.medsFreeMonths,
        remissionStage: updates.remissionStage,
        activityCode: updates.activityCode,
        lastCheckupDate: updates.lastCheckupDate,
        nextFollowupDate: updates.nextFollowupDate,
        notes: clampStr(updates.notes, FIELD_LIMITS.notes),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleDeleteParticipant = async (participantId: string) => {
    if (!user) return;
    const path = `patients/${user.uid}/programParticipants/${participantId}`;
    try {
      await deleteDoc(doc(db, 'patients', user.uid, 'programParticipants', participantId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const handleSaveSystemSettings = async (
    next: Omit<SystemSettings, 'updatedBy' | 'updatedAt'>
  ) => {
    if (!user) return;
    const path = 'systemSettings/default';
    try {
      await setDoc(doc(db, 'systemSettings', 'default'), {
        organizationName: clampStr(next.organizationName, FIELD_LIMITS.clinicName),
        hba1cRemissionTarget: next.hba1cRemissionTarget,
        hba1cIntervalDays: next.hba1cIntervalDays,
        maxTestsPerFiscalYear: next.maxTestsPerFiscalYear,
        defaultReminderDaysBefore: next.defaultReminderDaysBefore,
        specialPpActivityCode: next.specialPpActivityCode,
        enforceNumericHba1cOnly: next.enforceNumericHba1cOnly,
        blockZ131Screening: next.blockZ131Screening,
        auto91DayFollowup: next.auto91DayFollowup,
        updatedBy: clampStr(user.email || user.displayName || 'System Admin', FIELD_LIMITS.email),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const handleSaveDelegation = async (
    data: {
      delegateName: string;
      delegateEmail: string;
      delegateUid: string;
      role: CareRole;
      department: string;
      permissions: CarePermission[];
      status: DelegationStatus;
      assignedDate: string;
      expiryDate: string;
      notes: string;
    },
    existingId?: string
  ) => {
    if (!user) return;
    const nowTs = serverTimestamp();
    if (existingId) {
      const path = `patients/${user.uid}/careDelegations/${existingId}`;
      try {
        await updateDoc(doc(db, 'patients', user.uid, 'careDelegations', existingId), {
          delegateName: clampStr(data.delegateName, FIELD_LIMITS.displayName),
          delegateEmail: clampStr(data.delegateEmail, FIELD_LIMITS.email),
          delegateUid: clampStr(data.delegateUid, FIELD_LIMITS.id),
          role: data.role,
          department: clampStr(data.department, FIELD_LIMITS.department),
          permissions: data.permissions,
          status: data.status,
          expiryDate: data.expiryDate,
          notes: clampStr(data.notes, FIELD_LIMITS.notes),
          updatedAt: nowTs,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
      return;
    }

    const id = makeSafeDocId('del');
    const path = `patients/${user.uid}/careDelegations/${id}`;
    try {
      await setDoc(doc(db, 'patients', user.uid, 'careDelegations', id), {
        ownerId: user.uid,
        delegateName: clampStr(data.delegateName, FIELD_LIMITS.displayName),
        delegateEmail: clampStr(data.delegateEmail, FIELD_LIMITS.email),
        delegateUid: clampStr(data.delegateUid, FIELD_LIMITS.id),
        role: data.role,
        department: clampStr(data.department, FIELD_LIMITS.department),
        permissions: data.permissions,
        status: data.status,
        assignedDate: data.assignedDate,
        expiryDate: data.expiryDate,
        notes: clampStr(data.notes, FIELD_LIMITS.notes),
        createdAt: nowTs,
        updatedAt: nowTs,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const handleUpdateDelegationStatus = async (id: string, status: DelegationStatus) => {
    if (!user) return;
    const path = `patients/${user.uid}/careDelegations/${id}`;
    try {
      await updateDoc(doc(db, 'patients', user.uid, 'careDelegations', id), {
        status,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleDeleteDelegation = async (id: string) => {
    if (!user) return;
    const path = `patients/${user.uid}/careDelegations/${id}`;
    try {
      await deleteDoc(doc(db, 'patients', user.uid, 'careDelegations', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const handleGrantCloudAdmin = async (targetUid: string, displayName: string) => {
    if (!user) return;
    const cleanUid = clampStr(targetUid, FIELD_LIMITS.id);
    const path = `admins/${cleanUid}`;
    try {
      await setDoc(doc(db, 'admins', cleanUid), {
        uid: cleanUid,
        displayName: clampStr(displayName, FIELD_LIMITS.displayName),
        role: 'admin',
        grantedBy: clampStr(user.email || user.uid, FIELD_LIMITS.id),
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  // Loading Screen
  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="space-y-3 text-center">
          <div className="w-10 h-10 rounded-xl bg-teal-600/10 text-teal-700 flex items-center justify-center mx-auto">
            <Activity className="w-5 h-5" />
          </div>
          <p className="text-sm text-slate-600">กำลังเชื่อมต่อระบบคลาวด์ RemissionCare...</p>
        </div>
      </div>
    );
  }

  // Unauthenticated Landing / Sign-In Screen
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 h-16 flex items-center justify-between gap-8">
          <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            RemissionCare
          </span>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-slate-900 whitespace-nowrap shrink-0">
              ความสามารถระบบ
            </a>
            <a href="#standards" className="hover:text-slate-900 whitespace-nowrap shrink-0">
              มาตรฐาน HbA1c
            </a>
            <a href="#security" className="hover:text-slate-900 whitespace-nowrap shrink-0">
              ความปลอดภัย
            </a>
          </nav>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={signingIn}
            className="min-h-[40px] px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-medium rounded-xl transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
          >
            {signingIn ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </header>

        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-12">
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-7 sm:p-10 flex flex-col justify-between gap-8">
              <div className="space-y-4">
                <p className="text-xs font-medium text-teal-700">
                  DM Remission &amp; HbA1c Cloud Platform · มาตรฐาน 43 แฟ้ม / LOINC 4548-4
                </p>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 leading-tight text-balance">
                  ติดตามภาวะเบาหวานระยะสงบและค่า HbA1c แบบเรียลไทม์
                </h1>
                <p className="text-base text-slate-600 leading-relaxed max-w-2xl">
                  แดชบอร์ดสรุปผลสุขภาพรายบุคคลที่เชื่อมโยงผลตรวจเลือด HbA1c การซิงค์อุปกรณ์วัดน้ำตาล แจ้งเตือนนัดหมายแพทย์อัตโนมัติ และคำแนะนำจากแพทย์ไว้ในระบบคลาวด์ที่ปลอดภัยสูงสุด
                </p>
              </div>

              <div className="space-y-3">
                {authError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
                    {authError}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={signingIn}
                  className="min-h-[48px] inline-flex items-center justify-center gap-2.5 px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
                >
                  <ShieldCheck className="w-5 h-5" />
                  <span>{signingIn ? 'กำลังเชื่อมต่อ Google Auth...' : 'ลงทะเบียน / เข้าสู่ระบบด้วย Google'}</span>
                </button>
                <p className="text-xs text-slate-500">
                  ยืนยันตัวตนผ่าน Google OAuth และจัดเก็บข้อมูลผู้ป่วยแยกสิทธิ์เฉพาะเจ้าของบัญชี
                </p>
              </div>
            </div>

            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-7 flex flex-col justify-between gap-6">
              <div className="space-y-4" id="features">
                <h2 className="text-base font-semibold text-slate-900">
                  มิติการดูแลผู้ป่วยที่ครอบคลุม
                </h2>
                <div className="divide-y divide-slate-100 text-sm">
                  <div className="py-3 first:pt-0">
                    <div className="font-semibold text-slate-900">วิเคราะห์แนวโน้ม HbA1c &amp; DM Remission</div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      คำนวณเกณฑ์เป้าหมาย &lt; 6.5% และติดตามรหัสกิจกรรม 120 (Special PP)
                    </p>
                  </div>
                  <div className="py-3" id="standards">
                    <div className="font-semibold text-slate-900">ตรวจสอบความถี่การตรวจ 90 วันอัตโนมัติ</div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      เตือนก่อนครบโควตา 2 ครั้ง/ปีงบประมาณ และตรวจสอบรหัส ICD-10 (E10–E14) ป้องกัน REP Error
                    </p>
                  </div>
                  <div className="py-3">
                    <div className="font-semibold text-slate-900">ซิงค์อุปกรณ์และแจ้งเตือนนัดหมายแพทย์</div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      รองรับเครื่องตรวจน้ำตาล CGM ความดันโลหิต และตั้งแจ้งเตือนล่วงหน้าอัตโนมัติ
                    </p>
                  </div>
                  <div className="py-3 last:pb-0" id="security">
                    <div className="font-semibold text-slate-900">แยกเก็บข้อมูลส่วนบุคคล (Zero-Trust PDPA)</div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      แยกคอลเลกชันข้อมูล PII และตรวจสอบสิทธิ์การเข้าถึงระดับเอกสารใน Firebase Firestore
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  }

  // First-time Onboarding: Full Patient Registration Workflow
  if (profileLoaded && !profile) {
    return (
      <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 flex items-center justify-center">
        <div className="max-w-3xl w-full space-y-4">
          {errorBanner && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 break-all overflow-x-auto">
              {errorBanner}
            </div>
          )}
          <PatientRegistration
            userEmail={user.email || ''}
            initialDisplayName={user.displayName || ''}
            isOnboarding
            onSubmit={handlePatientRegistration}
            onLoadDemo={handleSeedDemo}
            onSignOut={handleSignOut}
          />
        </div>
      </div>
    );
  }

  // Loading patient data after auth
  if (!profileLoaded || !profile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full space-y-3">
          <div className="h-24 bg-white border border-slate-200 rounded-2xl" />
          <div className="h-48 bg-white border border-slate-200 rounded-2xl" />
        </div>
      </div>
    );
  }

  const eligibility = evaluateHbA1cEligibility(hba1cRecords);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-16 md:pb-0">
      {/* Strictly 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 h-12 md:h-16 px-4 sm:px-6 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand wordmark */}
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className="text-base md:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 text-left"
        >
          RemissionCare
        </button>

        {/* Zone 2: Concise single-line nav links (Desktop) */}
        <nav className="hidden md:flex items-center gap-4 lg:gap-6 text-sm font-medium text-slate-600">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                  isActive
                    ? 'text-teal-700 border-teal-600 font-semibold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary CTA */}
        <button
          type="button"
          onClick={() => setModal('hba1c')}
          className="min-h-[36px] md:min-h-[40px] inline-flex items-center gap-1.5 px-3 md:px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs md:text-sm font-medium rounded-xl transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>บันทึก HbA1c</span>
        </button>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {errorBanner && (
          <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
            {errorBanner}
          </div>
        )}

        {activeTab === 'overview' && (
          <OverviewView
            profile={profile}
            records={hba1cRecords}
            readings={deviceReadings}
            appointments={appointments}
            recommendations={recommendations}
            participants={participants}
            onAddHba1c={() => setModal('hba1c')}
            onSyncDevice={() => setActiveTab('devices')}
            onEnrollParticipant={() => setModal('enrollParticipant')}
            onNavigate={setActiveTab}
            onAcknowledgeRec={handleAcknowledgeRec}
          />
        )}

        {activeTab === 'hba1c' && (
          <Hba1cRecordsView
            profile={profile}
            records={hba1cRecords}
            onAddRecord={() => setModal('hba1c')}
            onUpdateStatus={handleUpdateHba1cStatus}
            onDeleteRecord={handleDeleteHba1c}
          />
        )}

        {activeTab === 'devices' && (
          <DevicesView
            readings={deviceReadings}
            onQuickSyncDevice={handleAddDeviceReading}
            onOpenManualModal={() => setModal('device')}
            onDeleteReading={handleDeleteDeviceReading}
          />
        )}

        {activeTab === 'appointments' && (
          <AppointmentsView
            appointments={appointments}
            onAddAppointment={() => setModal('appointment')}
            onToggleReminder={handleToggleReminder}
            onUpdateAppointmentStatus={handleUpdateAppointmentStatus}
          />
        )}

        {activeTab === 'participants' && (
          <ParticipantsView
            participants={participants}
            onEnrollParticipant={() => setModal('enrollParticipant')}
            onUpdateProgress={(p) => setEditingParticipant(p)}
            onDeleteParticipant={handleDeleteParticipant}
          />
        )}

        {activeTab === 'recommendations' && (
          <RecommendationsView
            profile={profile}
            pii={pii}
            records={hba1cRecords}
            deviceReadings={deviceReadings}
            recommendations={recommendations}
            onAddRecommendation={() => setModal('recommendation')}
            onAcknowledge={handleAcknowledgeRec}
            onEditProfile={() => setModal('profile')}
            onOpenRegistration={() => setModal('registration')}
          />
        )}

        {activeTab === 'settings' && (
          <SystemSettingsView
            settings={systemSettings}
            delegations={careDelegations}
            isAdminUser={
              Boolean(user.emailVerified && user.email === 'tibularbell@gmail.com') || hasAdminDoc
            }
            currentUserEmail={user.email || ''}
            onSaveSettings={handleSaveSystemSettings}
            onAddDelegation={() => {
              setEditingDelegation(null);
              setModal('delegation');
            }}
            onEditDelegation={(d) => {
              setEditingDelegation(d);
              setModal('delegation');
            }}
            onUpdateDelegationStatus={handleUpdateDelegationStatus}
            onDeleteDelegation={handleDeleteDelegation}
            onGrantCloudAdmin={handleGrantCloudAdmin}
          />
        )}
      </main>

      {/* Quiet Account & Privacy Footer */}
      <footer className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-5 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium text-slate-700">{profile.displayName}</span>
          <span aria-hidden="true">·</span>
          <span>{user.email}</span>
          <span aria-hidden="true">·</span>
          <span>{systemSettings.organizationName}</span>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="min-h-[36px] inline-flex items-center gap-1.5 text-slate-600 hover:text-red-700 font-medium self-start sm:self-center whitespace-nowrap shrink-0"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>ออกจากระบบ</span>
        </button>
      </footer>

      {/* Mobile Bottom Navigation Bar (56px height + 48px header = 104px < 15% mobile cap) */}
      <nav
        aria-label="เมนูหลักมือถือ"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-14 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-7 items-center"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
                isActive ? 'text-teal-700' : 'text-slate-500'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium leading-none">{item.mobileLabel}</span>
            </button>
          );
        })}
      </nav>

      {/* Modals */}
      {modal === 'hba1c' && (
        <AddHba1cModal
          defaultIcd10={profile.icd10Code}
          defaultFacility={profile.clinicName}
          isEligibleNow={eligibility.isEligibleNow}
          eligibilityReason={eligibility.reasonTh}
          onClose={() => setModal(null)}
          onSubmit={handleAddHba1c}
        />
      )}

      {modal === 'device' && (
        <AddDeviceModal
          onClose={() => setModal(null)}
          onSubmit={handleAddDeviceReading}
        />
      )}

      {modal === 'appointment' && (
        <AddAppointmentModal
          defaultDoctor={profile.attendingDoctor}
          defaultFacility={profile.clinicName}
          onClose={() => setModal(null)}
          onSubmit={handleAddAppointment}
        />
      )}

      {modal === 'recommendation' && (
        <AddRecommendationModal
          defaultDoctor={profile.attendingDoctor}
          onClose={() => setModal(null)}
          onSubmit={handleAddRecommendation}
        />
      )}

      {modal === 'profile' && (
        <EditProfileModal
          profile={profile}
          pii={pii}
          userEmail={user.email || ''}
          onClose={() => setModal(null)}
          onSubmit={handleSaveProfileAndPii}
        />
      )}

      {modal === 'registration' && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full sm:max-w-3xl my-auto max-h-[92vh] overflow-y-auto">
            <PatientRegistration
              userEmail={user.email || ''}
              initialDisplayName={profile.displayName}
              existingProfile={profile}
              existingPii={pii}
              onSubmit={handlePatientRegistration}
              onCancel={() => setModal(null)}
            />
          </div>
        </div>
      )}

      {modal === 'enrollParticipant' && (
        <EnrollParticipantModal
          defaultClinic={profile.clinicName}
          existingCount={participants.length}
          onClose={() => setModal(null)}
          onSubmit={handleEnrollParticipant}
        />
      )}

      {editingParticipant && (
        <UpdateParticipantProgressModal
          participant={editingParticipant}
          onClose={() => setEditingParticipant(null)}
          onSubmit={handleUpdateParticipantProgress}
        />
      )}

      {modal === 'delegation' && (
        <CareDelegationModal
          existingDelegation={editingDelegation}
          defaultDepartment={profile.clinicName}
          onClose={() => {
            setModal(null);
            setEditingDelegation(null);
          }}
          onSubmit={handleSaveDelegation}
        />
      )}
    </div>
  );
}
