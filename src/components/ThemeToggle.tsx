'use client';
//* theme toggle button + shared hook fr reading the current theme
import { useEffect, useState } from 'react';

//& 3 themes cycled in this order by toggle. oled = dark + pure black surfaces
export type Theme = 'light' | 'dark' | 'oled';
const THEME_ORDER: Theme[] = ['light', 'dark', 'oled'];

//& oled carries both classes so every existing dark: utility still applies, .oled just overrides surfaces
function readTheme(el: HTMLElement): Theme {
  if (el.classList.contains('oled')) return 'oled';
  if (el.classList.contains('dark')) return 'dark';
  return 'light';
}

function applyTheme(el: HTMLElement, theme: Theme) {
  el.classList.toggle('dark', theme !== 'light');
  el.classList.toggle('oled', theme === 'oled');
}

//& hook: tracks which theme classes the html element carries
//~ using MutationObserver so any component (eg the map) reacts to toggles instantly
export function useTheme(): Theme {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const el = document.documentElement;
    const update = () => setTheme(readTheme(el));
    update();

    const observer = new MutationObserver(update);
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return theme;
}

//& hook: tracks if html element carries 'dark' class (true fr both dark & oled - the map basemap only needs to know light vs not-light)
export function useIsDark(): boolean {
  return useTheme() !== 'light';
}

const LABELS: Record<Theme, string> = {
  light: 'Switch to dark mode',
  dark: 'Switch to OLED black mode',
  oled: 'Switch to light mode',
};

//& button: cycles light > dark > oled & persists the choice
const ThemeToggle = () => {
  const theme = useTheme();
  //~ avoid hydration mismatch: only render correct icon aft mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const toggle = () => {
    const el = document.documentElement;
    const current = readTheme(el);
    const next = THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length];
    applyTheme(el, next);
    try {
      localStorage.setItem('theme', next);
    } catch {
      //~ localStorage unavailable (private mode etc) - theme still toggles fr this session
    }
  };

  //& icon shows theme to switch TO, matching old moon/sun behavior
  const shown: Theme = mounted ? theme : 'light';

  return (
    <button
      onClick={toggle}
      aria-label={LABELS[shown]}
      title={LABELS[shown]}
      className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
    >
      {shown === 'oled' ? (
        //~ sun icon
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : shown === 'dark' ? (
        //~ oled icon - filled disc w a thin ring, reads as "pure black screen"
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none" />
        </svg>
      ) : (
        //~ moon icon
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      )}
    </button>
  );
};

export default ThemeToggle;
