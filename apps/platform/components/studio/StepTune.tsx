"use client";
import type { Dispatch } from "react";
import { Controls } from "./Controls";
import { FitCheck } from "./FitCheck";
import { Preview } from "./Preview";
import type { Action, StudioState } from "./state";
import s from "./studio.module.css";

export function StepTune({ state, dispatch }: { state: StudioState; dispatch: Dispatch<Action> }) {
  return (
    <main className={s.tune}>
      <Preview state={state} dispatch={dispatch} />
      <aside className={s.side}>
        <div className={s.sideScroll}>
          <h1 className={s.h2}>Tune it</h1>
          <p className={s.muted}>Changes show instantly on the left.</p>
          <Controls state={state} dispatch={dispatch} />
        </div>
        <div className={s.sideFoot}>
          <FitCheck state={state} dispatch={dispatch} />
          <button type="button" className={s.primary} onClick={() => dispatch({ type: "step", step: 3 })}>Looks right — get my snippet</button>
        </div>
      </aside>
    </main>
  );
}
