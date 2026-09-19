export default function Loading() {
  return (
    <div className="route-loading" aria-busy="true" aria-label="Loading dashboard">
      <div className="route-loading-side" />
      <div className="route-loading-main">
        <div className="skeleton skeleton-hero" />
        <div className="skeleton skeleton-sub" />
        <div className="skeleton skeleton-banner" />
        <div className="skeleton-grid">
          <div className="skeleton skeleton-panel" />
          <div className="skeleton skeleton-panel" />
          <div className="skeleton skeleton-panel" />
          <div className="skeleton skeleton-panel" />
          <div className="skeleton skeleton-panel" />
        </div>
      </div>
    </div>
  );
}
