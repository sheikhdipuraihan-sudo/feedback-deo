export default function Preloader({ label = 'Loading…' }: { label?: string }) {
  return <div className="preloader-screen" role="status" aria-live="polite">
    <div className="preloader-content">
      <span className="preloader-mark" aria-hidden="true"><i /><i /><i /></span>
      <span>{label}</span>
    </div>
  </div>
}
