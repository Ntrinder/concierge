import { useState } from "preact/hooks";
import { CheckIcon } from "./icons";

export function NotifyForm({ done, onSubmit }: { done?: string; onSubmit: (email: string) => void }) {
  const [email, setEmail] = useState("");
  if (done) return <div class="added"><CheckIcon /> We'll email {done}</div>;
  return (
    <form class="notify" onSubmit={(e) => { e.preventDefault(); if (/^\S+@\S+\.\S+$/.test(email)) onSubmit(email); }}>
      <input type="email" required placeholder="you@example.com" aria-label="Email address" value={email} onInput={(e) => setEmail(e.currentTarget.value)} />
      <button type="submit" class="btn btn-primary t-btn">Notify me</button>
    </form>
  );
}
