import { ImageResponse } from 'next/og';

//& generated og image fr link previews (whatsapp/telegram/twitter etc) - rendered at build time, no design asset needed

export const runtime = 'edge';
export const alt = 'TWB - Toilets with Bidets (SG)';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

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
          background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 60%, #38bdf8 100%)',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 120, marginBottom: 8 }}>🚽💦</div>
        <div style={{ fontSize: 72, fontWeight: 700, letterSpacing: -2 }}>TWB</div>
        <div style={{ fontSize: 40, fontWeight: 500, marginTop: 8 }}>Toilets with Bidets (SG)</div>
        <div style={{ fontSize: 26, marginTop: 20, opacity: 0.85 }}>
          Find bidet-equipped toilets across Singapore on an interactive map
        </div>
      </div>
    ),
    size
  );
}
