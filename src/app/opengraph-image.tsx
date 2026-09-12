import { ImageResponse } from 'next/og';

//& generated og image fr link previews (whatsapp/telegram/twitter etc) - rendered at build time, no design asset needed

export const runtime = 'edge';
export const alt = 'TWB - Toilets with Bidets (SG)';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

//& brand blue - same as icon.svg light-mode colour & manifest theme_color
const BRAND = '#2563eb';

//~ inline copy of src/app/icon.svg geometry - satori can't load external svgs & `currentColor` isn't supported, so colour is hardcoded
function TwbIcon({ size: px }: { size: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="2 1.6 196.4 196.8" width={px} height={px}>
      <g fill="none" stroke={BRAND}>
        <g strokeWidth="3">
          <path d="m0 16v-16h16" />
          <path d="m200 16v-16h-16" />
          <path d="m0 184v16h16" />
          <path d="m200 184v16h-16" />
        </g>
        <path strokeWidth="10" strokeLinecap="round" d="m29.962 43.145c-0.50668 7.5599 0.84208 15.237 3.8951 22.172 3.4553 7.8484 9.2224 14.822 16.779 18.876 9.2613 4.9689 20.865 5.144 30.412 0.74905 8.9145-4.1038 15.966-12.075 18.952-21.423" />
        <path strokeWidth="10" strokeLinecap="round" d="m170.04 43.145c0.50668 7.5599-0.84208 15.237-3.8951 22.172-3.4553 7.8484-9.2224 14.822-16.779 18.876-9.2613 4.9689-20.864 5.144-30.412 0.74905-8.9145-4.1038-15.966-12.075-18.952-21.423" />
      </g>
      <g fill={BRAND}>
        <circle r="5" cy="120.75" cx="47.939" />
        <circle r="5" cy="114.14" cx="63.697" />
        <circle r="5" cy="117.98" cx="79.534" />
        <circle r="5" cy="129.68" cx="91.677" />
        <circle r="5" cy="143.82" cx="100" />
        <circle r="5" cy="160.81" cx="100" />
        <circle r="5" cy="177.7" cx="100" />
        <circle r="5" cy="120.75" cx="152.06" />
        <circle r="5" cy="114.14" cx="136.3" />
        <circle r="5" cy="117.98" cx="120.47" />
        <circle r="5" cy="129.68" cx="108.32" />
      </g>
    </svg>
  );
}

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#ffffff',
          color: BRAND,
          fontFamily: 'sans-serif',
        }}
      >
        <TwbIcon size={260} />
        <div style={{ fontSize: 72, fontWeight: 700, letterSpacing: -2, marginTop: 12 }}>TWB</div>
        <div style={{ fontSize: 40, fontWeight: 500, marginTop: 8 }}>Toilets with Bidets (SG)</div>
        <div style={{ fontSize: 26, marginTop: 20, color: '#4b5563' }}>
          Find bidet-equipped toilets across Singapore on an interactive map
        </div>
      </div>
    ),
    size
  );
}
