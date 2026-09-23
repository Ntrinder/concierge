import { contrast, type AgentConfig } from "@concierge/agent/core";
import { isDarkHex, type SiteInfo } from "./state";
import s from "./studio.module.css";

const NEUTRAL = {
  light: { bg: "#ffffff", ink: "#1b1b1f", tile: "rgb(0 0 0 / .05)" },
  dark: { bg: "#121316", ink: "#f1f1ee", tile: "rgb(255 255 255 / .06)" },
};

/** White on the fill if it reads, else near-black — the same rule the agent uses for text on its brand. */
const onFill = (bg: string) => (contrast("#ffffff", bg) >= 4.5 ? "#ffffff" : "#141414");

/**
 * A stand-in for the merchant's homepage, composed from what extraction read (never a
 * screenshot, so it reflows to the phone frame). Every element falls back to a neutral
 * placeholder when its field is missing. Their own page colours are used only when the
 * preview's Light/Dark page matches their site; otherwise it's a neutral page of that tone.
 */
export function HomepageMock({ config, site, host, device }: { config: AgentConfig; site: SiteInfo; host: "light" | "dark"; device: "desktop" | "mobile" }) {
  const dark = host === "dark";
  // Their page, not the assistant: with no background read from their site it's a plain white page
  const siteDark = site.background ? isDarkHex(site.background) : false;
  const own = siteDark === dark;
  const neutral = dark ? NEUTRAL.dark : NEUTRAL.light;
  const bg = own ? site.background ?? neutral.bg : neutral.bg;
  const ink = own && site.background && site.text ? site.text : neutral.ink;
  const heading = site.headingFont ?? config.font.display;
  const headingStyle = {
    fontFamily: heading ? `"${heading}", inherit` : "inherit",
    textTransform: config.heading?.case === "uppercase" ? ("uppercase" as const) : undefined,
    letterSpacing: config.heading?.tracking ? `${config.heading.tracking}em` : undefined,
  };
  const btnBg = site.button?.bg ?? config.brand;
  const btnRadius = site.button?.radius ?? (config.shape === "square" ? 0 : config.shape === "soft" ? 999 : 8);
  const phone = device === "mobile";
  return (
    <div className={s.home} data-device={device} style={{ background: bg, color: ink, fontFamily: site.bodyFont ? `"${site.bodyFont}", inherit` : undefined }} aria-hidden="true">
      <div className={s.homeHeader}>
        {site.logo
          ? <img src={site.logo} alt="" className={s.homeLogo} />
          : <span className={s.homeMark} style={{ background: config.brand, color: onFill(config.brand), fontFamily: headingStyle.fontFamily }}>{site.name.trim().charAt(0).toUpperCase()}</span>}
        <span className={s.homeName} style={headingStyle}>{site.name}</span>
        {!phone && <span className={s.homeNav}>{(site.nav ?? ["Shop", "New in", "About"]).map((n) => <span key={n}>{n}</span>)}</span>}
        <span className={s.homeBasket}>Basket (0)</span>
      </div>
      <div className={s.homeHero}>
        {site.eyebrow && <div className={s.homeEyebrow} style={{ color: config.brand }}>{site.eyebrow}</div>}
        <div className={s.homeHeadline} style={headingStyle}>{site.headline ?? "New season, chosen with care"}</div>
        <div className={s.homeLine} style={{ background: neutral.tile, width: "70%" }} />
        <div className={s.homeLine} style={{ background: neutral.tile, width: "52%" }} />
        <span className={s.homeButton} style={{ background: btnBg, color: site.button?.color ?? onFill(btnBg), borderRadius: btnRadius }}>{site.button?.text ?? "Shop now"}</span>
      </div>
      <div className={s.homeGrid}>
        {(phone ? [0, 1] : [0, 1, 2, 3]).map((i) => <div key={i} className={s.homeTile} style={{ background: neutral.tile }} />)}
      </div>
      {/* Opposite corner to a bottom-left launcher so the two never overlap */}
      <span className={s.homeChip} data-side={config.launcher.position === "bottom-left" ? "right" : "left"}
        style={{ background: `color-mix(in srgb, ${bg} 90%, transparent)`, color: `color-mix(in srgb, ${ink} 65%, transparent)` }}>
        Preview on your homepage
      </span>
    </div>
  );
}
