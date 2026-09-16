/**
 * Client-side image validation and normalization utility.
 * Inspects binary magic bytes to ensure file content signature matches
 * supported MIME types (PNG, JPEG, WebP) and avoids 415 Unsupported Media Type errors.
 */

export interface ImageValidationResult {
  isValid: boolean
  file: File
  detectedExt?: 'png' | 'jpg' | 'webp'
  error?: string
}

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024 // 5MB

export async function validateAndNormalizeImageFile(file: File): Promise<ImageValidationResult> {
  if (!file) {
    return { isValid: false, file, error: 'Không tìm thấy tệp được chọn.' }
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return {
      isValid: false,
      file,
      error: 'Dung lượng tệp vượt quá 5MB. Vui lòng chọn tệp ảnh có dung lượng nhỏ hơn.',
    }
  }

  try {
    const slice = file.slice(0, 16)
    const arrayBuffer = await slice.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)

    let detectedExt: 'png' | 'jpg' | 'webp' | null = null
    let targetMime = ''

    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    ) {
      detectedExt = 'png'
      targetMime = 'image/png'
    }
    // JPEG signature: FF D8 FF
    else if (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    ) {
      detectedExt = 'jpg'
      targetMime = 'image/jpeg'
    }
    // WebP signature: RIFF at 0..3 and WEBP at 8..11
    else if (bytes.length >= 12) {
      const header = String.fromCharCode(...bytes.slice(0, 4))
      const format = String.fromCharCode(...bytes.slice(8, 12))
      if (header === 'RIFF' && format === 'WEBP') {
        detectedExt = 'webp'
        targetMime = 'image/webp'
      }
    }

    if (!detectedExt) {
      return {
        isValid: false,
        file,
        error:
          'Nội dung tệp không khớp với chữ ký ảnh được hỗ trợ (PNG, JPEG, WebP). Vui lòng kiểm tra lại tệp thực tế.',
      }
    }

    // Auto-normalize file if declared MIME type or extension does not match actual signature
    let normalizedFile = file
    const currentExt = file.name.split('.').pop()?.toLowerCase() || ''
    const isMimeMismatch = file.type !== targetMime
    const isExtMismatch =
      (detectedExt === 'jpg' && !['jpg', 'jpeg'].includes(currentExt)) ||
      (detectedExt === 'png' && currentExt !== 'png') ||
      (detectedExt === 'webp' && currentExt !== 'webp')

    if (isMimeMismatch || isExtMismatch) {
      const baseName = file.name.replace(/\.[^/.]+$/, '')
      const newExt = detectedExt === 'jpg' ? 'jpg' : detectedExt
      normalizedFile = new File([file], `${baseName}.${newExt}`, { type: targetMime })
    }

    return {
      isValid: true,
      file: normalizedFile,
      detectedExt,
    }
  } catch {
    return {
      isValid: false,
      file,
      error: 'Không thể phân tích nội dung tệp ảnh. Vui lòng thử lại.',
    }
  }
}
