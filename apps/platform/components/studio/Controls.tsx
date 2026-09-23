"use client";
import { useEffect, useRef, useState, type Dispatch, type ReactNode } from "react";
import { googleFontUrl, type AgentConfig, type CardStyle, type Density, type Shape, type Voice } from "@concierge/agent/core";
import { FONT_CHOICES } from "@/lib/fonts";
import { normalizeHex } from "./hex";
import { avatarFromUrl, greetingFor, isDarkHex, type Action, type StudioState } from "./state";
import s from "./studio.module.css";

const VOICES: [Voice, string, string][] = [
  ["warm", "Warm", "“Lovely choice — here are three I'd happily recommend.”"],
  ["neutral", "Neutral", "“Here are three options that fit what you asked for.”"],
  ["terse", "Straight to it", "“3 matches. Sorted by fit.”"],
];
const FONT_URL_PREFIX = "https://fonts.googleapis.com/";

function Group({ title, children }: { title: string; children: ReactNode }) {
  return <fieldset className={s.group}><legend>{title}</legend>{children}</fieldset>;
}

/**
 * Controlled hex input backed by local draft state, so partial input while typing
 * doesn't get clobbered by the resync-from-config effect. Valid drafts patch the
 * config immediately (normalised); invalid/partial drafts just show a hint. The
 * draft resyncs from `value` whenever it changes elsewhere (swatches, colour
 * picker, surface toggle) as long as the field isn't focused.
 */
export function HexField({ id, label, description, value, allowClear, placeholder, onCommit }: {
  id: string;
  label: string;
  description?: string;
  value: string | undefined;
  allowClear: boolean;
  placeholder: string;
  onCommit: (v: string | undefined) => void;
}) {
  const [draft, setDraft] = useState(value ?? "");
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(value ?? "");
  }, [value]);

  const invalid = draft.trim() !== "" && normalizeHex(draft) === null;

  return (
    <>
      <label className={s.label} htmlFor={id}>{label}</label>
      {description && <p className={s.hint}>{description}</p>}
      <input
        id={id}
        className={s.input}
        value={draft}
        placeholder={placeholder}
        onFocus={() => { focused.current = true; }}
        onChange={(e) => {
          const v = e.target.value;
          setDraft(v);
          const normalized = normalizeHex(v);
          if (normalized) { onCommit(normalized); return; }
          if (v.trim() === "" && allowClear) onCommit(undefined);
        }}
        onBlur={() => {
          focused.current = false;
          const normalized = normalizeHex(draft);
          if (normalized) setDraft(normalized);
          else if (draft.trim() !== "") setDraft(value ?? "");
        }}
      />
      {invalid && <p className={s.hintWarn}>Use a hex code like #FFFFFF</p>}
    </>
  );
}

