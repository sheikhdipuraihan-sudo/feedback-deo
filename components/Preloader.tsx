export default function Preloader({ label = 'Loading…' }: { label?: string }) {
  return <div className="preloader" role="status" aria-live="polite"><span className="preloader-mark" aria-hidden="true"><i /><i /><i /></span><span>{label}</span></div>
}
