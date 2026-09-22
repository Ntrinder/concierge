import type { Metadata, Viewport } from "next";
import { CATALOGS } from "@concierge/agent/core";
import { CartBadge } from "@/components/CartBadge";
import s from "./fishing.module.css";

export const metadata: Metadata = { title: "Riffle & Co. — fly fishing gear for small water" };
export const viewport: Viewport = { themeColor: "#FF5A1F" };

export default async function FishingStore({ searchParams }: { searchParams: Promise<{ config?: string }> }) {
  const { config = "riffle" } = await searchParams;
  const gear = CATALOGS.fishing.filter((p) => p.attrs.flyRod === true);
  return (
    <div className={s.store}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;600;700&family=Barlow+Condensed:wght@600;700&display=swap" />
      <div className={s.ticker}>FREE SHIPPING OVER €100 · 60-DAY TRAIL TEST · RODS CAST-TESTED IN-HOUSE</div>
      <header className={s.header}>
        <a href="#" className={s.brand}><img src="/demo/riffle-logo.svg" alt="Riffle & Co. logo" width={40} height={40} /><span>RIFFLE &amp; CO.</span></a>
        <nav className={s.nav}><a href="#">Rods</a><a href="#">Reels</a><a href="#">Lines</a><a href="#">Packs</a></nav>
        <CartBadge className={s.cart} toastClassName={s.toast} label="CART" />
      </header>
      <section className={s.hero}>
        <p className={s.kicker}>FIELD-TESTED / 2026</p>
        <h1>BUILT FOR<br />SMALL WATER.</h1>
        <p className={s.lede}>Packable fly rods and kit for anglers who walk in. Every spec measured, not marketed.</p>
        <a href="#gear" className={s.button}>SHOP RODS →</a>
      </section>
      <section id="gear" className={s.gear}>
        <div className={s.gearHead}><h2>RODS &amp; KITS</h2><span>{gear.length} ITEMS</span></div>
        <div className={s.grid}>
          {gear.map((p) => (
            <article key={p.id} className={s.item}>
              <div className={s.itemTop}><h3>{p.name}</h3><span className={s.price}>€{p.price}</span></div>
              <p className={s.byline}>{p.byline}</p>
              <dl className={s.specs}>{p.specs.slice(0, 3).map((sp) => <div key={sp.label}><dt>{sp.label}</dt><dd>{sp.value}</dd></div>)}</dl>
            </article>
          ))}
        </div>
      </section>
      <footer className={s.footer}>RIFFLE &amp; CO. · KENDAL, CUMBRIA · DEMO STORE FOR CONCIERGE</footer>
      <script src="/agent.js" data-config={config} async />
    </div>
  );
}
