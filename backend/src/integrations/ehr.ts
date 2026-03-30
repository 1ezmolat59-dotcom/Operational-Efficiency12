// STUB: EHR Integration (Phase 4)
// Connects to Epic/Cerner via HL7 FHIR R4

export async function subscribeToDischargeEvents(): Promise<void> {
  console.log('[EHR STUB] Would subscribe to discharge webhooks via FHIR R4');
}

export async function getPatientCensus(): Promise<unknown[]> {
  console.log('[EHR STUB] Would fetch patient census from EHR');
  return [];
}

export async function getPatientMobilityFlags(
  patientId: string
): Promise<{ requiresWheelchair: boolean; requiresStretcher: boolean }> {
  console.log('[EHR STUB] Would fetch mobility flags for patient', patientId);
  return { requiresWheelchair: false, requiresStretcher: false };
}
