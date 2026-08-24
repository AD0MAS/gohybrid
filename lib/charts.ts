export type AxisScale = {
  /** The axis maximum — a "nice" round number at or above the data's peak. */
  max: number;
  /** Evenly spaced gridline values from 0 to `max`, `max` inclusive. */
  gridlines: number[];
};

/**
 * A y-axis scale for a bar chart of integer counts: a "nice" step and
 * maximum (Heckbert's nice-numbers algorithm, applied to the step so both
 * the gridlines and the axis top land on round numbers instead of the raw
 * data's peak) and `tickCount + 1` evenly spaced gridline values. `step` is
 * rounded to at least 1, since session counts don't have fractional
 * gridlines.
 *
 * `maxValue <= 0` (an empty chart) still returns a small positive scale —
 * e.g. 0/1/2/3/4 — so the chart renders real gridlines instead of
 * collapsing to a single line at 0.
 */
export function buildAxisScale(maxValue: number, tickCount = 4): AxisScale {
  const safeMax = maxValue > 0 ? maxValue : tickCount;
  const roughStep = safeMax / tickCount;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const residual = roughStep / magnitude;
  const niceResidual =
    residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10;
  const step = Math.max(1, Math.round(niceResidual * magnitude));

  return {
    max: step * tickCount,
    gridlines: Array.from({ length: tickCount + 1 }, (_, i) => i * step),
  };
}
