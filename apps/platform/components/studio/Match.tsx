"use client";
import { useState, type ReactNode } from "react";
import { contrast, googleFontUrl, type AgentConfig } from "@concierge/agent/core";
import { AgentPreview } from "@/components/AgentPreview";
import type { Extraction } from "@/lib/extract";
import { FONT_CHOICES } from "@/lib/fonts";
import { paletteFromImage } from "@/lib/logoPalette";
import { colourName } from "./colourNames";
import { HexField } from "./Controls";
import { HomepageMock } from "./HomepageMock";
import { avatarFromUrl, configFromExtraction, isDarkHex, type SiteInfo } from "./state";
import s from "./studio.module.css";

type Role = "brand" | "background" | "font" | "logo";

/** Extraction's candidate reasons, shortened to finish "…taken from {reason}". */
const REASON_SHORT: Record<string, string> = {
  "your site's theme colour": "your theme colour",
  "named as a brand colour in your CSS": "your CSS",
  "on your buttons": "your buttons",
  "on your links": "your links",
  "used across your site": "your site",
};
const OWN_FONT = "";
const same = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
const capitalise = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

function Check() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" /></svg>;
}

function RoleRow({ id, sample, title, line, open, onToggle, children }: {
  id: Role; sample: ReactNode; title: string; line: string; open: boolean; onToggle: () => void; children: ReactNode;
}) {
  return (
    <li className={s.role}>
      <div className={s.roleRow}>
        {sample}
        <div className={s.roleText}><span className={s.roleTitle}>{title}</span><span className={s.roleLine}>{line}</span></div>
        <button type="button" className={s.change} aria-expanded={open} aria-controls={`role-${id}`} onClick={onToggle}>{open ? "Done" : "Change"}</button>
      </div>
      {open && <div id={`role-${id}`} className={s.roleEditor}>{children}</div>}
    </li>
  );
}

/**
 * Step 1 after a successful read: what we matched, named in plain language, each role
 * editable in place, beside a live preview of the assistant on their homepage.
 */
