import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://toiletswithbidets.vercel.app";
const SITE_NAME = "TWB - Toilets with Bidets (SG)";
const SITE_DESC = "Find toilets with bidets across Singapore on an interactive map";

export const metadata: Metadata = {
  //~ metadataBase makes og image/sitemap urls resolve absolutely in link previews
  metadataBase: new URL(SITE_URL),
  //~ template so child pages (about) get consistent suffix
  title: { default: SITE_NAME, template: "%s | TWB" },
  description: SITE_DESC,
  applicationName: "TWB",
  keywords: ["bidet", "toilet", "singapore", "public toilet", "bidet toilet", "toilets with bidets", "wheelchair accessible toilet", "baby changing"],
  //~ canonical defaults to the current path resolved against metadataBase
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESC,
    type: "website",
    url: SITE_URL,
    siteName: "TWB",
    locale: "en_SG",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESC,
  },
};

//& theme-color follows header bg in each mode so mobile browser chrome blends in
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1f2937" },
  ],
};

//& json-ld structured data - tells search engines this is web app abt sg
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE_NAME,
  alternateName: "TWB",
  url: SITE_URL,
  description: SITE_DESC,
  applicationCategory: "TravelApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "SGD" },
  areaServed: { "@type": "Country", name: "Singapore" },
  inLanguage: "en",
};

//& applied bef hydration so the stored/system theme never flashes light mode
//~ oled adds both classes: dark: utilities keep working, .oled overrides surfaces to pure black
const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');var c=document.documentElement.classList;if(t==='oled'){c.add('dark','oled');}else if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){c.add('dark');}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    //~ suppressHydrationWarning: theme script may add 'dark' class before react hydrates
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        {/*! both are free on hobby & no-op outside vercel: analytics 50k events/mo, speed insights 10k/30d */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
