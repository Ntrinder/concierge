"use client";
import type { Dispatch } from "react";
import { AgentPreview } from "@/components/AgentPreview";
import { HomepageMock } from "./HomepageMock";
import type { Action, StudioState } from "./state";
import s from "./studio.module.css";

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className={s.segmented} role="radiogroup" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}>{text}</button>
      ))}
    </div>
  );
}

export function Preview({ state, dispatch }: { state: StudioState; dispatch: Dispatch<Action> }) {
  const { preview, config, site } = state;
  const siteFont = site.font ? `"${site.font}", system-ui, sans-serif` : "system-ui, sans-serif";
  const setPreview = (patch: Partial<StudioState["preview"]>) => dispatch({ type: "preview", patch });
  return (
    <section className={s.previewCol} aria-label="Preview">
      <div className={s.toolbar}>
        <Segmented label="Device" value={preview.device} options={[["desktop", "Desktop"], ["mobile", "Phone"]]} onChange={(device) => setPreview({ device })} />
        <Segmented label="Assistant" value={preview.open ? "open" : "closed"} options={[["open", "Open"], ["closed", "Closed"]]} onChange={(v) => setPreview({ open: v === "open" })} />
        <Segmented label="Page" value={preview.host} options={[["light", "Light page"], ["dark", "Dark page"]]} onChange={(host) => setPreview({ host })} />
      </div>
      {site.fontUrl && <link rel="stylesheet" href={site.fontUrl} />}
      <div className={s.stageWrap}>
        <div className={preview.device === "mobile" ? s.stagePhone : s.stageDesktop} style={{ fontFamily: siteFont }}>
          <HomepageMock config={config} site={site} host={preview.host} device={preview.device} />
          <div className={s.agentLayer}>
            <AgentPreview config={config} autoplay={2} open={preview.open} highlight={state.highlight} />
          </div>
        </div>
      </div>
      <p className={s.previewNote}>This is a mock of your page with a sample conversation, so you can judge the fit before anything goes live.</p>
    </section>
  );
}
