import { SystemBrand } from './SystemBrand';

export function SplashScreen() {
  return (
    <div className="splash-screen" role="status" aria-live="polite" aria-label="Loading campus workspace">
      <div className="splash-accent splash-accent-one" aria-hidden="true" />
      <div className="splash-accent splash-accent-two" aria-hidden="true" />
      <div className="splash-content">
        <SystemBrand subtitle="" />
        <span className="splash-subtitle">University Lab & Equipment Booking System</span>
        <div className="splash-progress" aria-hidden="true"><span /></div>
      </div>
    </div>
  );
}
