import { doc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { clampStr, FIELD_LIMITS, makeSafeDocId } from '../types';

function isoDaysOffset(days: number): string {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function isoDateTimeOffset(days: number, hour = 9, min = 30): string {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
}

export async function seedClinicalDemoProfile(
  uid: string,
  userEmail: string,
  displayNameInput?: string
): Promise<void> {
  const nowTs = serverTimestamp();
  const displayName = clampStr(displayNameInput || 'คุณสมชาย ใจดี', FIELD_LIMITS.displayName);

  const patientRef = doc(db, 'patients', uid);
  try {
    await setDoc(patientRef, {
      ownerId: uid,
      displayName,
      icd10Code: 'E11',
      typeArea: 1,
      remissionStage: 'sustained_remission',
      activityCode120: true,
      targetHba1c: 6.4,
      medsFreeMonths: 5,
      clinicName: 'คลินิกโรคเบาหวานระยะสงบ รพ.สระบุรี',
      attendingDoctor: 'นพ. ธนกร วรโชติ',
      createdAt: nowTs,
      updatedAt: nowTs,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `patients/${uid}`);
  }

  const batch = writeBatch(db);

  const piiRef = doc(db, 'patients', uid, 'private', 'pii');
  batch.set(piiRef, {
    ownerId: uid,
    cidMasked: '1-1999-XXXXX-84-2',
    fullName: displayName,
    birthDate: '1978-05-14',
    phone: '081-456-7890',
    email: clampStr(userEmail || 'patient@example.com', FIELD_LIMITS.email),
    insuranceScheme: 'UCS',
    updatedAt: nowTs,
  });

  const hba1cSeeds = [
    {
      value: 8.2,
      testDate: isoDaysOffset(-390),
      loincCode: '4548-4',
      icd10Code: 'E11',
      facilityName: 'รพ.สระบุรี',
      activityCode: 'standard',
      eClaimStatus: 'synced',
      notes: 'เริ่มเข้าโปรแกรมปรับเปลี่ยนพฤติกรรม DM Remission (HIS เชื่อมต่อ 43 แฟ้มสำเร็จ)',
    },
    {
      value: 7.1,
      testDate: isoDaysOffset(-295),
      loincCode: '4548-4',
      icd10Code: 'E11',
      facilityName: 'รพ.สระบุรี',
      activityCode: 'standard',
      eClaimStatus: 'synced',
      notes: 'ลดระดับน้ำตาลลง 1.1% หลังคุมคาร์โบไฮเดรตและเดินหลังอาหาร',
    },
    {
      value: 6.4,
      testDate: isoDaysOffset(-195),
      loincCode: '4548-4',
      icd10Code: 'E11',
      facilityName: 'รพ.สระบุรี',
      activityCode: '120',
      eClaimStatus: 'synced',
      notes: 'เข้าเกณฑ์ DM Remission เบื้องต้น แพทย์เริ่มหยุดยา Metformin และบันทึกรหัสกิจกรรม 120',
    },
    {
      value: 5.9,
      testDate: isoDaysOffset(-98),
      loincCode: '4548-4',
      icd10Code: 'E11',
      facilityName: 'รพ.สระบุรี',
      activityCode: '120',
      eClaimStatus: 'synced',
      notes: 'ผลตรวจ HbA1c อยู่ในเกณฑ์ปกติต่อเนื่อง ≥ 3 เดือนโดยไม่ใช้ยา (Special PP 120)',
    },
  ];

  for (const rec of hba1cSeeds) {
    const id = makeSafeDocId('hba1c');
    batch.set(doc(db, 'patients', uid, 'hba1cRecords', id), {
      ownerId: uid,
      ...rec,
      createdAt: nowTs,
      updatedAt: nowTs,
    });
  }

  const deviceSeeds = [
    {
      deviceType: 'glucometer',
      deviceName: 'Accu-Chek Instant BLE',
      glucoseMgDl: 96,
      systolic: 0,
      diastolic: 0,
      weightKg: 0,
      mealContext: 'fasting',
      recordedAt: isoDateTimeOffset(-6, 7, 15),
    },
    {
      deviceType: 'cgm',
      deviceName: 'FreeStyle Libre Sensor',
      glucoseMgDl: 118,
      systolic: 0,
      diastolic: 0,
      weightKg: 0,
      mealContext: 'post_meal',
      recordedAt: isoDateTimeOffset(-4, 13, 30),
    },
    {
      deviceType: 'glucometer',
      deviceName: 'Accu-Chek Instant BLE',
      glucoseMgDl: 94,
      systolic: 0,
      diastolic: 0,
      weightKg: 0,
      mealContext: 'fasting',
      recordedAt: isoDateTimeOffset(-2, 7, 5),
    },
    {
      deviceType: 'bp_monitor',
      deviceName: 'Omron HEM-7156T',
      glucoseMgDl: 0,
      systolic: 118,
      diastolic: 76,
      weightKg: 0,
      mealContext: 'fasting',
      recordedAt: isoDateTimeOffset(-1, 8, 0),
    },
    {
      deviceType: 'smart_scale',
      deviceName: 'Mi Body Composition Scale',
      glucoseMgDl: 0,
      systolic: 0,
      diastolic: 0,
      weightKg: 66.8,
      mealContext: 'fasting',
      recordedAt: isoDateTimeOffset(-1, 7, 20),
    },
  ];

  for (const dev of deviceSeeds) {
    const id = makeSafeDocId('dev');
    batch.set(doc(db, 'patients', uid, 'deviceReadings', id), {
      ownerId: uid,
      ...dev,
      createdAt: nowTs,
    });
  }

  const apptSeeds = [
    {
      doctorName: 'นพ. ธนกร วรโชติ',
      department: 'คลินิกเบาหวานระยะสงบ (DM Remission)',
      facility: 'รพ.สระบุรี',
      appointmentDate: isoDateTimeOffset(3, 9, 0),
      purpose: 'remission_eval',
      reminderEnabled: true,
      reminderDaysBefore: 7,
      status: 'scheduled',
      notes: 'เจาะเลือด HbA1c รอบวันที่ 91+ และประเมินภาวะสงบโรคต่อเนื่อง (รหัส 120)',
    },
    {
      doctorName: 'พญ. สิริพร กิจเจริญ',
      department: 'โภชนบำบัดและเวชศาสตร์วิถีชีวิต',
      facility: 'คลินิก Telemed ออนไลน์',
      appointmentDate: isoDateTimeOffset(18, 14, 0),
      purpose: 'nutrition_consult',
      reminderEnabled: true,
      reminderDaysBefore: 3,
      status: 'scheduled',
      notes: 'ติดตามสัดส่วนโปรตีนและดัชนีน้ำตาลในมื้ออาหารเย็น',
    },
  ];

  for (const appt of apptSeeds) {
    const id = makeSafeDocId('appt');
    batch.set(doc(db, 'patients', uid, 'appointments', id), {
      ownerId: uid,
      ...appt,
      createdAt: nowTs,
      updatedAt: nowTs,
    });
  }

  const recSeeds = [
    {
      doctorName: 'นพ. ธนกร วรโชติ',
      category: 'remission_plan',
      title: 'คงภาวะ DM Remission ต่อเนื่องในระยะ 6 เดือน',
      advice:
        'ผล HbA1c ลดลงสู่ 5.9% โดยไม่ใช้ยาลดระดับน้ำตาลมาแล้ว 5 เดือน แนะนำให้รักษารูปแบบการรับประทานอาหารแบบ Low-Glycemic และตรวจติดตาม HbA1c ห่างกัน ≥ 90 วันเพื่อความแม่นยำทางคลินิก',
      priority: 'routine',
      acknowledged: false,
      issuedDate: isoDaysOffset(-5),
    },
    {
      doctorName: 'พญ. สิริพร กิจเจริญ',
      category: 'nutrition',
      title: 'ปรับลำดับการรับประทานอาหาร (Food Sequencing)',
      advice:
        'รับประทานผักใบเขียวและโปรตีนก่อนคาร์โบไฮเดรตทุกมื้อ ช่วยลดระดับน้ำตาลหลังมื้ออาหาร (Postprandial spike) จากข้อมูล CGM ได้เฉลี่ย 15–20 mg/dL',
      priority: 'attention',
      acknowledged: true,
      issuedDate: isoDaysOffset(-14),
    },
    {
      doctorName: 'นพ. ธนกร วรโชติ',
      category: 'lab_schedule',
      title: 'เตรียมความพร้อมตรวจ HbA1c รอบถัดไป (LOINC 4548-4)',
      advice:
        'การตรวจครั้งล่าสุดผ่านมาแล้ว 98 วัน สามารถเจาะเลือดตรวจ HbA1c รอบใหม่ได้ทันทีในการนัดครั้งหน้า ไม่ติดเงื่อนไขความถี่ 90 วัน',
      priority: 'routine',
      acknowledged: false,
      issuedDate: isoDaysOffset(-1),
    },
  ];

  for (const rec of recSeeds) {
    const id = makeSafeDocId('rec');
    batch.set(doc(db, 'patients', uid, 'recommendations', id), {
      ownerId: uid,
      ...rec,
      createdAt: nowTs,
      updatedAt: nowTs,
    });
  }

  const participantSeeds = [
    {
      participantCode: 'RC-69-001',
      displayName,
      icd10Code: 'E11',
      typeArea: 1,
      activityCode: '120',
      enrolledDate: isoDaysOffset(-210),
      baselineHba1c: 8.2,
      currentHba1c: 5.9,
      targetHba1c: 6.4,
      medsFreeMonths: 5,
      remissionStage: 'sustained_remission',
      lastCheckupDate: isoDaysOffset(-14),
      nextFollowupDate: isoDaysOffset(77),
      clinicName: 'คลินิกโรคเบาหวานระยะสงบ รพ.สระบุรี',
      notes: 'ลดคาร์โบไฮเดรตและเดินหลังอาหารสม่ำเสมอ หยุดยาลดน้ำตาลได้ต่อเนื่อง 5 เดือน',
    },
    {
      participantCode: 'RC-69-002',
      displayName: 'นางสุภาพร วงศ์ษา',
      icd10Code: 'E11',
      typeArea: 1,
      activityCode: '120',
      enrolledDate: isoDaysOffset(-150),
      baselineHba1c: 7.8,
      currentHba1c: 6.3,
      targetHba1c: 6.4,
      medsFreeMonths: 3,
      remissionStage: 'in_remission',
      lastCheckupDate: isoDaysOffset(-10),
      nextFollowupDate: isoDaysOffset(81),
      clinicName: 'คลินิกโรคเบาหวานระยะสงบ รพ.สระบุรี',
      notes: 'ผ่านเกณฑ์หยุดยาครบ 3 เดือน รอตรวจยืนยัน HbA1c รอบวันที่ 91+',
    },
    {
      participantCode: 'RC-69-003',
      displayName: 'นายประสิทธิ์ มั่นคง',
      icd10Code: 'E11',
      typeArea: 3,
      activityCode: '120',
      enrolledDate: isoDaysOffset(-75),
      baselineHba1c: 8.9,
      currentHba1c: 7.1,
      targetHba1c: 6.4,
      medsFreeMonths: 0,
      remissionStage: 'improving',
      lastCheckupDate: isoDaysOffset(-7),
      nextFollowupDate: isoDaysOffset(16),
      clinicName: 'รพ.สต.บ้านหมอ',
      notes: 'ลดระดับ HbA1c ลงแล้ว 1.8% อยู่ระหว่างปรับลดขนาดยาตามแผนแพทย์',
    },
  ];

  for (const p of participantSeeds) {
    const id = makeSafeDocId('part');
    batch.set(doc(db, 'patients', uid, 'programParticipants', id), {
      ownerId: uid,
      ...p,
      createdAt: nowTs,
      updatedAt: nowTs,
    });
  }

  const delegationSeeds = [
    {
      delegateName: 'นพ. ธนกร วรโชติ',
      delegateEmail: 'thanakorn.md@saraburi-hosp.go.th',
      delegateUid: '',
      role: 'physician',
      department: 'คลินิกเบาหวานระยะสงบ (DM Remission)',
      permissions: ['manage_patients', 'edit_hba1c', 'manage_appointments', 'export_reports'],
      status: 'active',
      assignedDate: isoDaysOffset(-60),
      expiryDate: isoDaysOffset(305),
      notes: 'แพทย์ผู้รับผิดชอบหลักในการประเมินเกณฑ์หยุดยาและรหัสกิจกรรม 120',
    },
    {
      delegateName: 'พว. กมลชนก ศรีสุวรรณ',
      delegateEmail: 'kamonchanok.audit@saraburi-hosp.go.th',
      delegateUid: '',
      role: 'nurse_auditor',
      department: 'งานเวชระเบียนและส่งข้อมูล 43 แฟ้ม',
      permissions: ['audit_43files', 'export_reports', 'manage_appointments'],
      status: 'active',
      assignedDate: isoDaysOffset(-30),
      expiryDate: isoDaysOffset(335),
      notes: 'ผู้ตรวจสอบความถูกต้อง LOINC 4548-4 และป้องกัน REP Error ก่อนส่ง e-Claim',
    },
  ];

  for (const d of delegationSeeds) {
    const id = makeSafeDocId('del');
    batch.set(doc(db, 'patients', uid, 'careDelegations', id), {
      ownerId: uid,
      ...d,
      createdAt: nowTs,
      updatedAt: nowTs,
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `patients/${uid}`);
  }
}
