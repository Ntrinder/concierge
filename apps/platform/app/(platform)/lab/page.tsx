"use client";
import { useState } from "react";
import { LAB_CONFIGS } from "@concierge/agent/core";
import { AgentPreview } from "@/components/AgentPreview";
import s from "./lab.module.css";

export default function Lab() {
  const [narrow, setNarrow] = useState(false);
  const [step, setStep] = useState(2);
  return (
    <main className={s.main}>
      <header className={s.head}>
        <div>
          <h1>Lab</h1>
          <p>One agent, one codebase, six brands. If any of these look broken, the token engine is wrong, not the config.</p>
        </div>
        <div className={s.controls}>
          <label><input type="checkbox" checked={narrow} onChange={(e) => setNarrow(e.target.checked)} /> 375px</label>
          <label>Conversation step <select value={step} onChange={(e) => setStep(Number(e.target.value))}>
            {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select></label>
        </div>
      </header>
      <div className={s.grid}>
        {LAB_CONFIGS.map((c) => (
          <figure key={c.id} className={s.cell}>
            <div className={s.frame} style={{ width: narrow ? 375 : 440, background: c.background ?? "#fff" }}>
              <AgentPreview config={c} autoplay={step} />
            </div>
            <figcaption><strong>{c.agent.name}</strong> · {c.brand} on {c.background ?? c.surface} · {c.shape} · {c.density} · {c.voice} · {c.cardStyle}</figcaption>
          </figure>
        ))}
      </div>
    </main>
  );
}
