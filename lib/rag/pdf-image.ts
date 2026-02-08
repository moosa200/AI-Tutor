import fs from 'fs'
import path from 'path'
import { createCanvas } from 'canvas'
// @ts-ignore - pdfjs-dist types can be tricky
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

// Ensure public/questions directory exists
const PUBLIC_DIR = path.join(process.cwd(), 'public')
const QUESTIONS_DIR = path.join(PUBLIC_DIR, 'questions')

if (!fs.existsSync(QUESTIONS_DIR)) {
  fs.mkdirSync(QUESTIONS_DIR, { recursive: true })
}

export async function cropAndSaveImage(
  pdfPath: string,
  pageNumber: number,
  boundingBox: [number, number, number, number], // [ymin, xmin, ymax, xmax] (0-1000)
  year: number,
  paper: string,
  questionNumber: string
): Promise<string | null> {
  try {
    // Load the PDF document
    const data = new Uint8Array(fs.readFileSync(pdfPath))
    const loadingTask = pdfjsLib.getDocument({
      data,
      cMapUrl: 'node_modules/pdfjs-dist/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: 'node_modules/pdfjs-dist/standard_fonts/',
    })
    const doc = await loadingTask.promise

    // Get the page
    // Note: pageNumber from Gemini is 1-based, pdfjs is 1-based
    if (pageNumber < 1 || pageNumber > doc.numPages) {
      console.warn(`⚠️  Invalid page number ${pageNumber} for ${path.basename(pdfPath)}`)
      return null
    }
    const page = await doc.getPage(pageNumber)

    // Set scale for good quality (2.0 is usually sufficient)
    const scale = 2.0
    const viewport = page.getViewport({ scale })

    // Prepare canvas
    const canvas = createCanvas(viewport.width, viewport.height)
    const context = canvas.getContext('2d')

    // Render PDF page to canvas
    await page.render({
      canvasContext: context as any,
      viewport,
    }).promise

    // Calculate crop coordinates
    // Gemini returns [ymin, xmin, ymax, xmax] on 0-1000 scale
    const [ymin, xmin, ymax, xmax] = boundingBox
    
    const x = (xmin / 1000) * viewport.width
    const y = (ymin / 1000) * viewport.height
    const w = ((xmax - xmin) / 1000) * viewport.width
    const h = ((ymax - ymin) / 1000) * viewport.height

    // Validate dimensions
    if (w <= 0 || h <= 0) {
      console.warn(`⚠️  Invalid crop dimensions for Q${questionNumber}`)
      return null
    }

    // Create a new canvas for the cropped image
    const cropCanvas = createCanvas(w, h)
    const cropCtx = cropCanvas.getContext('2d')

    // Draw the cropped portion
    cropCtx.drawImage(canvas, x, y, w, h, 0, 0, w, h)

    // Generate filename: year_paper_qNum.png (sanitize filename)
    const safePaper = paper.replace(/\s+/g, '_')
    const safeQNum = questionNumber.replace(/[^\w.-]/g, '_')
    const filename = `${year}_${safePaper}_${safeQNum}.png`
    const outputPath = path.join(QUESTIONS_DIR, filename)

    // Save to disk
    const buffer = cropCanvas.toBuffer('image/png')
    fs.writeFileSync(outputPath, buffer)

    // Return public URL
    return `/questions/${filename}`
  } catch (error) {
    console.error(`❌ Error cropping image for Q${questionNumber}:`, error)
    return null
  }
}