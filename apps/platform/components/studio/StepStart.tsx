"use client";
import { useEffect, useState, type Dispatch } from "react";
import { PRESETS, type PresetKey } from "@concierge/agent/core";
import type { Extraction } from "@/lib/extract";
import { paletteFromImage } from "@/lib/logoPalette";
import { configFromExtraction, configFromPalette, configFromPreset, type Action } from "./state";
import s from "./studio.module.css";

const PROGRESS = ["Reading your homepage", "Finding your colours", "Finding your fonts", "Looking for your logo"];

export function StepStart({ dispatch }: { dispatch: Dispatch<Action> }) {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<"idle" | "reading" | "found" | "weak" | "error">("idle");
  const [tick, setTick] = useState(0);
  const [error, setError] = useState("");
  const [ex, setEx] = useState<Extraction | null>(null);
  const [chosen, setChosen] = useState(0);
  const [logo, setLogo] = useState<{ colours: string[]; dataUrl: string; name: string } | null>(null);
  const [logoChosen, setLogoChosen] = useState(0);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  useEffect(() => {
    if (phase !== "reading") return;
    const t = setInterval(() => setTick((n) => Math.min(n + 1, PROGRESS.length - 1)), 650);
    return () => clearInterval(t);
  }, [phase]);

  async function read(target = url) {
    if (!target.trim()) return;
    setUrl(target); setPhase("reading"); setTick(0); setError(""); setEx(null);
    const res = await fetch("/api/extract", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: target }) });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setPhase("error"); return; }
    setEx(data); setChosen(0);
    setPhase(data.brand.length ? "found" : "weak");
  }

  function continueWithUrl() {
    if (!ex) return;
    const reordered = { ...ex, brand: [ex.brand[chosen]!, ...ex.brand.filter((_, i) => i !== chosen)] };
    const name = ex.name || new URL(ex.url).hostname;
    dispatch({ type: "start", source: "url", extraction: ex, config: configFromExtraction(reordered), candidates: ex.brand,
      site: { name, font: ex.fonts[0], fontUrl: ex.fontUrl, logo: ex.logo } });
  }

  async function onLogo(file: File | undefined) {
    if (!file) return;
    const { colours, dataUrl } = await paletteFromImage(file);
    const name = ex?.name || file.name.replace(/\.[a-z]+$/i, "").replace(/[-_]+/g, " ").replace(/\blogo\b/i, "").trim() || "Your store";
    setLogo({ colours, dataUrl, name }); setLogoChosen(0);
  }

  function continueWithLogo() {
    if (!logo) return;
    const ordered = [logo.colours[logoChosen]!, ...logo.colours.filter((_, i) => i !== logoChosen)].filter(Boolean);
    dispatch({ type: "start", source: "logo", config: configFromPalette(ordered, logo.dataUrl, logo.name),
      candidates: logo.colours.map((hex) => ({ hex, reason: "from your logo" })), site: { name: logo.name, logo: logo.dataUrl } });
  }

  function startFromPreset(key: PresetKey) {
    dispatch({ type: "start", source: "style", config: configFromPreset(key), candidates: [], site: { name: "Your store" } });
  }

  return (
    <main className={s.start}>
      <h1 className={s.h1}>Let's make your assistant look like your store.</h1>
      <p className={s.lede}>Start from your website and we'll pick up your colours, fonts and logo. You can fine-tune everything next — nothing goes live until you paste the snippet.</p>

      <form className={s.urlForm} onSubmit={(e) => { e.preventDefault(); read(); }}>
        <label htmlFor="url" className={s.srOnly}>Your store's web address</label>
        <input id="url" className={s.urlInput} placeholder="yourstore.com" value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" autoComplete="url" />
        <button className={s.primary} disabled={phase === "reading"}>{phase === "reading" ? "Reading…" : "Match my store"}</button>
      </form>
      {origin && (
        <p className={s.hint}>No site handy? Try a demo store: {" "}
          <button type="button" className={s.linkBtn} onClick={() => read(`${origin}/demo/books`)}>Marginalia (books)</button> ·{" "}
          <button type="button" className={s.linkBtn} onClick={() => read(`${origin}/demo/fishing`)}>Riffle &amp; Co. (fishing)</button>
        </p>
      )}

      {phase === "reading" && (
        <ul className={s.progress} aria-live="polite">
          {PROGRESS.map((p, i) => <li key={p} className={i < tick ? s.done : i === tick ? s.active : s.pending}>{i < tick ? "✓" : "·"} {p}…</li>)}
        </ul>
      )}

      {phase === "error" && <p className={s.notice} role="alert">{error}</p>}

      {phase === "weak" && ex && (
        <p className={s.notice} role="status">
          We could read {ex.name ?? "your site"}, but couldn't find clear brand colours — some stores load their design with scripts we can't see.
          Upload your logo below and we'll take your colours from that instead.
        </p>
      )}

      {phase === "found" && ex && (
        <section className={s.found} aria-label="What we found">
          <h2 className={s.h2}>Here's what we found on {ex.name ?? "your site"}</h2>
          <div className={s.foundGrid}>
            <div>
              <h3 className={s.h3}>Brand colour <span className={s.muted}>— tap to choose</span></h3>
              <div className={s.swatches} role="radiogroup" aria-label="Brand colour">
                {ex.brand.map((b, i) => (
                  <button key={b.hex} type="button" role="radio" aria-checked={chosen === i} className={s.swatchBtn} onClick={() => setChosen(i)}>
                    <span className={s.swatch} style={{ background: b.hex }} />
                    <span className={s.swatchHex}>{b.hex.toUpperCase()}</span>
                    <span className={s.swatchWhy}>{b.reason}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className={s.h3}>Font</h3>
              <p className={s.foundValue} style={{ fontFamily: ex.fonts[0] ? `"${ex.fonts[0]}"` : undefined }}>{ex.fonts[0] ?? "We'll use your site's own font"}</p>
              {ex.fontUrl && <link rel="stylesheet" href={ex.fontUrl} />}
              <h3 className={s.h3}>Logo</h3>
              {ex.logo ? <img src={ex.logo} alt="Your logo" className={s.foundLogo} /> : <p className={s.muted}>Not found — we'll use your initials.</p>}
              {ex.background && <><h3 className={s.h3}>Background</h3><p className={s.foundValue}><span className={s.miniSwatch} style={{ background: ex.background }} /> {ex.background.toUpperCase()}</p></>}
            </div>
          </div>
          <button type="button" className={s.primary} onClick={continueWithUrl}>Looks right — continue</button>
        </section>
      )}

      <div className={s.alternatives}>
        <section className={s.altCard}>
          <h2 className={s.h3}>Upload your logo</h2>
          <p className={s.muted}>We'll pull your brand colours out of it.</p>
          <label className={s.fileLabel}>
            <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={(e) => onLogo(e.target.files?.[0])} />
            Choose a file
          </label>
          {logo && (
            <div className={s.logoResult}>
              <img src={logo.dataUrl} alt="" className={s.foundLogo} />
              {logo.colours.length ? (
                <div className={s.swatches} role="radiogroup" aria-label="Brand colour from logo">
                  {logo.colours.map((hex, i) => (
                    <button key={hex} type="button" role="radio" aria-checked={logoChosen === i} className={s.swatchBtn} onClick={() => setLogoChosen(i)}>
                      <span className={s.swatch} style={{ background: hex }} /><span className={s.swatchHex}>{hex.toUpperCase()}</span>
                    </button>
                  ))}
                </div>
              ) : <p className={s.muted}>Your logo is black and white — we'll start in monochrome and you can pick a colour next.</p>}
              <button type="button" className={s.primary} onClick={continueWithLogo}>Continue with this</button>
            </div>
          )}
        </section>
        <section className={s.altCard}>
          <h2 className={s.h3}>Start from a style</h2>
          <p className={s.muted}>Pick the closest feel; adjust everything next.</p>
          <div className={s.presets}>
            {(Object.keys(PRESETS) as PresetKey[]).map((key) => {
              const p = PRESETS[key];
              return (
                <button key={key} type="button" className={s.preset} onClick={() => startFromPreset(key)}
                  style={{ background: p.config.background, color: p.config.surface === "dark" ? "#f2f2f0" : "#16161a", borderRadius: p.config.shape === "square" ? 2 : p.config.shape === "soft" ? 16 : 8 }}>
                  <span className={s.presetDot} style={{ background: p.config.brand }} />
                  <strong>{p.label}</strong>
                  <span>{p.description}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
