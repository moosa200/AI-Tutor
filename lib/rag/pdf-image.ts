import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

// Ensure public/questions directory exists
const PUBLIC_DIR = path.join(process.cwd(), 'public')
const QUESTIONS_DIR = path.join(PUBLIC_DIR, 'questions')

if (!fs.existsSync(QUESTIONS_DIR)) {
  fs.mkdirSync(QUESTIONS_DIR, { recursive: true })
}

/**
 * Render a PDF page to a PNG buffer using mupdf (WASM-based, no native deps)
 */
async function renderPageToPng(
  pdfPath: string,
  pageNumber: number,
  scale: number = 2.0
): Promise<{ png: Buffer; width: number; height: number } | null> {
  // Dynamic import since mupdf is ESM-only
  const mupdf = await import('mupdf')

  const data = fs.readFileSync(pdfPath)
  const doc = mupdf.Document.openDocument(data, 'application/pdf')

  // mupdf uses 0-based page indexing
  const pageIndex = pageNumber - 1
  if (pageIndex < 0 || pageIndex >= doc.countPages()) {
    console.warn(
      `⚠️  Invalid page number ${pageNumber} for ${path.basename(pdfPath)} (has ${doc.countPages()} pages)`
    )
    return null
  }

  const page = doc.loadPage(pageIndex)
  const pixmap = page.toPixmap(
    mupdf.Matrix.scale(scale, scale),
    mupdf.ColorSpace.DeviceRGB
  )

  const width = pixmap.getWidth()
  const height = pixmap.getHeight()
  const png = Buffer.from(pixmap.asPNG())

  return { png, width, height }
}

/**
 * Render a full PDF page as a PNG image and save it.
 * Returns the public URL path.
 */
export async function renderFullPage(
  pdfPath: string,
  pageNumber: number,
  year: number,
  paper: string,
  questionNumber: string
): Promise<string | null> {
  try {
    const result = await renderPageToPng(pdfPath, pageNumber)
    if (!result) return null

    const safePaper = paper.replace(/\s+/g, '_')
    const safeQNum = questionNumber.replace(/[^\w.-]/g, '_')
    const filename = `${year}_${safePaper}_${safeQNum}_page${pageNumber}.png`
    const outputPath = path.join(QUESTIONS_DIR, filename)

    fs.writeFileSync(outputPath, result.png)
    return `/questions/${filename}`
  } catch (error) {
    console.error(`❌ Error rendering page for Q${questionNumber}:`, error)
    return null
  }
}

/**
 * Crop a region from a PDF page and save as PNG.
 * boundingBox is [ymin, xmin, ymax, xmax] on a 0-1000 scale (Gemini format).
 * Returns the public URL path.
 */
export async function cropAndSaveImage(
  pdfPath: string,
  pageNumber: number,
  boundingBox: [number, number, number, number],
  year: number,
  paper: string,
  questionNumber: string
): Promise<string | null> {
  try {
    const result = await renderPageToPng(pdfPath, pageNumber)
    if (!result) return null

    const { png, width, height } = result

    // Convert Gemini's 0-1000 scale to pixel coordinates
    const [ymin, xmin, ymax, xmax] = boundingBox

    // Add 2% padding to avoid cutting off edges
    const PADDING_PERCENT = 2
    const xPadding = Math.round(((xmax - xmin) * PADDING_PERCENT) / 100)
    const yPadding = Math.round(((ymax - ymin) * PADDING_PERCENT) / 100)

    // Calculate crop dimensions with padding
    let left = Math.max(0, Math.round((xmin / 1000) * width) - xPadding)
    let top = Math.max(0, Math.round((ymin / 1000) * height) - yPadding)
    let cropWidth = Math.round(((xmax - xmin) / 1000) * width) + 2 * xPadding
    let cropHeight = Math.round(((ymax - ymin) / 1000) * height) + 2 * yPadding

    // Ensure we don't exceed image boundaries
    cropWidth = Math.min(cropWidth, width - left)
    cropHeight = Math.min(cropHeight, height - top)

    if (cropWidth <= 0 || cropHeight <= 0) {
      console.warn(`⚠️  Invalid crop dimensions for Q${questionNumber}`)
      return null
    }

    console.log(
      `   📐 Crop: ${cropWidth}x${cropHeight} at (${left},${top}) from ${width}x${height}`
    )

    // Generate filename
    const safePaper = paper.replace(/\s+/g, '_')
    const safeQNum = questionNumber.replace(/[^\w.-]/g, '_')
    const filename = `${year}_${safePaper}_${safeQNum}.png`
    const outputPath = path.join(QUESTIONS_DIR, filename)

    // Crop and save using sharp
    await sharp(png)
      .extract({ left, top, width: cropWidth, height: cropHeight })
      .png()
      .toFile(outputPath)

    return `/questions/${filename}`
  } catch (error) {
    console.error(`❌ Error cropping image for Q${questionNumber}:`, error)
    return null
  }
}

