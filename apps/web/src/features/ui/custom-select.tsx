'use client';

import { useEffect, useRef, useState } from 'react';

export interface CustomSelectOption {
  readonly value: string;
  readonly label: string;
}

interface CustomSelectProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly options: readonly CustomSelectOption[];
  readonly disabled?: boolean;
  readonly className?: string;
  readonly placeholder?: string;
  readonly style?: React.CSSProperties;
  readonly align?: 'left' | 'right';
}

export function CustomSelect({
  value,
  onChange,
  options,
  disabled = false,
  className = '',
  placeholder = 'Select option',
  style,
  align = 'left',
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleOutsideClick(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value);
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  return (
    <div
      className={`custom-dropdown${isOpen ? ' is-open' : ''} ${className}`}
      ref={dropdownRef}
      style={style}
    >
      <button
        className="custom-dropdown-trigger"
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span>{displayLabel}</span>
        <span className="custom-dropdown-arrow" aria-hidden="true">▼</span>
      </button>
      {isOpen && (
        <ul
          className="custom-dropdown-menu"
          role="listbox"
          style={align === 'right' ? { left: 'auto', right: 0 } : undefined}
        >
          {options.map((opt) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              className={`custom-dropdown-item${opt.value === value ? ' is-selected' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChange(opt.value);
                setIsOpen(false);
              }}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
