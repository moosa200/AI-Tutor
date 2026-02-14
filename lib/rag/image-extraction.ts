import { cropAndSaveImage } from './pdf-image'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BUCKET_NAME = 'question-images'

/**
 * Extract an image from a PDF and upload it to Supabase Storage
 * @param pdfPath - Path to the PDF file
 * @param pageNumber - Page number (1-based)
 * @param boundingBox - Bounding box coordinates [ymin, xmin, ymax, xmax] on 0-1000 scale
 * @param year - Question year
 * @param paper - Paper number
 * @param questionId - Unique identifier for the question (e.g., "q1", "q2a", "q3bi")
 * @returns Public URL of the uploaded image, or null if extraction failed
 */
export async function extractAndUploadImage(
  pdfPath: string,
  pageNumber: number,
  boundingBox: [number, number, number, number],
  year: number,
  paper: number,
  questionId: string
): Promise<string | null> {
  try {
    // 1. Crop image from PDF to local temp file
    const localPath = await cropAndSaveImage(
      pdfPath,
      pageNumber,
      boundingBox,
      year,
      `paper${paper}`,
      questionId
    )

    if (!localPath) {
      console.warn(`   ⚠️  Failed to crop image for ${questionId}`)
      return null
    }

    // 2. Read the cropped image as a Buffer
    const imagePath = path.join(process.cwd(), 'public', localPath)
    if (!fs.existsSync(imagePath)) {
      console.warn(`   ⚠️  Cropped image not found at ${imagePath}`)
      return null
    }

    const buffer = fs.readFileSync(imagePath)

    // 3. Upload to Supabase Storage
    const storagePath = `${year}/${paper}/${questionId}.png`
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: true, // Overwrite if exists
      })

    if (error) {
      console.error(`   ❌ Supabase upload error for ${questionId}:`, error)
      // Clean up local file even on error
      fs.unlinkSync(imagePath)
      return null
    }

    // 4. Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath)

    // 5. Clean up local file
    fs.unlinkSync(imagePath)

    console.log(`   ✓ Uploaded image for ${questionId}: ${publicUrl}`)
    return publicUrl
  } catch (error) {
    console.error(`   ❌ Error extracting image for ${questionId}:`, error)
    return null
  }
}
