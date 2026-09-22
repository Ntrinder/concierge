import { useEffect, useState } from "preact/hooks";

export function useCompact(host: HTMLElement, inline: boolean): boolean {
  const measure = () => (inline ? host.getBoundingClientRect().width : window.innerWidth) <= 480;
  const [compact, setCompact] = useState(measure);
  useEffect(() => {
    const update = () => setCompact(measure());
    update();
    if (inline) {
      const ro = new ResizeObserver(update);
      ro.observe(host);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [host, inline]);
  return compact;
}
