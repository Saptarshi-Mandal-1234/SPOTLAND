export const emergencyNumbers = [
  { number: '112', label: 'All emergencies', note: 'India’s unified police, fire and medical emergency number.', source: 'https://112.gov.in/' },
  { number: '100', label: 'Police', note: 'Legacy number; use 112 for a unified emergency response.', source: 'https://112.gov.in/about' },
  { number: '101', label: 'Fire', note: 'Legacy fire service number; 112 is the primary emergency option.', source: 'https://112.gov.in/about' },
  { number: '108', label: 'Emergency ambulance', note: 'Service availability varies by state; use 112 if unavailable.', source: 'https://nhm.gov.in/nhm_live/index1.php?lang=1&level=2&lid=189&sublinkid=1217' },
  { number: '102', label: 'Ambulance / patient transport', note: 'Often maternity and infant transport; coverage varies by state.', source: 'https://nhm.gov.in/nhm_live/index1.php?lang=1&level=2&lid=189&sublinkid=1217' },
  { number: '1091', label: 'Women’s police helpline', note: 'Verified in Delhi; local coverage varies. For immediate danger, call 112.', source: 'https://www.delhipolice.gov.in/telephonedirectory' },
] as const;
export const emergencyVerifiedOn = '2026-09-30';
