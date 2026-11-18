import React, { useId, useRef } from 'react';
import './cozy-wide-toggle.css';

const DENSITY_OPTIONS = [
  { id: 'cozy', label: 'Cozy' },
  { id: 'wide', label: 'Wide' }
];

export default function CozyWideToggle({
  value = 'cozy',
  onChange,
  disabled = false,
  className = ''
}) {
  const baseId = useId();
  const tabRefs = useRef([]);
  const activeIndex = value === 'wide' ? 1 : 0;

  const handleSelect = (nextValue) => {
    if (disabled || nextValue === value) return;
    if (onChange) onChange(nextValue);
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    let nextIndex = null;

    if (e.key === 'ArrowRight') {
      nextIndex = (activeIndex + 1) % DENSITY_OPTIONS.length;
    } else if (e.key === 'ArrowLeft') {
      nextIndex = (activeIndex - 1 + DENSITY_OPTIONS.length) % DENSITY_OPTIONS.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = DENSITY_OPTIONS.length - 1;
    }

    if (nextIndex !== null) {
      e.preventDefault();
      const targetOption = DENSITY_OPTIONS[nextIndex];
      handleSelect(targetOption.id);
      tabRefs.current[nextIndex]?.focus();
    }
  };

  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      data-orientation="horizontal"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={`cozy-wide-tablist ${className}`.trim()}
      style={{ outline: 'none' }}
    >
      <div
        aria-hidden="true"
        className="cozy-wide-thumb"
        style={{ left: activeIndex === 0 ? '4px' : '50%' }}
      />
      {DENSITY_OPTIONS.map((option, idx) => {
        const isActive = option.id === value;
        return (
          <button
            key={option.id}
            ref={(el) => {
              tabRefs.current[idx] = el;
            }}
            type="button"
            role="tab"
            id={`${baseId}-trigger-${option.id}`}
            aria-controls={`${baseId}-content-${option.id}`}
            aria-selected={isActive}
            data-state={isActive ? 'active' : 'inactive'}
            data-orientation="horizontal"
            tabIndex={isActive ? 0 : -1}
            disabled={disabled}
            onClick={() => handleSelect(option.id)}
            className="cozy-wide-tab"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