/** Controlled font-stylesheet URL input; only patches when the value is a valid Google Fonts URL. */
function FontUrlField({ value, onCommit }: { value: string | undefined; onCommit: (v: string | undefined) => void }) {
  const [draft, setDraft] = useState(value ?? "");
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(value ?? "");
  }, [value]);

  const invalid = draft.trim() !== "" && !draft.trim().startsWith(FONT_URL_PREFIX);

  return (
    <>
      <label className={s.label} htmlFor="fonturl">Custom font stylesheet URL</label>
      <input
        id="fonturl"
        className={s.input}
        value={draft}
        placeholder="https://fonts.googleapis.com/…"
        onFocus={() => { focused.current = true; }}
        onChange={(e) => {
          const v = e.target.value;
          setDraft(v);
          const t = v.trim();
          if (t === "") { onCommit(undefined); return; }
          if (t.startsWith(FONT_URL_PREFIX)) onCommit(t);
        }}
        onBlur={() => { focused.current = false; }}
      />
      {invalid && <p className={s.hintWarn}>Must be a Google Fonts stylesheet URL (https://fonts.googleapis.com/…)</p>}
    </>
  );
}

function Thumbs<T extends string>({ label, value, options, onChange, onFocus, render }: {
  label: string; value: T; options: [T, string][]; onChange: (v: T) => void; onFocus?: () => void; render: (v: T) => ReactNode;
}) {
  return (
    <div className={s.thumbs} role="radiogroup" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className={s.thumb} onClick={() => onChange(v)} onFocus={onFocus}>
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

  // The found logo is stored as avatarFromUrl(site.logo) (root-relative for our own demo assets), an uploaded one as its data URL
  const siteLogo = state.site.logo;
  const logoAvatar = avatarFromUrl(siteLogo) ?? (siteLogo?.startsWith("data:") ? siteLogo : undefined);
  const usingLogo = !!c.agent.avatar && (c.agent.avatar === logoAvatar || c.agent.avatar === siteLogo);
  const usingUpload = !!c.agent.avatar && !usingLogo;

  const setVoice = (voice: Voice) => {
    // Keep the greeting in step with the tone until the merchant writes their own
    const name = state.site.name;
    const isDefault = VOICES.some(([v]) => c.agent.greeting === greetingFor(name, v));
    patch({ voice, ...(isDefault ? { agent: { ...c.agent, greeting: greetingFor(name, voice) } } : {}) });
  };

  // Launcher controls switch the preview to Closed, so the merchant sees the launcher they're editing
  const showLauncher = () => { if (state.preview.open) dispatch({ type: "preview", patch: { open: false } }); };
  const patchLauncher = (p: Partial<AgentConfig["launcher"]>) => { showLauncher(); patch({ launcher: { ...c.launcher, ...p } }); };

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

        <label className={s.label}>Assistant background</label>
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
        <label className={s.label} htmlFor="subtitle">Subtitle (optional)</label>
        <input id="subtitle" className={s.input} value={c.agent.subtitle ?? ""} placeholder="e.g. Replies instantly"
          onChange={(e) => patch({ agent: { ...c.agent, subtitle: e.target.value || undefined } })} />
        <label className={s.label} htmlFor="greeting">Greeting</label>
        <textarea id="greeting" className={s.textarea} rows={3} value={c.agent.greeting} onChange={(e) => patch({ agent: { ...c.agent, greeting: e.target.value } })} />
        <label className={s.label}>Avatar</label>
        <div className={s.inlineRadios}>
          {logoAvatar && <label><input type="radio" name="avatar" checked={usingLogo} onChange={() => patch({ agent: { ...c.agent, avatar: logoAvatar } })} /> Your logo</label>}
          {usingUpload && <label><input type="radio" name="avatar" checked readOnly /> Uploaded logo</label>}
          <label><input type="radio" name="avatar" checked={!c.agent.avatar} onChange={() => patch({ agent: { ...c.agent, avatar: undefined } })} /> Initials</label>
        </div>
        <label className={s.label}>Tone of voice</label>
        <div className={s.voices} role="radiogroup" aria-label="Tone of voice">
          {VOICES.map(([v, label, sample]) => (
            <button key={v} type="button" role="radio" aria-checked={c.voice === v} className={s.voice} onClick={() => setVoice(v)}>
              <strong>{label}</strong><span>{sample}</span>
            </button>
          ))}
        </div>
      </Group>

      <Group title="Launcher">
        <label className={s.label} htmlFor="launcher">Label</label>
        <input id="launcher" className={s.input} value={c.launcher.label ?? ""} placeholder={c.agent.name} onFocus={showLauncher}
          onChange={(e) => patchLauncher({ label: e.target.value || undefined })} />
        <label className={s.label}>Position</label>
        <Thumbs<AgentConfig["launcher"]["position"]> label="Launcher position" value={c.launcher.position}
          options={[["bottom-right", "Bottom right"], ["bottom-left", "Bottom left"]]} onChange={(position) => patchLauncher({ position })} onFocus={showLauncher}
          render={(v) => <span className={s.artCorner} data-v={v}><i /></span>} />
        <label className={s.label}>Style</label>
        <Thumbs<"pill" | "icon"> label="Launcher style" value={c.launcher.style ?? "pill"}
          options={[["pill", "Pill with label"], ["icon", "Icon only"]]} onChange={(style) => patchLauncher({ style })} onFocus={showLauncher}
          render={(v) => <span className={s.artLauncher} data-v={v}><i />{v === "pill" && <b />}</span>} />
      </Group>

      <Group title="Products">
        <Thumbs<CardStyle> label="Product cards" value={c.cardStyle} options={[["visual", "Picture-led"], ["spec", "Spec-led"]]} onChange={(cardStyle) => patch({ cardStyle })}
          render={(v) => <span className={s.artCard} data-v={v}><i /><i /><i /></span>} />
      </Group>

      <details className={s.exact}>
        <summary>Exact values <span className={s.muted}>— hex codes, custom font</span></summary>
        <HexField id="hex" label="Brand hex" value={c.brand} allowClear={false} placeholder="e.g. #FFFFFF"
          onCommit={(v) => { if (v) patch({ brand: v }); }} />
        <HexField id="accent" label="Accent hex (optional)" value={c.accent} allowClear placeholder="e.g. #FFFFFF"
          description="Used for highlights like badges — leave blank to derive from your brand colour."
          onCommit={(v) => patch({ accent: v })} />
        <HexField id="bg" label="Background hex (optional)" value={c.background} allowClear placeholder="e.g. #FFFFFF"
          description="Your page/panel background, e.g. #FFFFFF for white — leave blank to derive."
          onCommit={(v) => patch({ background: v })} />
        <FontUrlField value={c.font.url} onCommit={(v) => patch({ font: { ...c.font, url: v } })} />
      </details>
    </div>
  );
}
