import type { Timestamp } from 'firebase/firestore';

export type Icd10Code = 'E10' | 'E11' | 'E12' | 'E13' | 'E14';
export type RemissionStage = 'active_dm' | 'improving' | 'in_remission' | 'sustained_remission';
export type InsuranceScheme = 'UCS' | 'SSS' | 'CSMBS' | 'SelfPay' | 'Other';
export type ActivityCode = '120' | 'standard';
export type EClaimStatus = 'synced' | 'pending' | 'rep_error' | 'late_submission';
export type DeviceType = 'glucometer' | 'cgm' | 'bp_monitor' | 'smart_scale';
export type MealContext = 'fasting' | 'pre_meal' | 'post_meal' | 'bedtime';
export type AppointmentPurpose = 'hba1c_followup' | 'remission_eval' | 'nutrition_consult' | 'telemed';
export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled';
export type RecommendationCategory = 'nutrition' | 'exercise' | 'medication' | 'lab_schedule' | 'remission_plan';
export type RecommendationPriority = 'routine' | 'attention' | 'urgent';
export type CareRole = 'system_admin' | 'physician' | 'care_coordinator' | 'nurse_auditor';
export type CarePermission =
  | 'manage_settings'
  | 'manage_patients'
  | 'edit_hba1c'
  | 'manage_appointments'
  | 'export_reports'
  | 'audit_43files';
export type DelegationStatus = 'active' | 'paused' | 'revoked';

export const VALID_ICD10_CODES: Icd10Code[] = ['E10', 'E11', 'E12', 'E13', 'E14'];
export const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const FIELD_LIMITS = {
  id: 128,
  displayName: 120,
  clinicName: 160,
  attendingDoctor: 120,
  cidMasked: 20,
  fullName: 160,
  phone: 32,
  email: 160,
  loincCode: 20,
  facilityName: 160,
  notes: 500,
  deviceName: 120,
  department: 120,
  title: 160,
  advice: 1000,
  participantCode: 32,
} as const;

export interface PatientProfile {
  ownerId: string;
  displayName: string;
  icd10Code: Icd10Code;
  typeArea: number;
  remissionStage: RemissionStage;
  activityCode120: boolean;
  targetHba1c: number;
  medsFreeMonths: number;
  clinicName: string;
  attendingDoctor: string;
  createdAt?: Timestamp | unknown;
  updatedAt?: Timestamp | unknown;
}

export interface PatientPrivatePii {
  ownerId: string;
  cidMasked: string;
  fullName: string;
  birthDate: string;
  phone: string;
  email: string;
  insuranceScheme: InsuranceScheme;
  updatedAt?: Timestamp | unknown;
}

export interface Hba1cRecord {
  id: string;
  ownerId: string;
  value: number;
  testDate: string;
  loincCode: string;
  icd10Code: Icd10Code;
  facilityName: string;
  activityCode: ActivityCode;
  eClaimStatus: EClaimStatus;
  notes: string;
  createdAt?: Timestamp | unknown;
  updatedAt?: Timestamp | unknown;
}

export interface DeviceReading {
  id: string;
  ownerId: string;
  deviceType: DeviceType;
  deviceName: string;
  glucoseMgDl: number;
  systolic: number;
  diastolic: number;
  weightKg: number;
  mealContext: MealContext;
  recordedAt: string;
  createdAt?: Timestamp | unknown;
}

export interface Appointment {
  id: string;
  ownerId: string;
  doctorName: string;
  department: string;
  facility: string;
  appointmentDate: string;
  purpose: AppointmentPurpose;
  reminderEnabled: boolean;
  reminderDaysBefore: number;
  status: AppointmentStatus;
  notes: string;
  createdAt?: Timestamp | unknown;
  updatedAt?: Timestamp | unknown;
}

export interface DoctorRecommendation {
  id: string;
  ownerId: string;
  doctorName: string;
  category: RecommendationCategory;
  title: string;
  advice: string;
  priority: RecommendationPriority;
  acknowledged: boolean;
  issuedDate: string;
  createdAt?: Timestamp | unknown;
  updatedAt?: Timestamp | unknown;
}

export interface ProgramParticipant {
  id: string;
  ownerId: string;
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
  createdAt?: Timestamp | unknown;
  updatedAt?: Timestamp | unknown;
}

export interface SystemSettings {
  organizationName: string;
  hba1cRemissionTarget: number;
  hba1cIntervalDays: number;
  maxTestsPerFiscalYear: number;
  defaultReminderDaysBefore: number;
  specialPpActivityCode: ActivityCode;
  enforceNumericHba1cOnly: boolean;
  blockZ131Screening: boolean;
  auto91DayFollowup: boolean;
  updatedBy: string;
  updatedAt?: Timestamp | unknown;
}

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  organizationName: 'คลินิกโรคเบาหวานระยะสงบ · RemissionCare',
  hba1cRemissionTarget: 6.5,
  hba1cIntervalDays: 90,
  maxTestsPerFiscalYear: 2,
  defaultReminderDaysBefore: 7,
  specialPpActivityCode: '120',
  enforceNumericHba1cOnly: true,
  blockZ131Screening: true,
  auto91DayFollowup: true,
  updatedBy: 'ระบบมาตรฐาน 43 แฟ้ม',
};

export interface CareDelegation {
  id: string;
  ownerId: string;
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
  createdAt?: Timestamp | unknown;
  updatedAt?: Timestamp | unknown;
}

export function clampStr(val: string, maxLen: number): string {
  return val.trim().slice(0, maxLen);
}

export function makeSafeDocId(prefix: string): string {
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '');
  const rand = Math.random().toString(36).slice(2, 8);
  return `${cleanPrefix}_${Date.now()}_${rand}`.slice(0, FIELD_LIMITS.id);
}
