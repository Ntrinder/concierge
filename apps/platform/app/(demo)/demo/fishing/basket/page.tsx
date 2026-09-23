import type { Metadata, Viewport } from "next";
import { CartBadge } from "@/components/CartBadge";
import { DemoBasket } from "@/components/DemoBasket";
import s from "../fishing.module.css";

export const metadata: Metadata = { title: "Your basket — Riffle & Co." };
export const viewport: Viewport = { themeColor: "#FF5A1F" };

export default async function FishingBasket({ searchParams }: { searchParams: Promise<{ config?: string }> }) {
  const { config = "riffle" } = await searchParams;
  return (
    <div className={s.store}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;600;700&family=Barlow+Condensed:wght@600;700&display=swap" />
      <div className={s.ticker}>FREE SHIPPING OVER €100 · 60-DAY TRAIL TEST · RODS CAST-TESTED IN-HOUSE</div>
      <header className={s.header}>
        <a href="/demo/fishing" className={s.brand}><img src="/demo/riffle-logo.svg" alt="Riffle & Co. logo" width={40} height={40} /><span>RIFFLE &amp; CO.</span></a>
        <nav className={s.nav}><a href="/demo/fishing#gear">Rods</a><a href="/demo/fishing#gear">Reels</a><a href="/demo/fishing#gear">Lines</a><a href="/demo/fishing#gear">Packs</a></nav>
        <CartBadge className={s.cart} store="fishing" label="CART" />
      </header>
      <DemoBasket
        store="fishing"
        backHref="/demo/fishing"
        classNames={{
          root: s.basket, heading: s.basketHeading, row: s.basketRow, rowName: s.basketRowName,
          rowOptions: s.basketRowOptions, rowPrice: s.basketRowPrice, total: s.basketTotal,
          empty: s.basketEmpty, note: s.basketNote, link: s.basketLink,
        }}
      />
      <footer className={s.footer}>RIFFLE &amp; CO. · KENDAL, CUMBRIA · DEMO STORE FOR CONCIERGE</footer>
      <script src="/agent.js" data-config={config} async />
    </div>
  );
}
