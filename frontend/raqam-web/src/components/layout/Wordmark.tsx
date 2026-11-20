/**
 * The Raqam mark: the Arabic word رقم ("amount") in gold Kufi lettering beside the Latin
 * name. The Arabic is decoration for sighted users; the name is read once as "Raqam".
 */
export function Wordmark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <span className="inline-flex items-baseline gap-2.5">
      <span
        lang="ar"
        dir="rtl"
        aria-hidden="true"
        className={`font-brand font-bold leading-none text-gold ${size === 'lg' ? 'text-4xl' : 'text-3xl'}`}
      >
        رقم
      </span>
      <span className={`font-semibold tracking-tight text-side-fg ${size === 'lg' ? 'text-xl' : 'text-lg'}`}>Raqam</span>
    </span>
  )
}
