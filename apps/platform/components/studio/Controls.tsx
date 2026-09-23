"use client";
import type { Dispatch, FocusEvent, ReactNode } from "react";
import { googleFontUrl, type AgentConfig, type CardStyle, type Density, type Shape, type Voice } from "@concierge/agent/core";
import { FONT_CHOICES } from "@/lib/fonts";
import { isDarkHex, type Action, type StudioState } from "./state";
import s from "./studio.module.css";

const VOICES: [Voice, string, string][] = [
  ["warm", "Warm", "“Lovely choice — here are three I'd happily recommend.”"],
  ["neutral", "Neutral", "“Here are three options that fit what you asked for.”"],
  ["terse", "Straight to it", "“3 matches. Sorted by fit.”"],
];
const HEX = /^#[0-9a-f]{6}$/i;

function Group({ title, children }: { title: string; children: ReactNode }) {
  return <fieldset className={s.group}><legend>{title}</legend>{children}</fieldset>;
}

function Thumbs<T extends string>({ label, value, options, onChange, render }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void; render: (v: T) => ReactNode }) {
  return (
    <div className={s.thumbs} role="radiogroup" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className={s.thumb} onClick={() => onChange(v)}>
          <span className={s.thumbArt} aria-hidden="true">{render(v)}</span>{text}
        </button>
      ))}
    </div>
  );
}

