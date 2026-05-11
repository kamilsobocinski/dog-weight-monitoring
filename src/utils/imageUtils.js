/**
 * Read EXIF orientation from a JPEG blob.
 * Returns angle in degrees (0, 90, 180, 270) needed to display correctly.
 */
function readExifOrientation(blob) {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = e => {
      const view = new DataView(e.target.result)
      if (view.getUint16(0) !== 0xFFD8) return resolve(0) // not JPEG
      let offset = 2
      while (offset < view.byteLength) {
        const marker = view.getUint16(offset)
        if (marker === 0xFFE1) { // APP1 = EXIF
          const exifOffset = offset + 4
          const little = view.getUint16(exifOffset + 6) === 0x4949
          const ifd = exifOffset + 6 + view.getUint32(exifOffset + 10, little)
          const entries = view.getUint16(ifd, little)
          for (let i = 0; i < entries; i++) {
            const tag = view.getUint16(ifd + 2 + i * 12, little)
            if (tag === 0x0112) { // Orientation tag
              const val = view.getUint16(ifd + 2 + i * 12 + 8, little)
              const map = { 1: 0, 3: 180, 6: 90, 8: 270 }
              return resolve(map[val] || 0)
            }
          }
          return resolve(0)
        }
        if ((marker & 0xFF00) !== 0xFF00) break
        offset += 2 + view.getUint16(offset + 2)
      }
      resolve(0)
    }
    reader.onerror = () => resolve(0)
    reader.readAsArrayBuffer(blob)
  })
}

/**
 * Resize + auto-rotate (EXIF correction) an image File.
 * Returns a base64 JPEG string correctly oriented for OCR.
 */
export function resizeImage(file, maxSize = 1600, quality = 0.92) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()

    img.onload = async () => {
      URL.revokeObjectURL(url)

      // Read EXIF orientation from original file
      const rotDeg = await readExifOrientation(file)

      // Determine canvas dimensions accounting for rotation
      const sw = img.naturalWidth
      const sh = img.naturalHeight
      const rotated = rotDeg === 90 || rotDeg === 270
      const logicalW = rotated ? sh : sw
      const logicalH = rotated ? sw : sh

      // Scale to maxSize
      let w = logicalW, h = logicalH
      if (w > h) {
        if (w > maxSize) { h = Math.round(h * maxSize / w); w = maxSize }
      } else {
        if (h > maxSize) { w = Math.round(w * maxSize / h); h = maxSize }
      }

      const canvas = document.createElement('canvas')
      canvas.width  = w
      canvas.height = h
      const ctx = canvas.getContext('2d')

      // Apply rotation so text is upright for OCR
      if (rotDeg !== 0) {
        ctx.translate(w / 2, h / 2)
        ctx.rotate((rotDeg * Math.PI) / 180)
        if (rotated) {
          ctx.drawImage(img, -h / 2, -w / 2, h, w)
        } else {
          ctx.drawImage(img, -w / 2, -h / 2, w, h)
        }
      } else {
        ctx.drawImage(img, 0, 0, w, h)
      }

      resolve(canvas.toDataURL('image/jpeg', quality))
    }

    img.onerror = reject
    img.src = url
  })
}
