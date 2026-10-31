import "./SiteBackground.css";

/** Decorative, fixed backdrop behind every page (aurora, dot grid, scan band, grain, vignette). */
export function SiteBackground() {
  return (
    <div aria-hidden="true" className="site-bg">
      <div className="site-bg__aurora site-bg__aurora--blue" />
      <div className="site-bg__aurora site-bg__aurora--cyan" />
      <div className="site-bg__aurora site-bg__aurora--indigo" />
      <div className="site-bg__grid" />
      <div className="site-bg__scan" />
      <div className="site-bg__grain" />
      <div className="site-bg__vignette" />
    </div>
  );
}
