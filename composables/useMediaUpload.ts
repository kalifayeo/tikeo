/**
 * Envoi de fichiers images vers le bucket Storage "media"
 * (voir supabase/migrations/0014_media_storage.sql).
 *
 * Utilisé par le composant MediaInput.vue, qui laisse le choix entre coller
 * une URL externe et envoyer un fichier depuis son ordinateur : dans les
 * deux cas, le formulaire appelant ne manipule au final qu'une simple URL.
 */

export const MEDIA_BUCKET = 'media'

// Dossiers autorisés par les policies Storage (premier segment du chemin).
export type MediaFolder = 'event-covers' | 'seating-plans' | 'organizer-logos' | 'home-slides' | 'avatars'

// Doit rester aligné avec `allowed_mime_types` du bucket, sinon Supabase
// rejette l'envoi avec un message peu parlant côté utilisateur.
export const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  // SVG volontairement refusé : un SVG peut embarquer du JavaScript (bucket public).
]
export const ACCEPTED_DOCUMENT_TYPES = ['application/pdf']

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 Mo, comme le bucket

// Taille maximale (px, plus grand côté) et qualité WebP par dossier. Une
// affiche de téléphone de 4 000 px et 6 Mo devient ~1 600 px et ~150 Ko :
// les pages se chargent bien plus vite sur les connexions mobiles
// (cahier des charges §56 : « compression des images »).
const OPTIMIZATION: Record<MediaFolder, { maxSide: number; quality: number }> = {
  'event-covers': { maxSide: 1600, quality: 0.82 },
  'seating-plans': { maxSide: 2400, quality: 0.9 }, // plan de salle : texte fin à préserver
  'organizer-logos': { maxSide: 512, quality: 0.85 },
  'home-slides': { maxSide: 2000, quality: 0.82 },
  avatars: { maxSide: 512, quality: 0.85 },
}
// GIF (animés), AVIF (déjà compressé) et PDF sont envoyés tels quels.
const OPTIMIZABLE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/**
 * Redimensionne et convertit en WebP côté navigateur avant l'envoi. En cas
 * de problème (navigateur ancien, image illisible) ou si le résultat n'est
 * pas plus léger, on garde le fichier d'origine : l'optimisation ne doit
 * jamais empêcher un envoi.
 */
async function optimizeImage(file: File, folder: MediaFolder): Promise<File> {
  if (!import.meta.client || !OPTIMIZABLE_TYPES.includes(file.type) || typeof createImageBitmap !== 'function') return file
  try {
    const { maxSide, quality } = OPTIMIZATION[folder]
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close?.()

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality))
    if (!blob || blob.type !== 'image/webp') return file
    if (scale === 1 && blob.size >= file.size) return file

    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.webp`, { type: 'image/webp' })
  } catch {
    return file
  }
}

/**
 * Nom de fichier sûr et unique : on repart de l'extension d'origine (pour
 * que le navigateur serve le bon type) mais on jette le nom d'origine, qui
 * peut contenir des accents, des espaces ou des caractères refusés par
 * Storage.
 */
function buildObjectName(folder: MediaFolder, file: File) {
  const extension = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  return `${folder}/${unique}.${extension}`
}

export function useMediaUpload() {
  const uploading = ref(false)
  const progressLabel = ref('')
  const error = ref<string | null>(null)

  function validate(file: File, accept: string[]) {
    if (!accept.includes(file.type)) return 'unsupportedType'
    if (file.size > MAX_FILE_SIZE) return 'tooLarge'
    return null
  }

  /**
   * Envoie le fichier et renvoie son URL publique, directement utilisable
   * dans un <img src> ou stockée telle quelle en base (cover_image,
   * logo_url, media_url...).
   */
  async function uploadFile(
    file: File,
    folder: MediaFolder,
    options: { accept?: string[] } = {}
  ): Promise<string> {
    const accept = options.accept ?? ACCEPTED_IMAGE_TYPES
    const problem = validate(file, accept)
    if (problem) {
      error.value = problem
      throw new Error(problem)
    }

    uploading.value = true
    error.value = null
    try {
      const supabase = useSupabase()
      const prepared = await optimizeImage(file, folder)
      const objectName = buildObjectName(folder, prepared)
      const { error: uploadError } = await supabase.storage.from(MEDIA_BUCKET).upload(objectName, prepared, {
        // Nom unique par envoi : le fichier ne change jamais → cache long autorisé.
        cacheControl: '31536000',
        upsert: false,
        contentType: prepared.type,
      })
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(objectName)
      if (!data?.publicUrl) throw new Error('uploadFailed')
      return data.publicUrl
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'uploadFailed'
      throw e
    } finally {
      uploading.value = false
      progressLabel.value = ''
    }
  }

  return { uploading, progressLabel, error, uploadFile, validate }
}
