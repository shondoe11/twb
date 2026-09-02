import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  //~ metadataBase makes og image/sitemap urls resolve absolutely in link previews
  metadataBase: new URL("https://toiletswithbidets.vercel.app"),
  title: "TWB - Toilets with Bidets (SG)",
  description: "Find toilets with bidets across Singapore on an interactive map",
  openGraph: {
    title: "TWB - Toilets with Bidets (SG)",
    description: "Find toilets with bidets across Singapore on an interactive map",
    type: "website",
  },
};

//~ applied bef hydration so the stored/system theme never flashes light mode
const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    //~ suppressHydrationWarning: theme script may add the 'dark' class before react hydrates
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
