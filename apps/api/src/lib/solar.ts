import { env } from '../env.js';

/**
 * What the kitchen wall shows about the house's solar and the car, read from the solar car
 * charger's own HTTP API. Read-only: only `/status` and `/solar.json` are ever requested, never
 * the override routes. The charger rations its Tesla API calls, so this only reads what it last
 * saw and never makes it ask the car anything.
 */
export type SolarSnapshot = {
  /** What the panels are making right now, in watts. */
  nowW: number;
  /** Generated today so far, from completed hours (it lags by up to an hour). */
  todayWh: number;
  /** Today's completed hours, for a small bar chart. */
  hours: { h: number; wh: number; carWh: number }[];
  /** The best day in the last 30, so today's bars have a scale people recognise. */
  bestDayWh: number;
  car: {
    soc: number | null;
    km: number | null;
    pluggedIn: boolean;
    charging: boolean;
    /** Amps the charger is asking for right now (0 when waiting for sun). */
    amps: number;
    /** When the charger last read the car. */
    readAt: string | null;
  } | null;
  /** "Charge now" was pressed: the car charges at full rate regardless of sun, until midnight. */
  forced: boolean;
  readAt: string;
};

const TTL_MS = 20_000;
let cache: { at: number; value: SolarSnapshot | null } | null = null;

async function get(path: string): Promise<unknown> {
  const r = await fetch(new URL(path, env.SOLAR_URL), { signal: AbortSignal.timeout(4000) });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

type Status = {
  watts?: number;
  connected?: boolean;
  phase?: string;
  commandedAmps?: number;
  overrideActive?: boolean;
  vehicle?: {
    chargingState?: string;
    connected?: boolean;
    batteryLevel?: number;
    telemetry?: { batteryLevel?: number; batteryRange?: number };
  };
  vehicleReadAt?: number;
};
type Hour = { d: string; h: number; solarWh: number; carWh: number };
type Day = { d: string; solarWh: number };

/** The house's local date: the charger logs hours in its own (Brisbane) time. */
function localDay(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return d.toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' });
}

/** For this household's wall only; null for everyone else, or when the charger can't be reached. */
export async function solarFor(householdId: string): Promise<SolarSnapshot | null> {
  if (!env.SOLAR_URL || householdId !== env.SOLAR_HOUSEHOLD_ID) return null;
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  let value: SolarSnapshot | null = null;
  try {
    const today = localDay();
    const [status, hours, days] = (await Promise.all([
      get('/status'),
      get(`/solar.json?detail=hours&from=${today}`),
      get(`/solar.json?from=${localDay(-30)}`),
    ])) as [Status, { hours: Hour[] }, { days: Day[] }];
    const todays = hours.hours.filter((x) => x.d === today);
    const v = status.vehicle;
    const soc = v?.telemetry?.batteryLevel ?? v?.batteryLevel ?? null;
    const miles = v?.telemetry?.batteryRange;
    value = {
      nowW: Math.max(0, Math.round(status.watts ?? 0)),
      todayWh: Math.round(todays.reduce((n, x) => n + x.solarWh, 0)),
      hours: todays.map((x) => ({ h: x.h, wh: Math.round(x.solarWh), carWh: Math.round(x.carWh) })),
      bestDayWh: Math.round(Math.max(0, ...days.days.map((d) => d.solarWh))),
      car: v
        ? {
            soc,
            // The Fleet API reports range in miles whatever the car's display is set to.
            km: miles ? Math.round(miles * 1.609) : null,
            pluggedIn: Boolean(status.connected ?? v.connected),
            charging: v.chargingState === 'Charging',
            amps: Math.round(status.commandedAmps ?? 0),
            readAt: status.vehicleReadAt ? new Date(status.vehicleReadAt).toISOString() : null,
          }
        : null,
      forced: Boolean(status.overrideActive),
      readAt: new Date().toISOString(),
    };
  } catch (e) {
    // The wall must never fail because the charger is restarting: it just shows no panel.
    console.warn('solar: unavailable', (e as Error).message);
  }
  cache = { at: Date.now(), value };
  return value;
}
