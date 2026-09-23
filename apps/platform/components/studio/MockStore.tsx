import type { AgentConfig } from "@concierge/agent/core";
import s from "./studio.module.css";

export function MockStore({ config, site, host }: { config: AgentConfig; site: { name: string; logo?: string }; host: "light" | "dark" }) {
  const dark = host === "dark";
  const matchesSurface = (config.surface === "dark") === dark;
  const bg = matchesSurface && config.background ? config.background : dark ? "#121316" : "#ffffff";
  const ink = dark ? "#f1f1ee" : "#1b1b1f";
  const tile = dark ? "rgb(255 255 255 / .06)" : "rgb(0 0 0 / .05)";
  const display = config.font.display ? `"${config.font.display}", inherit` : "inherit";
  return (
    <div className={s.mock} style={{ background: bg, color: ink }} aria-hidden="true">
      <div className={s.mockHeader}>
        {site.logo ? <img src={site.logo} alt="" className={s.mockLogo} /> : <span className={s.mockLogoText} style={{ fontFamily: display }}>{site.name}</span>}
        <span className={s.mockNav}><span>Shop</span><span>New in</span><span>About</span></span>
        <span className={s.mockCart}>Basket (0)</span>
      </div>
      <div className={s.mockHero}>
        <div className={s.mockHeadline} style={{ fontFamily: display }}>New season, chosen with care</div>
        <div className={s.mockLine} style={{ background: tile, width: "70%" }} />
        <div className={s.mockLine} style={{ background: tile, width: "52%" }} />
        <span className={s.mockButton} style={{ background: config.brand, borderRadius: config.shape === "square" ? 0 : config.shape === "soft" ? 999 : 8 }} />
      </div>
      <div className={s.mockGrid}>
        {[0, 1, 2, 3].map((i) => <div key={i} className={s.mockTile} style={{ background: tile }} />)}
      </div>
    </div>
  );
}