export function Match({ ex, onContinue, onRetry, onAlt }: {
  ex: Extraction;
  onContinue: (config: AgentConfig, site: SiteInfo) => void;
  onRetry: () => void;
  onAlt: (card: "logo" | "style") => void;
}) {
  const [draft, setDraft] = useState<AgentConfig>(() => configFromExtraction(ex));
  const [open, setOpen] = useState<Role | null>(null);
  const [showExact, setShowExact] = useState(false);
  const [uploaded, setUploaded] = useState<string | null>(null);
  const [logoError, setLogoError] = useState("");
  const patch = (p: Partial<AgentConfig>) => setDraft((d) => ({ ...d, ...p }));

  const host = new URL(ex.url).hostname.replace(/^www\./, "");
  const name = ex.name || host;
  const site: SiteInfo = {
    name, font: ex.fonts[0], fontUrl: ex.fontUrl, logo: uploaded ?? ex.logo, nav: ex.nav, headline: ex.headline, eyebrow: ex.eyebrow,
    button: ex.button, background: ex.background, text: ex.text, headingFont: ex.headingFont, bodyFont: ex.bodyFont,
  };
  const siteHost = ex.background ? (isDarkHex(ex.background) ? "dark" : "light") : draft.surface;

  // Brand
  const brandCand = ex.brand.find((b) => same(b.hex, draft.brand));
  const brandLine = brandCand
    ? `Buttons, links and your chat bubbles, taken from ${REASON_SHORT[brandCand.reason] ?? brandCand.reason}`
    : "Buttons, links and your chat bubbles, in a colour you picked";

  // Background
  const bgOptions = [...new Set([ex.background, "#ffffff", ex.text && !isDarkHex(ex.text) ? ex.text : undefined]
    .filter((h): h is string => !!h).map((h) => h.toLowerCase()))];
  const plainBg = draft.surface === "dark" ? "#16161a" : "#ffffff";
  const bgMissing = !ex.background && !draft.background && draft.surface === "light";
  const bgTitle = draft.background ? colourName(draft.background) : bgMissing ? "Not found" : draft.surface === "dark" ? "Plain dark" : "Plain light";
  const bgLine = bgMissing ? "We'll use a light background — change it if that's wrong." : "The background of your pages";
  const setBackground = (hex: string) => patch({ background: hex, surface: isDarkHex(hex) ? "dark" : "light" });

  // Font
  const extractedFonts = [...new Set([ex.headingFont, ...ex.fonts].filter(Boolean) as string[])];
  const fontTitle = draft.font.display ?? "Your site's own font";
  const fontLine = draft.font.display
    ? extractedFonts.includes(draft.font.display) ? "Your site's font, loaded the same way your pages load it" : "A font you picked, loaded from Google Fonts"
    : extractedFonts.length ? "The assistant will inherit whatever your pages use." : "We couldn't name it, so the assistant will inherit whatever your pages use.";
  const setFont = (display: string) => {
    if (display === OWN_FONT) { patch({ font: { family: draft.font.family } }); return; }
    const url = extractedFonts.includes(display) && ex.fontUrl ? ex.fontUrl
      : googleFontUrl([draft.font.family !== "inherit" ? draft.font.family : "", display].filter(Boolean));
    patch({ font: { ...draft.font, display, url } });
  };

  // Logo — an uploaded logo replaces the found one as "my logo"
  const myLogo = uploaded ?? avatarFromUrl(ex.logo);
  const initial = name.trim().charAt(0).toUpperCase();
  const setAvatar = (avatar: string | undefined) => patch({ agent: { ...draft.agent, avatar } });
  async function onUpload(file: File | undefined) {
    if (!file) return;
    setLogoError("");
    try {
      const { dataUrl } = await paletteFromImage(file);
      setUploaded(dataUrl); setAvatar(dataUrl);
    } catch {
      setLogoError("We couldn't read that image. Try a PNG or JPG of your logo.");
    }
  }

  const toggle = (role: Role) => setOpen((o) => (o === role ? null : role));
  const others = ex.brand.filter((b) => !same(b.hex, draft.brand));
  const headline = `Here's your assistant, dressed like ${name.replace(/\.$/, "")}.`;

  return (
    <main className={s.match}>
      {ex.fontUrl && <link rel="stylesheet" href={ex.fontUrl} />}
      {draft.font.url && draft.font.url !== ex.fontUrl && <link rel="stylesheet" href={draft.font.url} />}
      <div className={s.matchLeft}>
        <div className={s.matchIntro}>
          <p className={s.matchOk}><Check />Read {host}
            <button type="button" className={s.linkBtn} onClick={onRetry}>Try another address</button>
          </p>
          <h1 className={s.matchH1}>{headline}</h1>
          <p className={s.matchLede}>Here's what we picked up. Change anything that's off. You can fine-tune the rest in the next step.</p>
        </div>

        <ul className={s.roles}>
          <RoleRow id="brand" open={open === "brand"} onToggle={() => toggle("brand")}
            sample={<span className={s.roleSample} style={{ background: draft.brand }} aria-hidden="true" />}
            title={colourName(draft.brand)} line={brandLine}>
            <div className={s.swatchRow} role="radiogroup" aria-label="Brand colour">
              {ex.brand.map((b) => (
                <button key={b.hex} type="button" role="radio" aria-checked={same(b.hex, draft.brand)} className={s.dot} style={{ background: b.hex }}
                  title={`${colourName(b.hex)}, ${b.hex.toUpperCase()}`} aria-label={`${colourName(b.hex)}, ${b.reason}`} onClick={() => patch({ brand: b.hex })} />
              ))}
              <label className={s.dotPicker} title="Pick any colour">
                <input type="color" value={draft.brand} onChange={(e) => patch({ brand: e.target.value })} aria-label="Pick any brand colour" />+
              </label>
            </div>
            <p className={s.editorCaption}>{brandCand ? capitalise(brandCand.reason) : "Your own pick"}</p>
            <HexField id="match-brand" label="Brand hex" value={draft.brand} allowClear={false} placeholder="e.g. #7A2E2E"
              onCommit={(v) => { if (v) patch({ brand: v }); }} />
          </RoleRow>

          <RoleRow id="background" open={open === "background"} onToggle={() => toggle("background")}
            sample={<span className={s.roleSample} style={{ background: draft.background ?? plainBg }} aria-hidden="true" />}
            title={bgTitle} line={bgLine}>
            <div className={s.swatchRow} role="radiogroup" aria-label="Background">
              {bgOptions.map((hex) => (
                <button key={hex} type="button" role="radio" aria-checked={same(hex, draft.background)} className={s.dot} style={{ background: hex }}
                  title={`${colourName(hex)}, ${hex.toUpperCase()}`} aria-label={colourName(hex)} onClick={() => setBackground(hex)} />
              ))}
            </div>
            <HexField id="match-bg" label="Background hex" value={draft.background} allowClear placeholder="e.g. #FFFFFF"
              onCommit={(v) => (v ? setBackground(v) : patch({ background: undefined }))} />
            <div className={s.inlineRadios}>
              <label><input type="radio" name="match-surface" checked={!draft.background && draft.surface === "light"} onChange={() => patch({ background: undefined, surface: "light" })} /> Use a light background</label>
              <label><input type="radio" name="match-surface" checked={!draft.background && draft.surface === "dark"} onChange={() => patch({ background: undefined, surface: "dark" })} /> Use a dark background</label>
            </div>
          </RoleRow>

          <RoleRow id="font" open={open === "font"} onToggle={() => toggle("font")}
            sample={<span className={`${s.roleSample} ${s.roleFont}`} style={{ fontFamily: draft.font.display ? `"${draft.font.display}", inherit` : undefined }} aria-hidden="true">Aa</span>}
            title={fontTitle} line={fontLine}>
            <label className={s.label} htmlFor="match-font">Font</label>
            <select id="match-font" className={s.select} value={draft.font.display ?? OWN_FONT} onChange={(e) => setFont(e.target.value)}>
              {extractedFonts.map((f) => <option key={f} value={f}>{f}</option>)}
              <option value={OWN_FONT}>Use my site's own font</option>
              {FONT_CHOICES.filter((f) => !extractedFonts.includes(f)).map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </RoleRow>

          <RoleRow id="logo" open={open === "logo"} onToggle={() => toggle("logo")}
            sample={draft.agent.avatar
              ? <img src={draft.agent.avatar} alt="" className={`${s.roleSample} ${s.roleLogo}`} />
              : <span className={`${s.roleSample} ${s.roleInitial}`} style={{ background: draft.brand, color: contrast("#ffffff", draft.brand) >= 4.5 ? "#ffffff" : "#141414", fontFamily: draft.font.display ? `"${draft.font.display}", inherit` : undefined }} aria-hidden="true">{initial}</span>}
            title={draft.agent.avatar ? "Your logo" : "Initials"} line="Used as the assistant's avatar">
            {myLogo && (
              <div className={s.inlineRadios}>
                <label><input type="radio" name="match-avatar" checked={draft.agent.avatar === myLogo} onChange={() => setAvatar(myLogo)} /> Use my logo</label>
                <label><input type="radio" name="match-avatar" checked={!draft.agent.avatar} onChange={() => setAvatar(undefined)} /> Use initials</label>
              </div>
            )}
            <label className={s.fileLabel}>
              <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={(e) => onUpload(e.target.files?.[0])} />
              Upload a different logo
            </label>
            {logoError && <p className={s.hintWarn} role="alert">{logoError}</p>}
          </RoleRow>
        </ul>

        {showExact && (
          <dl className={s.exactList} id="match-exact">
            <dt>Brand</dt><dd>{draft.brand.toUpperCase()}</dd>
            <dt>Background</dt><dd>{draft.background?.toUpperCase() ?? `none (${draft.surface})`}</dd>
            <dt>Text colour</dt><dd>{ex.text?.toUpperCase() ?? "not found"}</dd>
            <dt>Heading font</dt><dd>{draft.font.display ?? ex.headingFont ?? "not found"}</dd>
            <dt>Body font</dt><dd>{ex.bodyFont ?? ex.fonts[0] ?? "not found"}</dd>
            <dt>Logo URL</dt><dd>{uploaded ? "uploaded image" : ex.logo ?? "not found"}</dd>
            {others.length > 0 && <>
              <dt>Other colours we found</dt>
              <dd><ul className={s.otherColours}>
                {others.map((b) => <li key={b.hex}><span className={s.miniSwatch} style={{ background: b.hex }} />{b.hex.toUpperCase()} <span className={s.muted}>{b.reason}</span></li>)}
              </ul></dd>
            </>}
          </dl>
        )}

        <div className={s.matchActions}>
          <button type="button" className={`${s.primary} ${s.matchPrimary}`} onClick={() => onContinue(draft, site)}>Looks like us, continue</button>
          <button type="button" className={s.linkBtn} aria-expanded={showExact} aria-controls="match-exact" onClick={() => setShowExact((v) => !v)}>
            {showExact ? "Hide exact values" : "Show exact values"}
          </button>
        </div>
        <p className={s.muted}>No website yet? <button type="button" className={s.linkBtn} onClick={() => onAlt("logo")}>Upload a logo</button> or{" "}
          <button type="button" className={s.linkBtn} onClick={() => onAlt("style")}>start from a style</button>.</p>
      </div>

      <div className={s.matchPreview} style={{ fontFamily: site.font ? `"${site.font}", system-ui, sans-serif` : undefined }}>
        <HomepageMock config={draft} site={site} host={siteHost} device="desktop" />
        <div className={s.agentLayer}>
          <AgentPreview config={draft} autoplay={2} open />
        </div>
      </div>
    </main>
  );
}
