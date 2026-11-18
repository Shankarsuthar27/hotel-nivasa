import React, { memo } from 'react';
import './occupancy-progress-bar.css';

/**
 * OccupancyProgressBar Component
 * Rebuilt to match OTAL PMS Schedule Calendar occupancy bar specification
 * (64px × 6px pill track with green glowing progress fill).
 */
function OccupancyProgressBar({
  value = 0,
  className = '',
  style = {}
}) {
  const numericVal = Number(value);
  const clamped = Number.isFinite(numericVal)
    ? Math.max(0, Math.min(100, numericVal))
    : 0;

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Occupancy ${Math.round(clamped)}%`}
      className={`schedule-occ-progress-track ${className}`.trim()}
      style={style}
    >
      <div
        className="schedule-occ-progress-fill"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export default memo(OccupancyProgressBar);

