export interface WeatherHour { time: number; temperature: number; rainChance: number; precipitation: number; wind: number; code: number; isDay: boolean }
export interface Forecast { fetchedAt: number; hours: WeatherHour[] }
const codes: Record<number, string> = { 0: 'Clear sky', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Freezing fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 56: 'Freezing drizzle', 57: 'Heavy freezing drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Heavy freezing rain', 71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains', 80: 'Light showers', 81: 'Showers', 82: 'Heavy showers', 85: 'Snow showers', 86: 'Heavy snow showers', 95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with heavy hail' };
export const conditions = (code: number) => codes[code] || 'Unknown conditions';
export function parseForecast(data: unknown): Forecast {
  const value = data as Forecast;
  if (!value || !Number.isFinite(value.fetchedAt) || !Array.isArray(value.hours) || !value.hours.length || value.hours.length > 168) throw new Error('Invalid weather response.');
  for (const [index, hour] of value.hours.entries()) {
    if (!hour || ![hour.time, hour.temperature, hour.rainChance, hour.precipitation, hour.wind, hour.code].every(Number.isFinite) || hour.temperature < -90 || hour.temperature > 65 || hour.rainChance < 0 || hour.rainChance > 100 || hour.precipitation < 0 || hour.wind < 0 || !Number.isInteger(hour.code) || typeof hour.isDay !== 'boolean' || (index > 0 && hour.time - value.hours[index - 1].time !== 3600000)) throw new Error('Invalid weather response.');
  }
  return value;
}
export const weatherTime = (time: number) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(time);
