import { useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { type ThemeMode, useTheme } from '../../theme/useTheme';

const THEME_OPTIONS: Array<{
  value: ThemeMode;
  label: string;
  description: string;
}> = [
  {
    value: 'system',
    label: 'System',
    description: 'Follow your browser or device setting.',
  },
  {
    value: 'light',
    label: 'Light',
    description: 'Always use the light theme.',
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'Always use the dark theme.',
  },
];

function formatModeLabel(mode: ThemeMode, resolvedTheme: 'light' | 'dark') {
  if (mode === 'system') {
    return `System (${resolvedTheme})`;
  }

  return mode === 'light' ? 'Light' : 'Dark';
}

export default function ThemeMenu() {
  const { isSignedIn } = useAuth();
  const { mode, resolvedTheme, setMode } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();
  const currentThemeLabel = formatModeLabel(mode, resolvedTheme);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="theme-menu" ref={menuRef}>
      <button
        type="button"
        className="theme-menu-button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={popoverId}
        aria-label={`Theme settings. Current mode: ${currentThemeLabel}`}
        title="Theme settings"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span className="theme-menu-button-icon" aria-hidden="true">⚙</span>
      </button>

      {isOpen && (
        <div id={popoverId} className="theme-menu-popover" role="dialog" aria-label="Theme settings">
          <p className="theme-menu-title">Appearance</p>
          <p className="theme-menu-description">
            Use your system preference by default or choose a fixed mode.
          </p>

          <fieldset className="theme-menu-options">
            <legend className="theme-menu-legend">Theme mode</legend>
            {THEME_OPTIONS.map((option) => (
              <label key={option.value} className="theme-menu-option">
                <input
                  type="radio"
                  name="theme-mode"
                  value={option.value}
                  checked={mode === option.value}
                  onChange={() => {
                    setMode(option.value);
                    setIsOpen(false);
                  }}
                />
                <span className="theme-menu-option-copy">
                  <span className="theme-menu-option-label">{option.label}</span>
                  <span className="theme-menu-option-description">{option.description}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {isSignedIn && (
            <>
              <p className="theme-menu-title theme-menu-section-title">Settings</p>
              <Link
                to="/settings/ai-accounts"
                className="theme-menu-settings-link"
                onClick={() => setIsOpen(false)}
              >
                <span className="theme-menu-option-label">AI Accounts</span>
                <span className="theme-menu-option-description">Manage your OpenAI and Anthropic connections.</span>
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
