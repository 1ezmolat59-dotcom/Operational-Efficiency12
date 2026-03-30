// STUB: NEMT Integration (Phase 4)
// Supports Lyft Health, Modivcare, or custom provider

export async function scheduleRide(
  patientId: string,
  destination: string,
  time: string,
  mobilityRequirements: string
): Promise<{ rideId: string; eta: string; provider: string }> {
  console.log('[NEMT STUB] Would schedule ride for patient', patientId);
  return { rideId: 'stub-ride-id', eta: '30 minutes', provider: 'Lyft Health' };
}

export async function getRideStatus(
  rideId: string
): Promise<{ status: string; eta: string }> {
  console.log('[NEMT STUB] Would check ride status for', rideId);
  return { status: 'confirmed', eta: '25 minutes' };
}
