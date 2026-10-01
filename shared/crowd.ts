export type CrowdLevel = 'quiet' | 'moderate' | 'busy';
export interface CrowdReport { level: CrowdLevel; created_at: number }
export interface CrowdEstimate { percentage: number | null; samples: number; dates: number }
const day = 86400000;
function local(time: number) { return new Date(time + 19800000); }
// Empirical busy-report share, not venue occupancy or a calibrated forecast.
// Match weekday and +/- one hour in IST; retain only the previous 90 days.
export function estimateCrowd(reports: CrowdReport[], now = Date.now()): CrowdEstimate {
  const target = local(now);
  const matching = reports.filter(report => {
    const date = local(report.created_at);
    const difference = Math.abs(date.getUTCHours() - target.getUTCHours());
    return report.created_at <= now && report.created_at > now - 90 * day && date.getUTCDay() === target.getUTCDay() && Math.min(difference, 24 - difference) <= 1;
  });
  const dates = new Set(matching.map(report => local(report.created_at).toISOString().slice(0, 10))).size;
  return { percentage: matching.length >= 15 && dates >= 3 ? Math.round(100 * matching.filter(report => report.level === 'busy').length / matching.length) : null, samples: matching.length, dates };
}
