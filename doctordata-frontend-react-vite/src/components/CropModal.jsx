import { useState, useRef } from 'react'

// Crop modal nativo — sin dependencias externas.
// Usa left/top/width/height en lugar de CSS transform para evitar que
// la regla global "img { max-width: 100% }" encoja la imagen antes del scale.

const MAX_W = 440
const MAX_H = 360

export default function CropModal({ src, aspect, title, hint, onConfirm, onCancel }) {
  const isL = aspect >= MAX_W / MAX_H
  const cW  = isL ? MAX_W : Math.round(MAX_H * aspect)
  const cH  = isL ? Math.round(MAX_W / aspect) : MAX_H

  const imgRef = useRef(null)
  const boxRef = useRef(null)
  const isDrag = useRef(false)
  const lastXY = useRef({ x: 0, y: 0 })
  const touchD = useRef(0)
  const nat    = useRef({ nw: 0, nh: 0 })

  // x,y = posición del borde superior-izquierdo de la imagen en el contenedor (px)
  // s   = escala; 0 = imagen no cargada aún
  const [img, setImg] = useState({ x: 0, y: 0, s: 0 })
  const imgR = useRef({ x: 0, y: 0, s: 0 })

  function apply(v) { imgR.current = v; setImg(v) }

  function minScale(nw, nh) { return Math.max(cW / nw, cH / nh) }

  function constrain(x, y, s) {
    const { nw, nh } = nat.current
    if (!nw || !s) return { x, y, s }
    const iw = nw * s, ih = nh * s
    const cx = iw >= cW ? Math.max(cW - iw, Math.min(0, x)) : (cW - iw) / 2
    const cy = ih >= cH ? Math.max(cH - ih, Math.min(0, y)) : (cH - ih) / 2
    return { x: cx, y: cy, s }
  }

  function onImgLoad(e) {
    const nw = e.target.naturalWidth
    const nh = e.target.naturalHeight
    nat.current = { nw, nh }
    const s = minScale(nw, nh)
    apply(constrain((cW - nw * s) / 2, (cH - nh * s) / 2, s))
  }

  function move(dx, dy) {
    const { x, y, s } = imgR.current
    apply(constrain(x + dx, y + dy, s))
  }

  function zoom(factor, pivotX, pivotY) {
    const { x, y, s } = imgR.current
    const { nw, nh } = nat.current
    if (!nw) return
    const ms = minScale(nw, nh)
    const ns = Math.max(ms, Math.min(ms * 4, s * factor))
    const r  = ns / s
    apply(constrain(pivotX - r * (pivotX - x), pivotY - r * (pivotY - y), ns))
  }

  function onMouseDown(e) { isDrag.current = true; lastXY.current = { x: e.clientX, y: e.clientY }; e.preventDefault() }
  function onMouseMove(e) {
    if (!isDrag.current) return
    const dx = e.clientX - lastXY.current.x, dy = e.clientY - lastXY.current.y
    lastXY.current = { x: e.clientX, y: e.clientY }
    move(dx, dy)
  }
  function onMouseUp() { isDrag.current = false }

  function onWheel(e) {
    e.preventDefault()
    const r = boxRef.current.getBoundingClientRect()
    zoom(e.deltaY < 0 ? 1.1 : 0.92, e.clientX - r.left, e.clientY - r.top)
  }

  function onTouchStart(e) {
    e.preventDefault()
    if (e.touches.length === 1) {
      isDrag.current = true
      lastXY.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    } else if (e.touches.length === 2) {
      isDrag.current = false
      touchD.current = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY)
    }
  }
  function onTouchMove(e) {
    e.preventDefault()
    if (e.touches.length === 1 && isDrag.current) {
      const dx = e.touches[0].clientX - lastXY.current.x, dy = e.touches[0].clientY - lastXY.current.y
      lastXY.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      move(dx, dy)
    } else if (e.touches.length === 2) {
      const d  = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY)
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2
      const r  = boxRef.current.getBoundingClientRect()
      zoom(d / touchD.current, cx - r.left, cy - r.top)
      touchD.current = d
    }
  }
  function onTouchEnd() { isDrag.current = false }

  const { nw, nh } = nat.current
  const ms      = nw ? minScale(nw, nh) : 1
  const sliderV = img.s > 0 ? Math.round((img.s / ms - 1) / 3 * 100) : 0

  function onSlider(e) {
    const { nw, nh } = nat.current
    if (!nw) return
    const ms  = minScale(nw, nh)
    const pct = Number(e.target.value) / 100
    const { x, y } = imgR.current
    apply(constrain(x, y, ms * (1 + pct * 3)))
  }

  function confirm() {
    const { x, y, s } = imgR.current
    const canvas = document.createElement('canvas')
    canvas.width  = cW * 2
    canvas.height = cH * 2
    canvas.getContext('2d').drawImage(imgRef.current, -x / s, -y / s, cW / s, cH / s, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(blob => onConfirm(blob), 'image/jpeg', 0.95)
  }

  const dispW = nw ? Math.round(nw * img.s) : 0
  const dispH = nh ? Math.round(nh * img.s) : 0

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <h3 style={{ marginBottom: '0.25rem' }}>{title}</h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>{hint}</p>

        <div
          ref={boxRef}
          style={{ position: 'relative', width: cW, height: cH, margin: '0 auto', overflow: 'hidden', borderRadius: 8, background: '#111', cursor: isDrag.current ? 'grabbing' : 'grab', touchAction: 'none', userSelect: 'none' }}
          onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
          onWheel={onWheel} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        >
          <img
            ref={imgRef} src={src} alt="Recortar" onLoad={onImgLoad} draggable={false}
            style={{ position: 'absolute', left: Math.round(img.x), top: Math.round(img.y), width: dispW || 'auto', height: dispH || 'auto', maxWidth: 'none', maxHeight: 'none', pointerEvents: 'none', visibility: img.s > 0 ? 'visible' : 'hidden' }}
          />
          {img.s === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#aaa', fontSize: '0.85rem' }}>
              Cargando imagen...
            </div>
          )}
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.9rem', fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Zoom</span>
          <input type="range" min={0} max={100} value={sliderV} onChange={onSlider} style={{ flex: 1 }} />
        </label>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
          <button className="btn btn-primary" onClick={confirm} disabled={img.s === 0}>Confirmar recorte</button>
          <button className="btn btn-outline" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}
