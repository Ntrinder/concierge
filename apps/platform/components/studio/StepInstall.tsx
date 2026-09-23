"use client";
import { useEffect, useRef, useState, type Dispatch, type FormEvent } from "react";
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

const DEMOS = [
  { store: "books", shop: "bookshop", products: "sample books" },
  { store: "fishing", shop: "outdoor shop", products: "sample fishing gear" },
] as const;

/** The demo that matches the products the assistant was tuned with comes first. */
function demoLinks(current: StudioState["config"]["store"]) {
  return [...DEMOS].sort((a, b) => Number(b.store === current) - Number(a.store === current)).map((d) => ({
    store: d.store,
    label: d.store === current ? `See it on the ${d.shop} demo (with ${d.products})` : `Or try it on the ${d.shop} demo (with ${d.products})`,
  }));
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** hostname + path (when the path isn't just "/"), for the check-my-site status lines. */
function hostLabel(rawUrl: string): string {
  try {
    const u = new URL(/^https?:\/\//.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
    return u.pathname !== "/" ? `${u.hostname}${u.pathname}` : u.hostname;
  } catch {
    return rawUrl;
  }
}

type CheckStatus = "idle" | "checking" | "live" | "other" | "missing" | "error";

export function StepInstall({ state, dispatch }: { state: StudioState; dispatch: Dispatch<Action> }) {
  const [status, setStatus] = useState<"saving" | "saved" | "error" | "forbidden">("saving");
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "fallback">("idle");
  const [tab, setTab] = useState<Tab>("any");
  const [origin, setOrigin] = useState("");
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState("");
  const [checkUrl, setCheckUrl] = useState(state.extraction?.url ?? "");
  const [checkStatus, setCheckStatus] = useState<CheckStatus>("idle");
  const [checkHost, setCheckHost] = useState("");
  const [checkFound, setCheckFound] = useState("");
  const [checkError, setCheckError] = useState("");

  const startedRef = useRef(false);
  const cancelledRef = useRef(false);
  const codeRef = useRef<HTMLElement>(null);

  // Saves the design: the first save mints an id + edit token; later saves send
  // the token back so they update the same id (and so the live snippet).
  function save(asNew = false) {
    setStatus("saving");
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (!asNew && state.editToken) headers["x-edit-token"] = state.editToken;
    if (asNew) dispatch({ type: "save-as-new" });
    fetch("/api/configs", { method: "POST", headers, body: JSON.stringify({ ...state.config, id: asNew ? "" : state.savedId ?? "" }) })
      .then(async (r) => {
        const data = await r.json().catch(() => ({ error: "Couldn't save — try again." }));
        if (cancelledRef.current) return;
        if (r.status === 403) { setError(data.error); setStatus("forbidden"); return; }
        if (!r.ok) { setError(data.error); setStatus("error"); return; }
        dispatch({ type: "saved", id: data.id, editToken: data.editToken });
        setStatus("saved");
      })
      .catch(() => { if (!cancelledRef.current) { setError("Couldn't save — check your connection and try again."); setStatus("error"); } });
  }

  useEffect(() => {
    setOrigin(window.location.origin);
    // React 19 StrictMode (dev) invokes this effect twice on mount, running
    // the cleanup in between. `startedRef` makes the POST fire once per mount,
    // so one visit never mints two saved configs; `cancelledRef` is reset on
    // every run, so it only suppresses the result if the step truly unmounted.
    cancelledRef.current = false;
    if (!startedRef.current) {
      startedRef.current = true;
      save();
    }
    return () => { cancelledRef.current = true; };
    // Save once per visit to this step
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const id = state.savedId;
  const snippet = id ? `<script src="${origin}/agent.js" data-config="${id}" async></script>` : "";

  function selectSnippetText() {
    const el = codeRef.current;
    if (!el || typeof window === "undefined") return;
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(snippet);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 2200);
    } catch {
      // Non-secure origin, permission denied, or no Clipboard API: select the
      // snippet text so the merchant can copy it with the keyboard instead of
      // the button silently doing nothing.
      selectSnippetText();
      setCopyStatus("fallback");
      setTimeout(() => setCopyStatus("idle"), 4000);
    }
  };
  function submitEmail(e: FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) return;
    setEmailSent(value);
  }

  function runCheck() {
    const host = hostLabel(checkUrl);
    setCheckHost(host);
    setCheckStatus("checking");
    fetch("/api/install-check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: checkUrl, id }) })
      .then(async (r) => {
        const data = await r.json().catch(() => ({ status: "error", error: "Something went wrong — try again." }));
        if (data.status === "live") { setCheckStatus("live"); return; }
        if (data.status === "other") { setCheckFound(data.found ?? ""); setCheckStatus("other"); return; }
        if (data.status === "missing") { setCheckStatus("missing"); return; }
        setCheckError(data.error ?? "Something went wrong — try again.");
        setCheckStatus("error");
      })
      .catch(() => { setCheckError("Something went wrong — check your connection and try again."); setCheckStatus("error"); });
  }

  const mail = `mailto:?subject=${encodeURIComponent(`Please add our shopping assistant to ${state.site.name}`)}&body=${encodeURIComponent(
    `Hi,\n\nCould you add this snippet just before the closing </body> tag on every page of our site?\n\n${snippet}\n\nIt loads asynchronously and won't affect page speed or styles (it renders inside its own Shadow DOM).\n\nThanks!`,
  )}`;

  return (
    <main className={s.install}>
      <h1 className={s.h1}>Add it to your site</h1>
      <p className={s.lede}>One line of code. Paste it once — any changes you save later update your site automatically.</p>

      {status === "saving" && <p className={s.muted} aria-live="polite">Saving your design…</p>}
      {status === "error" && <p className={s.notice} role="alert">{error} <button type="button" className={s.linkBtn} onClick={() => dispatch({ type: "step", step: 2 })}>Back to editing</button></p>}
      {status === "forbidden" && (
        <p className={s.notice} role="alert">{error} <button type="button" className={s.linkBtn} onClick={() => save(true)}>Save as a new design</button></p>
      )}

      {status === "saved" && id && (
        <>
          <div className={s.snippet}>
            {/* Each attribute is unbreakable, so the tag only wraps at the spaces between attributes */}
            <code ref={codeRef}>{snippet.split(" ").map((part, i) => <span key={i}>{i > 0 && " "}<span className={s.nowrap}>{part}</span></span>)}</code>
            <button type="button" className={s.primary} onClick={copy}>{copyStatus === "copied" ? "Copied ✓" : "Copy snippet"}</button>
          </div>
          <span className={s.srOnly} role="status" aria-live="polite">
            {copyStatus === "copied" && "Copied"}
            {copyStatus === "fallback" && "Couldn't copy automatically — the snippet is selected, press ⌘C or Ctrl+C to copy."}
          </span>
          {copyStatus === "fallback" && (
            <p className={s.notice} role="alert">Couldn't copy automatically — the snippet is selected, press ⌘C / Ctrl+C to copy.</p>
          )}
          <p className={s.designId}>Design ID: {id}</p>

          {emailSent ? (
            <p className={s.muted}>Demo: we'd email {emailSent} a link to edit design {id}. No email is sent and we don't keep your address.</p>
          ) : (
            <form className={s.emailForm} onSubmit={submitEmail}>
              <label className={s.label} htmlFor="studio-edit-email">Email me a link to edit this later</label>
              <div className={s.checkForm}>
                <input id="studio-edit-email" className={s.input} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourstore.com" />
                <button type="submit" className={s.primary}>Send link</button>
              </div>
            </form>
          )}

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
            <p className={s.muted}>Your design, embedded with this exact snippet on one of our demo stores. The assistant shows that store's sample products, not yours.</p>
            <ul className={s.demoLinks}>
              {demoLinks(state.config.store).map((d) => (
                <li key={d.store}>
                  <a className={s.linkBtn} href={`/demo/${d.store}?config=${id}`} target="_blank" rel="noreferrer">{d.label} ↗</a>
                </li>
              ))}
            </ul>
          </div>

          <div className={s.tryLive}>
            <h2 className={s.h3}>Check my site</h2>
            <form className={s.checkForm} onSubmit={(e) => { e.preventDefault(); runCheck(); }}>
              <input className={s.input} type="text" value={checkUrl} onChange={(e) => setCheckUrl(e.target.value)} placeholder="yourstore.com" disabled={checkStatus === "checking"} />
              <button type="submit" className={s.primary} disabled={checkStatus === "checking" || !checkUrl.trim()}>Check my site</button>
            </form>
            {checkStatus === "checking" && <p className={s.muted} aria-live="polite">Checking {checkHost}…</p>}
            {checkStatus === "live" && <p className={s.checkLive}>Live on {checkHost} ✓</p>}
            {checkStatus === "other" && (
              <p className={s.notice}>We found Concierge on {checkHost}, but with a different design ({checkFound}). Paste the snippet above to use this one.</p>
            )}
            {checkStatus === "missing" && (
              <p className={s.notice}>Not found yet — it can take a few minutes after publishing. <button type="button" className={s.linkBtn} onClick={runCheck}>Check again</button></p>
            )}
            {checkStatus === "error" && (
              <p className={s.notice} role="alert">{checkError} <button type="button" className={s.linkBtn} onClick={runCheck}>Check again</button></p>
            )}
          </div>

          <button type="button" className={s.secondary} onClick={() => dispatch({ type: "step", step: 2 })}>← Keep editing the design</button>
        </>
      )}
    </main>
  );
}
