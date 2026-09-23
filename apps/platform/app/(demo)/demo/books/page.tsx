import type { Metadata, Viewport } from "next";
import { CATALOGS, type Product } from "@concierge/agent/core";
import { CartBadge } from "@/components/CartBadge";
import s from "./books.module.css";

export const metadata: Metadata = { title: "Marginalia — independent booksellers, Edinburgh" };
export const viewport: Viewport = { themeColor: "#7A2E2E" };

function Cover({ p }: { p: Product }) {
  if (p.image.kind !== "cover") return null;
  return (
    <div className={s.cover} style={{ background: p.image.bg, color: p.image.fg }}>
      <span className={s.coverTitle}>{p.name}</span>
      <span className={s.coverAuthor}>{p.byline}</span>
    </div>
  );
}

export default async function BooksStore({ searchParams }: { searchParams: Promise<{ config?: string }> }) {
  const { config = "marginalia" } = await searchParams;
  const books = CATALOGS.books.filter((p) => p.attrs.addon !== true);
  return (
    <div className={s.store}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Fraunces:opsz,wght@9..144,400..600&display=swap" />
      <header className={s.header}>
        <a href="#" className={s.brand}><img src="/demo/marginalia-logo.svg" alt="Marginalia logo" width={36} height={36} /><span>Marginalia</span></a>
        <nav className={s.nav}><a href="#">New in</a><a href="#">Fiction</a><a href="#">History</a><a href="#">Gifts</a></nav>
        <CartBadge className={s.cart} store="books" />
      </header>
      <section className={s.hero}>
        <p className={s.eyebrow}>Autumn, chosen by people who read</p>
        <h1>Books for the long evenings</h1>
        <p className={s.lede}>An independent bookshop on the corner of Leith Walk since 1987. Every book on this page has been read by someone who works here.</p>
        <a href="#shelf" className={s.button}>Browse the shelf</a>
      </section>
      <section id="shelf" className={s.shelf}>
        <h2>On the front table</h2>
        <div className={s.grid}>
          {books.slice(0, 12).map((p) => (
            <article key={p.id} className={s.item}>
              <Cover p={p} />
              <h3>{p.name}</h3>
              <p className={s.author}>{p.byline}</p>
              <p className={s.price}>€{p.price.toFixed(2)}</p>
            </article>
          ))}
        </div>
      </section>
      <footer className={s.footer}>Marginalia Books · 212 Leith Walk, Edinburgh · A demo store for Concierge</footer>
      <script src="/agent.js" data-config={config} async />
    </div>
  );
}
