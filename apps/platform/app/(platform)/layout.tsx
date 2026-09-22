import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";
import "./globals.css";

const sans = Instrument_Sans({ subsets: ["latin"], variable: "--font-platform" });

export const metadata: Metadata = {
  title: "Concierge — shopping assistant studio",
  description: "Set up a shopping assistant that looks like your store.",
};

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <body>{children}</body>
    </html>
  );
}
