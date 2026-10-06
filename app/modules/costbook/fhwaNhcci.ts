/**
 * FHWA National Highway Construction Cost Index (NHCCI).
 *
 * Quarterly observations, 2003 Q1 – 2026 Q1 (93 quarters).
 * Source: data.transportation.gov dataset r94d-n4f9 (Socrata, no auth), pulled 2026-10-06.
 * License: USGOV_WORKS (public domain). Fisher Ideal Index on state winning-bid tabulations.
 * National scope — use for heavy-civil escalation context, not local pricing.
 */

export interface NhcciObservation { year: number; quarter: 1|2|3|4; index: number; indexSeasonallyAdjusted: number; }

export const NHCCI_OBSERVATIONS: readonly NhcciObservation[] = [
  { year: 2003, quarter: 1 as 1|2|3|4, index: 1.0, indexSeasonallyAdjusted: 1.011968272 },
  { year: 2003, quarter: 2 as 1|2|3|4, index: 1.009624, indexSeasonallyAdjusted: 1.008153098 },
  { year: 2003, quarter: 3 as 1|2|3|4, index: 1.02399, indexSeasonallyAdjusted: 1.001933537 },
  { year: 2003, quarter: 4 as 1|2|3|4, index: 1.021636, indexSeasonallyAdjusted: 1.038194946 },
  { year: 2004, quarter: 1 as 1|2|3|4, index: 1.045945, indexSeasonallyAdjusted: 1.056452417 },
  { year: 2004, quarter: 2 as 1|2|3|4, index: 1.100941, indexSeasonallyAdjusted: 1.099113254 },
  { year: 2004, quarter: 3 as 1|2|3|4, index: 1.143055, indexSeasonallyAdjusted: 1.126211899 },
  { year: 2004, quarter: 4 as 1|2|3|4, index: 1.149222, indexSeasonallyAdjusted: 1.165240077 },
  { year: 2005, quarter: 1 as 1|2|3|4, index: 1.240895, indexSeasonallyAdjusted: 1.251691529 },
  { year: 2005, quarter: 2 as 1|2|3|4, index: 1.281448, indexSeasonallyAdjusted: 1.278780834 },
  { year: 2005, quarter: 3 as 1|2|3|4, index: 1.371839, indexSeasonallyAdjusted: 1.346665775 },
  { year: 2005, quarter: 4 as 1|2|3|4, index: 1.412496, indexSeasonallyAdjusted: 1.420728754 },
  { year: 2006, quarter: 1 as 1|2|3|4, index: 1.448616, indexSeasonallyAdjusted: 1.47429265 },
  { year: 2006, quarter: 2 as 1|2|3|4, index: 1.52135, indexSeasonallyAdjusted: 1.518053985 },
  { year: 2006, quarter: 3 as 1|2|3|4, index: 1.618392, indexSeasonallyAdjusted: 1.575149501 },
  { year: 2006, quarter: 4 as 1|2|3|4, index: 1.552662, indexSeasonallyAdjusted: 1.583032062 },
  { year: 2007, quarter: 1 as 1|2|3|4, index: 1.563617, indexSeasonallyAdjusted: 1.569740646 },
  { year: 2007, quarter: 2 as 1|2|3|4, index: 1.561181, indexSeasonallyAdjusted: 1.55837379 },
  { year: 2007, quarter: 3 as 1|2|3|4, index: 1.53754, indexSeasonallyAdjusted: 1.517484619 },
  { year: 2007, quarter: 4 as 1|2|3|4, index: 1.514275, indexSeasonallyAdjusted: 1.5149655 },
  { year: 2008, quarter: 1 as 1|2|3|4, index: 1.568627, indexSeasonallyAdjusted: 1.58598914 },
  { year: 2008, quarter: 2 as 1|2|3|4, index: 1.644059, indexSeasonallyAdjusted: 1.641254959 },
  { year: 2008, quarter: 3 as 1|2|3|4, index: 1.784774, indexSeasonallyAdjusted: 1.746477669 },
  { year: 2008, quarter: 4 as 1|2|3|4, index: 1.626675, indexSeasonallyAdjusted: 1.652130652 },
  { year: 2009, quarter: 1 as 1|2|3|4, index: 1.49997, indexSeasonallyAdjusted: 1.507542961 },
  { year: 2009, quarter: 2 as 1|2|3|4, index: 1.439771, indexSeasonallyAdjusted: 1.437094833 },
  { year: 2009, quarter: 3 as 1|2|3|4, index: 1.429229, indexSeasonallyAdjusted: 1.411066156 },
  { year: 2009, quarter: 4 as 1|2|3|4, index: 1.402628, indexSeasonallyAdjusted: 1.424790666 },
  { year: 2010, quarter: 1 as 1|2|3|4, index: 1.441913, indexSeasonallyAdjusted: 1.446401426 },
  { year: 2010, quarter: 2 as 1|2|3|4, index: 1.438427, indexSeasonallyAdjusted: 1.435159576 },
  { year: 2010, quarter: 3 as 1|2|3|4, index: 1.446513, indexSeasonallyAdjusted: 1.431463702 },
  { year: 2010, quarter: 4 as 1|2|3|4, index: 1.429966, indexSeasonallyAdjusted: 1.449032478 },
  { year: 2011, quarter: 1 as 1|2|3|4, index: 1.456828, indexSeasonallyAdjusted: 1.46252569 },
  { year: 2011, quarter: 2 as 1|2|3|4, index: 1.500597, indexSeasonallyAdjusted: 1.497127514 },
  { year: 2011, quarter: 3 as 1|2|3|4, index: 1.541206, indexSeasonallyAdjusted: 1.52249015 },
  { year: 2011, quarter: 4 as 1|2|3|4, index: 1.541088, indexSeasonallyAdjusted: 1.549593169 },
  { year: 2012, quarter: 1 as 1|2|3|4, index: 1.576907, indexSeasonallyAdjusted: 1.584654535 },
  { year: 2012, quarter: 2 as 1|2|3|4, index: 1.626998, indexSeasonallyAdjusted: 1.622640284 },
  { year: 2012, quarter: 3 as 1|2|3|4, index: 1.595538, indexSeasonallyAdjusted: 1.58553506 },
  { year: 2012, quarter: 4 as 1|2|3|4, index: 1.607117, indexSeasonallyAdjusted: 1.609383608 },
  { year: 2013, quarter: 1 as 1|2|3|4, index: 1.59082, indexSeasonallyAdjusted: 1.61585362 },
  { year: 2013, quarter: 2 as 1|2|3|4, index: 1.623509, indexSeasonallyAdjusted: 1.618734295 },
  { year: 2013, quarter: 3 as 1|2|3|4, index: 1.644783, indexSeasonallyAdjusted: 1.604273975 },
  { year: 2013, quarter: 4 as 1|2|3|4, index: 1.59307, indexSeasonallyAdjusted: 1.607635632 },
  { year: 2014, quarter: 1 as 1|2|3|4, index: 1.627779, indexSeasonallyAdjusted: 1.642742402 },
  { year: 2014, quarter: 2 as 1|2|3|4, index: 1.669892, indexSeasonallyAdjusted: 1.664435478 },
  { year: 2014, quarter: 3 as 1|2|3|4, index: 1.735101, indexSeasonallyAdjusted: 1.70492641 },
  { year: 2014, quarter: 4 as 1|2|3|4, index: 1.693793, indexSeasonallyAdjusted: 1.719273472 },
  { year: 2015, quarter: 1 as 1|2|3|4, index: 1.719765, indexSeasonallyAdjusted: 1.728280452 },
  { year: 2015, quarter: 2 as 1|2|3|4, index: 1.704847, indexSeasonallyAdjusted: 1.698929134 },
  { year: 2015, quarter: 3 as 1|2|3|4, index: 1.706301, indexSeasonallyAdjusted: 1.685894886 },
  { year: 2015, quarter: 4 as 1|2|3|4, index: 1.662658, indexSeasonallyAdjusted: 1.686172522 },
  { year: 2016, quarter: 1 as 1|2|3|4, index: 1.631144, indexSeasonallyAdjusted: 1.652608914 },
  { year: 2016, quarter: 2 as 1|2|3|4, index: 1.677906, indexSeasonallyAdjusted: 1.6700135 },
  { year: 2016, quarter: 3 as 1|2|3|4, index: 1.679756, indexSeasonallyAdjusted: 1.65378679 },
  { year: 2016, quarter: 4 as 1|2|3|4, index: 1.653447, indexSeasonallyAdjusted: 1.657562255 },
  { year: 2017, quarter: 1 as 1|2|3|4, index: 1.617234, indexSeasonallyAdjusted: 1.653011811 },
  { year: 2017, quarter: 2 as 1|2|3|4, index: 1.684628, indexSeasonallyAdjusted: 1.672884021 },
  { year: 2017, quarter: 3 as 1|2|3|4, index: 1.734304, indexSeasonallyAdjusted: 1.693802036 },
  { year: 2017, quarter: 4 as 1|2|3|4, index: 1.661883, indexSeasonallyAdjusted: 1.689635057 },
  { year: 2018, quarter: 1 as 1|2|3|4, index: 1.674676, indexSeasonallyAdjusted: 1.691096427 },
  { year: 2018, quarter: 2 as 1|2|3|4, index: 1.752068, indexSeasonallyAdjusted: 1.734692918 },
  { year: 2018, quarter: 3 as 1|2|3|4, index: 1.844641, indexSeasonallyAdjusted: 1.828899941 },
  { year: 2018, quarter: 4 as 1|2|3|4, index: 1.873043, indexSeasonallyAdjusted: 1.870604335 },
  { year: 2019, quarter: 1 as 1|2|3|4, index: 1.849188, indexSeasonallyAdjusted: 1.903221417 },
  { year: 2019, quarter: 2 as 1|2|3|4, index: 1.954851097, indexSeasonallyAdjusted: 1.931596246 },
  { year: 2019, quarter: 3 as 1|2|3|4, index: 1.971934754, indexSeasonallyAdjusted: 1.920816106 },
  { year: 2019, quarter: 4 as 1|2|3|4, index: 1.92261743, indexSeasonallyAdjusted: 1.938014087 },
  { year: 2020, quarter: 1 as 1|2|3|4, index: 1.968679539, indexSeasonallyAdjusted: 2.003846675 },
  { year: 2020, quarter: 2 as 1|2|3|4, index: 1.96474271, indexSeasonallyAdjusted: 1.940339424 },
  { year: 2020, quarter: 3 as 1|2|3|4, index: 1.889677421, indexSeasonallyAdjusted: 1.869925696 },
  { year: 2020, quarter: 4 as 1|2|3|4, index: 1.860110208, indexSeasonallyAdjusted: 1.889311679 },
  { year: 2021, quarter: 1 as 1|2|3|4, index: 1.91116954, indexSeasonallyAdjusted: 1.933832589 },
  { year: 2021, quarter: 2 as 1|2|3|4, index: 2.036274797, indexSeasonallyAdjusted: 2.014311442 },
  { year: 2021, quarter: 3 as 1|2|3|4, index: 2.107518832, indexSeasonallyAdjusted: 2.084498328 },
  { year: 2021, quarter: 4 as 1|2|3|4, index: 2.18210826, indexSeasonallyAdjusted: 2.208545011 },
  { year: 2022, quarter: 1 as 1|2|3|4, index: 2.284086099, indexSeasonallyAdjusted: 2.315797646 },
  { year: 2022, quarter: 2 as 1|2|3|4, index: 2.555465592, indexSeasonallyAdjusted: 2.536403915 },
  { year: 2022, quarter: 3 as 1|2|3|4, index: 2.78198294, indexSeasonallyAdjusted: 2.739912474 },
  { year: 2022, quarter: 4 as 1|2|3|4, index: 2.783970683, indexSeasonallyAdjusted: 2.788429351 },
  { year: 2023, quarter: 1 as 1|2|3|4, index: 2.84260608, indexSeasonallyAdjusted: 2.90570176 },
  { year: 2023, quarter: 2 as 1|2|3|4, index: 2.968720527, indexSeasonallyAdjusted: 2.959391602 },
  { year: 2023, quarter: 3 as 1|2|3|4, index: 3.129812483, indexSeasonallyAdjusted: 3.050050564 },
  { year: 2023, quarter: 4 as 1|2|3|4, index: 3.115808219, indexSeasonallyAdjusted: 3.158696277 },
  { year: 2024, quarter: 1 as 1|2|3|4, index: 3.191321352, indexSeasonallyAdjusted: 3.240589508 },
  { year: 2024, quarter: 2 as 1|2|3|4, index: 3.16074104, indexSeasonallyAdjusted: 3.162309382 },
  { year: 2024, quarter: 3 as 1|2|3|4, index: 3.362867071, indexSeasonallyAdjusted: 3.258769913 },
  { year: 2024, quarter: 4 as 1|2|3|4, index: 3.232646078, indexSeasonallyAdjusted: 3.238746815 },
  { year: 2025, quarter: 1 as 1|2|3|4, index: 3.162838217, indexSeasonallyAdjusted: 3.217834436 },
  { year: 2025, quarter: 2 as 1|2|3|4, index: 3.210395449, indexSeasonallyAdjusted: 3.219829568 },
  { year: 2025, quarter: 3 as 1|2|3|4, index: 3.30651334, indexSeasonallyAdjusted: 3.230251247 },
  { year: 2025, quarter: 4 as 1|2|3|4, index: 3.221849297, indexSeasonallyAdjusted: 3.247045479 },
  { year: 2026, quarter: 1 as 1|2|3|4, index: 3.134822428, indexSeasonallyAdjusted: 3.165451056 },
];

export function latestNhcci(): NhcciObservation {
  return NHCCI_OBSERVATIONS[NHCCI_OBSERVATIONS.length - 1];
}

export function nhcciAt(year: number, quarter: 1|2|3|4): NhcciObservation | undefined {
  return NHCCI_OBSERVATIONS.find((o) => o.year === year && o.quarter === quarter);
}

/** Percent change between two NHCCI index values. */
export function nhcciPercentChange(from: number, to: number): number {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === 0) throw new Error("NHCCI change requires finite, non-zero baseline");
  return ((to / from) - 1) * 100;
}

/** Year-over-year change for the latest quarter vs the same quarter one year earlier. */
export function nhcciYearOverYear(): number | undefined {
  const latest = latestNhcci();
  const prior = nhcciAt(latest.year - 1, latest.quarter);
  if (!prior) return undefined;
  return nhcciPercentChange(prior.index, latest.index);
}
