"use client";
import { useEffect, useReducer, useState } from "react";
import { clearPersisted, initialStudio, loadPersisted, persist, studioReducer, type PersistedStudio } from "./state";
import { StepStart } from "./StepStart";
import { StepTune } from "./StepTune";
import { StepInstall } from "./StepInstall";
import s from "./studio.module.css";

const STEPS = ["Match your store", "Tune it", "Add it to your site"] as const;

export function Studio() {
  const [state, dispatch] = useReducer(studioReducer, initialStudio);
  // Offer (not force) the design from a previous visit; read after mount so SSR markup matches
  const [resumable, setResumable] = useState<PersistedStudio | null>(null);
  useEffect(() => setResumable(loadPersisted()), []);
  useEffect(() => { if (state.source) persist(state); }, [state]);
  return (
    <div className={s.app}>
      <header className={s.topbar}>
        <span className={s.logo}><span className={s.logoMark} aria-hidden="true" />Concierge</span>
        <ol className={s.steps} aria-label="Progress">
          {STEPS.map((label, i) => {
            const n = (i + 1) as 1 | 2 | 3;
            const reachable = n === 1 || (state.source !== undefined && (n < 3 || state.step >= 2));
            return (
              <li key={label} aria-current={state.step === n ? "step" : undefined} className={state.step === n ? s.stepActive : state.step > n ? s.stepDone : undefined}>
                <button type="button" disabled={!reachable} onClick={() => dispatch({ type: "step", step: n })}>
                  <span className={s.stepNum}>{state.step > n ? "✓" : n}</span>{label}
                </button>
              </li>
            );
          })}
        </ol>
        <a className={s.toplink} href="/lab">Lab</a>
      </header>
      {state.step === 1 && resumable && !state.source && (
        <div className={s.resume} role="region" aria-label="Design in progress">
          <p>You have a design in progress for <strong>{resumable.site.name}</strong>{resumable.savedId ? " (already saved — edits update your live snippet)" : ""}.</p>
          <button type="button" className={s.primary} onClick={() => dispatch({ type: "restore", saved: resumable })}>Continue editing {resumable.site.name}</button>
          <button type="button" className={s.linkBtn} onClick={() => { clearPersisted(); setResumable(null); }}>Start fresh</button>
        </div>
      )}
      {state.step === 1 && <StepStart dispatch={dispatch} />}
      {state.step === 2 && <StepTune state={state} dispatch={dispatch} />}
      {state.step === 3 && <StepInstall state={state} dispatch={dispatch} />}
    </div>
  );
}
