/**
 * Firestore Security Rules Verification Spec ("Dirty Dozen" Payloads)
 * Intended for execution with @firebase/rules-unit-testing against the Firestore Emulator.
 */
import assert from 'node:assert/strict';

export const DIRTY_DOZEN_CASES = [
  { id: 1, name: 'Unauthenticated create on /patients/userA', expected: 'PERMISSION_DENIED' },
  { id: 2, name: 'Unverified email create on /patients/userA', expected: 'PERMISSION_DENIED' },
  { id: 3, name: 'Cross-tenant write to /patients/userB by userA', expected: 'PERMISSION_DENIED' },
  { id: 4, name: 'Payload ownerId mismatch on /patients/userA', expected: 'PERMISSION_DENIED' },
  { id: 5, name: 'Shadow field injection on hba1cRecords', expected: 'PERMISSION_DENIED' },
  { id: 6, name: 'Invalid ICD-10 code Z13.1 on hba1cRecords', expected: 'PERMISSION_DENIED' },
  { id: 7, name: 'Non-numeric or out-of-range HbA1c value', expected: 'PERMISSION_DENIED' },
  { id: 8, name: 'Invalid/oversized document ID poisoning', expected: 'PERMISSION_DENIED' },
  { id: 9, name: 'Client-spoofed createdAt timestamp', expected: 'PERMISSION_DENIED' },
  { id: 10, name: 'Mutating immutable ownerId/createdAt on update', expected: 'PERMISSION_DENIED' },
  { id: 11, name: 'Mutating terminal completed appointment', expected: 'PERMISSION_DENIED' },
  { id: 12, name: 'Cross-tenant PII read or blanket list query', expected: 'PERMISSION_DENIED' },
] as const;

assert.equal(DIRTY_DOZEN_CASES.length, 12);
