"use client";
import { useMemo, type Dispatch } from "react";
import { deriveTokens } from "@concierge/agent/core";
import type { Action, StudioState } from "./state";
import s from "./studio.module.css";

const HIGHLIGHT: Record<string, string> = { "--c-link": "link", "--c-brand-edge": "btn", "--c-on-brand": "btn" };

export function FitCheck({ state, dispatch }: { state: StudioState; dispatch: Dispatch<Action> }) {
  const { adjustments } = useMemo(() => deriveTokens(state.config), [state.config]);
  const fontNote = state.site.font && !state.site.fontUrl && state.config.font.family === "inherit";
  const ok = adjustments.length === 0 && !fontNote;
  return (
    <div className={ok ? s.fitOk : s.fitNotes} role="status" aria-live="polite">
      {ok ? (
        <p><strong>✓ Looks right.</strong> Every colour pairing is readable and on-brand.</p>
      ) : (
        <>
          <p><strong>We've adjusted {adjustments.length === 1 ? "one thing" : `${adjustments.length} things`} so it stays readable</strong> — your colours are kept, just shaded where needed.</p>
          <ul>
            {adjustments.map((a) => {
              const key = HIGHLIGHT[a.token];
              const active = state.highlight === key;
              return (
                <li key={a.token}>
                  <span className={s.fitSwatches}><span style={{ background: a.from }} />→<span style={{ background: a.to }} /></span>
                  <span>{a.reason}</span>
                  {key && <button type="button" className={s.linkBtn} onClick={() => dispatch({ type: "highlight", token: active ? null : key })}>{active ? "Hide" : "Show me"}</button>}
                </li>
              );
            })}
            {fontNote && <li><span>Preview uses a stand-in for <strong>{state.site.font}</strong>. On your site, the assistant uses your real font.</span></li>}
          </ul>
        </>
      )}
    </div>
  );
}
