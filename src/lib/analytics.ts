//* typed ui interaction events - one place fr event names & payload shapes so call sites can't drift
//& payloads are venue/ui facts only, never user input / contact details
//& self-hosted: events POST to /api/events -> supabase 'events' table. this file imports by both client wrapper & api route, so must stay free of browser-only / server-only imports

export type AnalyticsEvents = {
  //~ which pins ppl look at & frm where (map tap vs list tap)
  pin_opened: { source: 'map' | 'list'; name: string; region: string; type: string };
  //~ the app's core conversion
  directions_clicked: { name: string; region: string };
  //~ filterbar selects/checkboxes + listview gender chips
  filter_changed: { field: 'region' | 'type' | 'wheelchairAccess' | 'babyChanging' | 'unisex' | 'gender'; value: string };
  //~ community remark saved or cleared
  remark_saved: { action: 'save' | 'clear' };
  //~ feedback form submitted - category only, never msg
  feedback_sent: { category: string };
  theme_changed: { to: 'light' | 'dark' | 'oled' };
  //~ where ppl browse on map - centre rounded to 3dp (~100m) + zoom, user-initiated moves only, debounced
  map_moved: { lat: number; lng: number; zoom: number };
  //~ list search that matched nothing - the only user-typed value we keep, lowercased & truncated. tells us which venues missing
  search_unmatched: { term: string };
  //~ 'find me' button used - once per map mount
  geolocate_used: Record<string, never>;
};

//& runtime whitelist fr api - must list every key of AnalyticsEvents (the satisfies clause makes tsc fail if 1 is missed)
export const EVENT_NAMES = [
  'pin_opened',
  'directions_clicked',
  'filter_changed',
  'remark_saved',
  'feedback_sent',
  'theme_changed',
  'map_moved',
  'search_unmatched',
  'geolocate_used',
] as const satisfies readonly (keyof AnalyticsEvents)[];

//& per-tab session id: random, lives in sessionStorage so it dies w tab & never follows anyone across visits
const SESSION_KEY = 'twb_sid';
function getSessionId(): string | null {
  try {
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    //~ storage blocked (private mode etc) - events still record, just w/o journey link
    return null;
  }
}

//& server-side sanity caps fr props - generous vs real payloads, tight vs abuse
export const EVENT_LIMITS = {
  maxProps: 8,
  maxKeyLength: 32,
  maxValueLength: 120,
} as const;

export function trackEvent<E extends keyof AnalyticsEvents>(event: E, props: AnalyticsEvents[E]): void {
  if (typeof window === 'undefined') return;

  const payload = JSON.stringify({ name: event, props, page: window.location.pathname, sid: getSessionId() });

  //~ dev: log instead of polluting prod table
  if (process.env.NODE_ENV === 'development') {
    console.debug('[events]', event, props);
    return;
  }

  //~ never let analytics break ui
  try {
    //~ sendBeacon is fire-and-forget & survives navigation (directions link opens new tab, list taps re-render) - fall back to keepalive fetch
    const blob = new Blob([payload], { type: 'application/json' });
    if (!navigator.sendBeacon?.('/api/events', blob)) {
      void fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {});
    }
  } catch {
    //~ swallow
  }
}
