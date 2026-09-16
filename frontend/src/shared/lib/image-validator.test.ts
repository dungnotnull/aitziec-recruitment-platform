import { describe, it, expect } from 'vitest'
import { validateAndNormalizeImageFile, MAX_IMAGE_SIZE_BYTES } from './image-validator'

describe('validateAndNormalizeImageFile', () => {
  it('should validate valid PNG binary content', async () => {
    // 89 50 4E 47 0D 0A 1A 0A
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00])
    const file = new File([pngBytes], 'logo.png', { type: 'image/png' })

    const result = await validateAndNormalizeImageFile(file)
    expect(result.isValid).toBe(true)
    expect(result.detectedExt).toBe('png')
    expect(result.file.type).toBe('image/png')
  })

  it('should validate valid JPEG binary content', async () => {
    // FF D8 FF
    const jpgBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
    const file = new File([jpgBytes], 'photo.jpg', { type: 'image/jpeg' })

    const result = await validateAndNormalizeImageFile(file)
    expect(result.isValid).toBe(true)
    expect(result.detectedExt).toBe('jpg')
    expect(result.file.type).toBe('image/jpeg')
  })

  it('should auto-normalize a JPEG disguised with .png extension to image/jpeg', async () => {
    // JPEG bytes but with .png name and image/png type
    const jpgBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
    const fakePng = new File([jpgBytes], 'my-image.png', { type: 'image/png' })

    const result = await validateAndNormalizeImageFile(fakePng)
    expect(result.isValid).toBe(true)
    expect(result.detectedExt).toBe('jpg')
    expect(result.file.type).toBe('image/jpeg')
    expect(result.file.name).toBe('my-image.jpg')
  })

  it('should reject non-image file content', async () => {
    const textBytes = new TextEncoder().encode('Hello this is a plain text file')
    const fakeFile = new File([textBytes], 'document.png', { type: 'image/png' })

    const result = await validateAndNormalizeImageFile(fakeFile)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('chữ ký ảnh')
  })

  it('should reject files exceeding 5MB', async () => {
    const hugeBlob = new Blob([new Uint8Array(MAX_IMAGE_SIZE_BYTES + 10)])
    const file = new File([hugeBlob], 'huge.png', { type: 'image/png' })

    const result = await validateAndNormalizeImageFile(file)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('5MB')
  })
})
