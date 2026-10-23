/**
 * Open-Meteo, for a household's home town: finding one by name, and its
 * weather once set. No key, no account — same free API the fedorabeast
 * morning briefing already uses (see ~/Documents/briefing on that box),
 * and the WMO code table below is copied from there rather than
 * reinvented.
 */

export interface TownCandidate {
  name: string;
  admin1: string | null;
  country: string | null;
  lat: number;
  lon: number;
  timezone: string;
}

export interface WeatherNow {
  icon: string;
  label: string;
  tempNow: number;
  high: number;
  low: number;
  rainChance: number;
  /** This place's own clock, e.g. "7:51am" — never the server's. */
  localTime: string;
}

/** WMO weather codes, as Open-Meteo reports them. */
function sky(code: number): [string, string] {
  if (code === 0) return ['☀️', 'Sunny'];
  if (code <= 2) return ['🌤️', 'Mostly sunny'];
  if (code === 3) return ['☁️', 'Cloudy'];
  if (code <= 48) return ['🌫️', 'Foggy'];
  if (code <= 57) return ['🌦️', 'Drizzle'];
  if (code <= 67) return ['🌧️', 'Rain'];
  if (code <= 77) return ['🌨️', 'Snow'];
  if (code <= 82) return ['🌦️', 'Showers'];
  return ['⛈️', 'Storms'];
}

/** "7:05" (24h, local to whatever place asked for it) → "7:05am". */
function hhmm(t: string): string {
  const [hStr, mStr] = t.split(':');
  const h = Number(hStr ?? 0);
  const m = Number(mStr ?? 0);
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''}${h < 12 ? 'am' : 'pm'}`;
}

/** The first element, or a thrown error — forecast_days=1 always gives one, so an empty array is a real fetch problem, not a shape this code should paper over. */
function first(xs: number[], what: string): number {
  const v = xs[0];
  if (v === undefined) throw new Error(`open-meteo returned no ${what}`);
  return v;
}

interface GeocodingResponse {
  results?: Array<{
    name: string;
    admin1?: string;
    country?: string;
    latitude: number;
    longitude: number;
    timezone: string;
  }>;
}

export async function searchTowns(q: string): Promise<TownCandidate[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=en&format=json`;
  const r = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`open-meteo geocoding ${r.status}`);
  const data = (await r.json()) as GeocodingResponse;
  return (data.results ?? []).map((x) => ({
    name: x.name,
    admin1: x.admin1 ?? null,
    country: x.country ?? null,
    lat: x.latitude,
    lon: x.longitude,
    timezone: x.timezone,
  }));
}

interface ForecastResponse {
  current: { time: string; temperature_2m: number; weather_code: number };
  daily: {
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
  };
}

/**
 * Today's weather for one point, in its own timezone. `current.time` and
 * `daily.time` come back as that place's local civil time (no offset), so
 * reading the clock out of the string directly is right; parsing it with
 * `Date` and reformatting would run it through the *server's* zone instead.
 */
export async function fetchWeather(lat: number, lon: number, timezone: string): Promise<WeatherNow> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    '&current=temperature_2m,weather_code' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
    `&timezone=${encodeURIComponent(timezone)}&forecast_days=1`;
  const r = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`open-meteo forecast ${r.status}`);
  const d = (await r.json()) as ForecastResponse;
  const [icon, label] = sky(first(d.daily.weather_code, 'weather code'));
  const [, clock] = d.current.time.split('T');
  if (!clock) throw new Error('open-meteo returned no current time');
  return {
    icon,
    label,
    tempNow: Math.round(d.current.temperature_2m),
    high: Math.round(first(d.daily.temperature_2m_max, 'high')),
    low: Math.round(first(d.daily.temperature_2m_min, 'low')),
    rainChance: first(d.daily.precipitation_probability_max, 'rain chance'),
    localTime: hhmm(clock),
  };
}
