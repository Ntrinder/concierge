"use client";
import { useEffect, useRef, useState, type Dispatch } from "react";
import type { Action, StudioState } from "./state";
import s from "./studio.module.css";

type Tab = "any" | "shopify" | "squarespace" | "wordpress" | "dev";
const TABS: [Tab, string][] = [["any", "Any website"], ["shopify", "Shopify"], ["squarespace", "Squarespace"], ["wordpress", "WordPress"], ["dev", "Send to my developer"]];
const STEPS: Record<Exclude<Tab, "dev">, string[]> = {
  any: ["Copy the snippet.", "Paste it just before the closing </body> tag on every page where you want the assistant.", "Publish. That's it."],
  shopify: ["In Shopify admin, go to Online Store → Themes.", "Click ⋯ → Edit code, and open layout/theme.liquid.", "Paste the snippet just above </body>, then Save."],
  squarespace: ["Go to Settings → Advanced → Code Injection.", "Paste the snippet into the Footer box.", "Save."],
  wordpress: ["Install a code-snippets plugin such as WPCode.", "Add Snippet → HTML snippet, and paste the code.", "Set location to “Site Wide Footer”, then activate."],
};

export function StepInstall({ state, dispatch }: { state: StudioState; dispatch: Dispatch<Action> }) {
  const [status, setStatus] = useState<"saving" | "saved" | "error">("saving");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<Tab>("any");
  const [origin, setOrigin] = useState("");

  const startedRef = useRef(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    // React 19 StrictMode (dev) invokes this effect twice on mount, running
    // the cleanup in between. A `startedRef` guard ensures the POST itself
    // only ever fires once per mount, so we never mint two saved configs
    // for one visit to this step. `cancelledRef` (rather than a plain local
    // `cancelled` var) is reset to false at the top of every effect run, so
    // if the component is genuinely still mounted when the in-flight
    // request resolves (i.e. the StrictMode remount happened), the result
    // is still applied; it only stays true — suppressing the dispatch — if
    // the component actually unmounted (e.g. navigating back to step 2)
    // without a subsequent effect run to reset it.
    cancelledRef.current = false;
    if (!startedRef.current) {
      startedRef.current = true;
      fetch("/api/configs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...state.config, id: state.savedId ?? "" }) })
        .then(async (r) => {
          const data = await r.json();
          if (cancelledRef.current) return;
          if (!r.ok) { setError(data.error); setStatus("error"); return; }
          dispatch({ type: "saved", id: data.id });
          setStatus("saved");
        })
        .catch(() => { if (!cancelledRef.current) { setError("Couldn't save — check your connection and try again."); setStatus("error"); } });
    }
    return () => { cancelledRef.current = true; };
    // Save once per visit to this step
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const id = state.savedId;
  const snippet = id ? `<script src="${origin}/agent.js" data-config="${id}" async></script>` : "";
  const copy = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };
  const mail = `mailto:?subject=${encodeURIComponent(`Please add our shopping assistant to ${state.site.name}`)}&body=${encodeURIComponent(
    `Hi,\n\nCould you add this snippet just before the closing </body> tag on every page of our site?\n\n${snippet}\n\nIt loads asynchronously and won't affect page speed or styles (it renders inside its own Shadow DOM).\n\nThanks!`,
  )}`;

  return (
    <main className={s.install}>
      <h1 className={s.h1}>Add it to your site</h1>
      <p className={s.lede}>One line of code. Any changes you make in Concierge later update your site automatically — no need to paste it again.</p>

      {status === "saving" && <p className={s.muted} aria-live="polite">Saving your design…</p>}
      {status === "error" && <p className={s.notice} role="alert">{error} <button type="button" className={s.linkBtn} onClick={() => dispatch({ type: "step", step: 2 })}>Back to editing</button></p>}

      {status === "saved" && id && (
        <>
          <div className={s.snippet}>
            <code>{snippet}</code>
            <button type="button" className={s.primary} onClick={copy} aria-live="polite">{copied ? "Copied ✓" : "Copy snippet"}</button>
          </div>

          <div className={s.tabs} role="tablist" aria-label="Where is your store?">
            {TABS.map(([t, label]) => (
              <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => setTab(t)}>{label}</button>
            ))}
          </div>
          <div className={s.tabPanel} role="tabpanel">
            {tab === "dev" ? (
              <p>We'll write the email for you — it includes the snippet and a note that it won't touch their styles. <a className={s.linkBtn} href={mail}>Open email draft</a></p>
            ) : (
              <ol>{STEPS[tab].map((step) => <li key={step}>{step}</li>)}</ol>
            )}
          </div>

          <div className={s.tryLive}>
            <h2 className={s.h3}>See it on a real page first</h2>
            <p className={s.muted}>Your design, embedded with this exact snippet on our demo stores:</p>
            <p>
              <a className={s.linkBtn} href={`/demo/books?config=${id}`} target="_blank" rel="noreferrer">Bookshop demo ↗</a>{"  ·  "}
              <a className={s.linkBtn} href={`/demo/fishing?config=${id}`} target="_blank" rel="noreferrer">Outdoor demo ↗</a>
            </p>
          </div>
          <button type="button" className={s.secondary} onClick={() => dispatch({ type: "step", step: 2 })}>← Keep editing the design</button>
        </>
      )}
    </main>
  );
}
