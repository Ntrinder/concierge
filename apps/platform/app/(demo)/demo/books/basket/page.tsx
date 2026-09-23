import type { Metadata, Viewport } from "next";
import { CartBadge } from "@/components/CartBadge";
import { DemoBasket } from "@/components/DemoBasket";
import s from "../books.module.css";

export const metadata: Metadata = { title: "Your basket — Marginalia" };
export const viewport: Viewport = { themeColor: "#7A2E2E" };

export default async function BooksBasket({ searchParams }: { searchParams: Promise<{ config?: string }> }) {
  const { config = "marginalia" } = await searchParams;
  return (
    <div className={s.store}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Fraunces:opsz,wght@9..144,400..600&display=swap" />
      <header className={s.header}>
        <a href="/demo/books" className={s.brand}><img src="/demo/marginalia-logo.svg" alt="Marginalia logo" width={36} height={36} /><span>Marginalia</span></a>
        <nav className={s.nav}><a href="/demo/books#shelf">New in</a><a href="/demo/books#shelf">Fiction</a><a href="/demo/books#shelf">History</a><a href="/demo/books#shelf">Gifts</a></nav>
        <CartBadge className={s.cart} store="books" />
      </header>
      <DemoBasket
        store="books"
        backHref="/demo/books"
        classNames={{
          root: s.basket, heading: s.basketHeading, row: s.basketRow, rowName: s.basketRowName,
          rowOptions: s.basketRowOptions, rowPrice: s.basketRowPrice, total: s.basketTotal,
          empty: s.basketEmpty, note: s.basketNote, link: s.basketLink,
        }}
      />
      <footer className={s.footer}>Marginalia Books · 212 Leith Walk, Edinburgh · A demo store for Concierge</footer>
      <script src="/agent.js" data-config={config} async />
    </div>
  );
}
