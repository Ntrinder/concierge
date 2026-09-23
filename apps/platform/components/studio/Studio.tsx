"use client";
import { useReducer } from "react";
import { initialStudio, studioReducer } from "./state";
import { StepStart } from "./StepStart";
import s from "./studio.module.css";

const STEPS = ["Match your store", "Tune it", "Add it to your site"] as const;

export function Studio() {
  const [state, dispatch] = useReducer(studioReducer, initialStudio);
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
      {state.step === 1 && <StepStart dispatch={dispatch} />}
      {/* Task 13: step 2 — StepTune; Task 14: step 3 — StepInstall */}
    </div>
  );
}
