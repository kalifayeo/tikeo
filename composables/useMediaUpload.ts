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
  'image/svg+xml',
]
export const ACCEPTED_DOCUMENT_TYPES = ['application/pdf']

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 Mo, comme le bucket

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
      const objectName = buildObjectName(folder, file)
      const { error: uploadError } = await supabase.storage.from(MEDIA_BUCKET).upload(objectName, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
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
