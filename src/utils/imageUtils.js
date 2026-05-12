/**
 * Resize an image File to max 1200px on longest side before OCR.
 * Returns a data-URL string (JPEG).
 */
export function resizeImage(file, maxPx = 1200, quality = 0.88) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width: w, height: h } = img
      if (w > maxPx || h > maxPx) {
        if (w > h) { h = Math.round(h * maxPx / w); w = maxPx }
        else       { w = Math.round(w * maxPx / h); h = maxPx }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = reject
    img.src = url
  })
}
