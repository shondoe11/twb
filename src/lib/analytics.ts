import { track } from '@vercel/analytics';

//* typed wrapper over vercel web analytics custom events - one place fr event names & payload shapes so call sites can't drift
//& payloads are venue/ui facts only, never user input / contact details

type AnalyticsEvents = {
  //~ which pins ppl look at & frm where (map tap vs list tap)
  pin_opened: { source: 'map' | 'list'; name: string; region: string; type: string };
  //~ the app's core conversion
  directions_clicked: { name: string; region: string };
  //~ filterbar selects/checkboxes + listview gender chips
  filter_changed: { field: 'region' | 'type' | 'wheelchairAccess' | 'babyChanging' | 'unisex' | 'gender'; value: string };
  //~ community remark saved or cleared
  remark_saved: { action: 'save' | 'clear' };
  //~ feedback form submitted - category only, never the message
  feedback_sent: { category: string };
  theme_changed: { to: 'light' | 'dark' | 'oled' };
};

export function trackEvent<E extends keyof AnalyticsEvents>(event: E, props: AnalyticsEvents[E]): void {
  //~ never let analytics break ui - blocked scripts / adblockers can make track throw
  try {
    track(event, props);
  } catch {
    //~ swallow
  }
}
