import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BUCKET_NAME = 'question-images'

/**
 * Upload a question image to Supabase Storage
 * @param file - File to upload
 * @param path - Storage path (e.g., "2024/2/q5/diagram.png")
 * @returns Public URL of uploaded image
 */
export async function uploadQuestionImage(
  file: File,
  path: string
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) {
    console.error('Supabase upload error:', error)
    throw new Error(`Failed to upload image: ${error.message}`)
  }

  return getImageUrl(path)
}

/**
 * Get public URL for a question image
 * @param path - Storage path
 * @returns Public URL
 */
export function getImageUrl(path: string): string {
  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path)

  return publicUrl
}

/**
 * Delete a question image
 * @param path - Storage path
 */
export async function deleteQuestionImage(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET_NAME).remove([path])

  if (error) {
    console.error('Supabase delete error:', error)
    throw new Error(`Failed to delete image: ${error.message}`)
  }
}

/**
 * List all images for a question
 * @param prefix - Path prefix (e.g., "2024/2/q5/")
 * @returns Array of file paths
 */
export async function listQuestionImages(prefix: string): Promise<string[]> {
  const { data, error } = await supabase.storage.from(BUCKET_NAME).list(prefix)

  if (error) {
    console.error('Supabase list error:', error)
    throw new Error(`Failed to list images: ${error.message}`)
  }

  return data.map((file) => `${prefix}/${file.name}`)
}
