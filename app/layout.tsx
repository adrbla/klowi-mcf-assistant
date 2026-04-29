import type { Metadata } from "next";
import {
  Instrument_Sans,
  Instrument_Serif,
  Newsreader,
  JetBrains_Mono,
} from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-instrument-sans",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin", "latin-ext"],
  variable: "--font-newsreader",
  style: ["normal", "italic"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CC · MCF · Prep Companion",
  description: "",
  icons: { icon: "/icon.svg" },
};

const THEMES = [
  "theme-seminaire",
  "theme-sobre",
  "theme-poudre",
  "theme-nuit",
  "theme-shiny",
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${instrumentSans.variable} ${instrumentSerif.variable} ${newsreader.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <ThemeProvider
          attribute="class"
          themes={THEMES}
          defaultTheme="theme-sobre"
          enableSystem={false}
          disableTransitionOnChange={false}
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
