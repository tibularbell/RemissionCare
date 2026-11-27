# Security Specification & Payload-First TDD

## 1. Data Invariants
1. **Strict Patient Ownership**: Every `/patients/{patientId}` document and all subcollections (`private`, `hba1cRecords`, `deviceReadings`, `appointments`, `recommendations`, `programParticipants`, `careDelegations`) are strictly owned by `request.auth.uid == patientId` and `ownerId == request.auth.uid`.
2. **Email Verification Mandate**: All reads and writes require `request.auth != null && request.auth.token.email_verified == true`.
3. **PII Isolation**: Sensitive PII (`cidMasked`, `fullName`, `birthDate`, `phone`, `email`) resides solely in `/patients/{patientId}/private/pii` and is inaccessible to any other user. `programParticipants` stores only clinical progress fields without PII, and `careDelegations` (containing `delegateEmail`) is strictly owner/admin restricted.
4. **Master Gate Relational Sync**: Subcollection writes verify parent `/patients/{patientId}` exists (`existsAfter` / `getAfter`) and `ownerId == request.auth.uid`.
5. **Immutable Identity & Creation Timestamps**: `ownerId` and `createdAt` cannot be modified on update (plus `enrolledDate` and `baselineHba1c` on `programParticipants`); `createdAt` on create and `updatedAt` on create/update must equal `request.time`.
6. **Clinical Value Integrity**: `Hba1cRecord.value` and `ProgramParticipant` HbA1c values (`baselineHba1c`, `currentHba1c`) must be valid numeric percentages in `[3.0, 20.0]`, `icd10Code` must be in `['E10','E11','E12','E13','E14']` (preventing invalid `Z13.1` screening entries), and strings/arrays (`careDelegations.permissions`) are strictly length- and allowlist-bounded.
7. **Terminal Appointment State Locking**: Once an appointment reaches `status == 'completed'` or `status == 'cancelled'`, it cannot be mutated further (unless overridden by verified `isAdmin()`).
8. **Bootstrapped Admin & System Settings Protection**: `/systemSettings/default` is readable via `get` by verified signed-in users and writable only by verified `isAdmin()` (`tibularbell@gmail.com` or UID present in `/admins/{uid}`). `/admins/{uid}` prevents self-escalation and self-deletion.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Write**: `create /patients/userA` with `auth = null`.
2. **Unverified Email Write**: `create /patients/userA` with `auth.token.email_verified = false`.
3. **Cross-Tenant Ownership Spoof**: `create /patients/userB` signed in as `userA` with `ownerId: "userB"`.
4. **OwnerId Impersonation in Payload**: `create /patients/userA` signed in as `userA` with `ownerId: "userB"`.
5. **Shadow Field Injection**: `create /patients/userA/hba1cRecords/rec1` including extra field `isAdmin: true` or `bypassAudit: true`.
6. **Invalid ICD-10 Screening Code (Z13.1)**: `create /patients/userA/hba1cRecords/rec2` with `icd10Code: "Z13.1"`.
7. **HbA1c Numeric Range / String Poisoning**: `create /patients/userA/hba1cRecords/rec3` with `value: "<5.8"` (string instead of number) or `value: 999`.
8. **ID Poisoning (Oversized / Invalid Path Variable)**: `create /patients/userA/hba1cRecords/bad$id!with*invalid` or 300-char ID.
9. **Client-Spoofed Timestamp**: `create /patients/userA/hba1cRecords/rec4` with `createdAt: Timestamp(2020-01-01)` instead of `request.time`.
10. **Immutable Field Tampering on Update**: `update /patients/userA/hba1cRecords/rec1` attempting to mutate `ownerId` or `createdAt`.
11. **Terminal Appointment Mutation**: `update /patients/userA/appointments/appt1` when existing `status == "completed"`.
12. **PII Cross-Read / Blanket List**: `get /patients/userB/private/pii` or `list /patients` signed in as `userA`.