export function Controls({ state, dispatch }: { state: StudioState; dispatch: Dispatch<Action> }) {
  const c = state.config;
  const patch = (p: Partial<AgentConfig>) => dispatch({ type: "patch", patch: p });
  const setFont = (family: string, display?: string) => {
    const families = [family !== "inherit" ? family : "", display ?? ""].filter(Boolean);
    patch({ font: { family, ...(display ? { display } : {}), ...(families.length ? { url: googleFontUrl(families) } : {}) } });
  };
  const candidates = state.candidates.length ? state.candidates : [{ hex: c.brand, reason: "current" }];

  // Hex-field blur rule: trimmed empty -> clear (revert to derived), if clearing is allowed;
  // valid 6-digit hex -> set; anything else -> no-op, and reset the field's displayed text
  // back to the current value (the input is uncontrolled, so an unchanged value wouldn't
  // otherwise force a re-render that resets it).
  const hexBlur = (current: string | undefined, allowClear: boolean, onSet: (v: string | undefined) => void) =>
    (e: FocusEvent<HTMLInputElement>) => {
      const v = e.target.value.trim();
      if (v === "") {
        if (allowClear) onSet(undefined);
        else e.target.value = current ?? "";
        return;
      }
      if (HEX.test(v)) { onSet(v); return; }
      e.target.value = current ?? "";
    };

  return (
    <div className={s.controls}>
      <Group title="Look">
        <label className={s.label}>Brand colour</label>
        <div className={s.swatchRow}>
          {candidates.map((cand) => (
            <button key={cand.hex} type="button" title={`${cand.hex.toUpperCase()} — ${cand.reason}`} aria-label={`Use ${cand.hex}, ${cand.reason}`}
              aria-pressed={c.brand.toLowerCase() === cand.hex.toLowerCase()} className={s.dot} style={{ background: cand.hex }} onClick={() => patch({ brand: cand.hex })} />
          ))}
          <label className={s.dotPicker} title="Pick any colour">
            <input type="color" value={c.brand} onChange={(e) => patch({ brand: e.target.value })} aria-label="Pick any brand colour" />+
          </label>
        </div>

        <label className={s.label} htmlFor="font">Text font</label>
        <select id="font" className={s.select} value={c.font.family} onChange={(e) => setFont(e.target.value, c.font.display)}>
          <option value="inherit">Use my site's font{state.site.font ? ` (${state.site.font})` : ""} — recommended</option>
          {FONT_CHOICES.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <label className={s.label} htmlFor="display">Heading font</label>
        <select id="display" className={s.select} value={c.font.display ?? ""} onChange={(e) => setFont(c.font.family, e.target.value || undefined)}>
          <option value="">Same as text</option>
          {[...new Set([state.site.font, ...FONT_CHOICES].filter(Boolean) as string[])].map((f) => <option key={f} value={f}>{f}</option>)}
        </select>

        <label className={s.label}>Page</label>
        <Thumbs<"light" | "dark"> label="Surface" value={c.surface} options={[["light", "Light"], ["dark", "Dark"]]}
          onChange={(surface) => {
            // Switching surface drops a background that belonged to the other surface; switching back restores the extracted one
            const extractedBg = state.extraction?.background;
            const extractedSurface = extractedBg ? (isDarkHex(extractedBg) ? "dark" : "light") : null;
            patch({ surface, background: extractedBg && surface === extractedSurface ? extractedBg : undefined });
          }}
          render={(v) => <span className={s.artSurface} data-v={v} />} />

        <label className={s.label}>Corners</label>
        <Thumbs<Shape> label="Corners" value={c.shape} options={[["square", "Square"], ["rounded", "Rounded"], ["soft", "Soft"]]} onChange={(shape) => patch({ shape })}
          render={(v) => <span className={s.artShape} style={{ borderRadius: v === "square" ? 1 : v === "rounded" ? 6 : 14 }} />} />

        <label className={s.label}>Spacing</label>
        <Thumbs<Density> label="Spacing" value={c.density} options={[["compact", "Compact"], ["regular", "Regular"], ["airy", "Airy"]]} onChange={(density) => patch({ density })}
          render={(v) => <span className={s.artDensity} data-v={v}><i /><i /><i /></span>} />
      </Group>

      <Group title="Personality">
        <label className={s.label} htmlFor="name">Assistant name</label>
        <input id="name" className={s.input} value={c.agent.name} onChange={(e) => patch({ agent: { ...c.agent, name: e.target.value } })} />
        <label className={s.label} htmlFor="greeting">Greeting</label>
        <textarea id="greeting" className={s.textarea} rows={3} value={c.agent.greeting} onChange={(e) => patch({ agent: { ...c.agent, greeting: e.target.value } })} />
        <label className={s.label}>Avatar</label>
        <div className={s.inlineRadios}>
          {state.site.logo && <label><input type="radio" checked={c.agent.avatar === state.site.logo} onChange={() => patch({ agent: { ...c.agent, avatar: state.site.logo } })} /> Your logo</label>}
          <label><input type="radio" checked={!c.agent.avatar} onChange={() => patch({ agent: { ...c.agent, avatar: undefined } })} /> Initials</label>
        </div>
        <label className={s.label}>Tone of voice</label>
        <div className={s.voices} role="radiogroup" aria-label="Tone of voice">
          {VOICES.map(([v, label, sample]) => (
            <button key={v} type="button" role="radio" aria-checked={c.voice === v} className={s.voice} onClick={() => patch({ voice: v })}>
              <strong>{label}</strong><span>{sample}</span>
            </button>
          ))}
        </div>
      </Group>

      <Group title="Products">
        <Thumbs<CardStyle> label="Product cards" value={c.cardStyle} options={[["visual", "Picture-led"], ["spec", "Spec-led"]]} onChange={(cardStyle) => patch({ cardStyle })}
          render={(v) => <span className={s.artCard} data-v={v}><i /><i /><i /></span>} />
      </Group>

      <details className={s.exact}>
        <summary>Exact values <span className={s.muted}>— hex codes, custom font, launcher</span></summary>
        <label className={s.label} htmlFor="hex">Brand hex</label>
        <input id="hex" className={s.input} defaultValue={c.brand} key={c.brand}
          onBlur={hexBlur(c.brand, false, (v) => v && patch({ brand: v }))} />
        <label className={s.label} htmlFor="accent">Accent hex (optional)</label>
        <input id="accent" className={s.input} defaultValue={c.accent ?? ""} key={c.accent ?? ""} placeholder="Derived from brand"
          onBlur={hexBlur(c.accent, true, (v) => patch({ accent: v }))} />
        <label className={s.label} htmlFor="bg">Background hex (optional)</label>
        <input id="bg" className={s.input} defaultValue={c.background ?? ""} key={c.background ?? ""} placeholder="Derived from brand"
          onBlur={hexBlur(c.background, true, (v) => patch({ background: v }))} />
        <label className={s.label} htmlFor="fonturl">Custom font stylesheet URL</label>
        <input id="fonturl" className={s.input} defaultValue={c.font.url ?? ""} key={c.font.url ?? ""} placeholder="https://fonts.googleapis.com/…" onBlur={(e) => patch({ font: { ...c.font, url: e.target.value || undefined } })} />
        <label className={s.label}>Launcher position</label>
        <div className={s.inlineRadios}>
          <label><input type="radio" checked={c.launcher.position === "bottom-right"} onChange={() => patch({ launcher: { ...c.launcher, position: "bottom-right" } })} /> Bottom right</label>
          <label><input type="radio" checked={c.launcher.position === "bottom-left"} onChange={() => patch({ launcher: { ...c.launcher, position: "bottom-left" } })} /> Bottom left</label>
        </div>
        <label className={s.label} htmlFor="launcher">Launcher label</label>
        <input id="launcher" className={s.input} value={c.launcher.label ?? ""} placeholder={c.agent.name} onChange={(e) => patch({ launcher: { ...c.launcher, label: e.target.value || undefined } })} />
      </details>
    </div>
  );
}
