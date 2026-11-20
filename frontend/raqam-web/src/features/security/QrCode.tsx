import { encode } from 'uqr'

/**
 * Draws `text` as a QR code. Always dark on white with a quiet border, in both themes:
 * scanners need the contrast, and the page theme must not invert it.
 */
export function QrCode({ text, label }: { text: string; label: string }) {
  const { data, size } = encode(text, { ecc: 'M', border: 0 })
  const quiet = 3
  let path = ''
  data.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) path += `M${x + quiet} ${y + quiet}h1v1h-1z`
    }),
  )
  const side = size + quiet * 2
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${side} ${side}`} shapeRendering="crispEdges" className="size-48 rounded-lg bg-white">
      <path d={path} fill="#000" />
    </svg>
  )
}
