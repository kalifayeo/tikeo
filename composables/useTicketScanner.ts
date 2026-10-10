/**
 * Lecture de QR codes par la caméra (page « Scanner d'entrée »).
 *
 * - Utilise `BarcodeDetector` (natif, rapide) quand le navigateur l'a
 *   (Chrome / Edge / Android) et retombe sur `jsQR` sinon (Safari iOS, Firefox).
 * - Caméra arrière par défaut, bascule avant/arrière, lampe torche si
 *   l'appareil la gère.
 * - La caméra n'est accessible qu'en HTTPS (ou sur localhost) : sinon l'erreur
 *   `insecure` est renvoyée pour afficher un message clair.
 */
export type ScannerError = 'insecure' | 'unsupported' | 'denied' | 'notfound' | 'failed' | null

export function useTicketScanner(onCode: (code: string) => void) {
  const videoEl = ref<HTMLVideoElement | null>(null)
  const running = ref(false)
  const starting = ref(false)
  const error = ref<ScannerError>(null)
  const torchAvailable = ref(false)
  const torchOn = ref(false)
  const canSwitch = ref(false)

  let stream: MediaStream | null = null
  let raf = 0
  let lastTick = 0
  let detector: any = null
  let jsQR: ((d: Uint8ClampedArray, w: number, h: number) => { data: string } | null) | null = null
  let canvas: HTMLCanvasElement | null = null
  let facing: 'environment' | 'user' = 'environment'
  let deviceIds: string[] = []
  let deviceIndex = -1

  async function prepareDecoder() {
    if (detector || jsQR) return
    const BD = (globalThis as any).BarcodeDetector
    if (BD) {
      try {
        const formats: string[] = await BD.getSupportedFormats?.()
        if (!formats || formats.includes('qr_code')) {
          detector = new BD({ formats: ['qr_code'] })
          return
        }
      } catch {
        /* on retombe sur jsQR */
      }
    }
    const mod: any = await import('jsqr')
    jsQR = mod.default ?? mod
  }

  async function start() {
    if (running.value || starting.value) return
    error.value = null
    if (typeof window === 'undefined') return
    if (!window.isSecureContext) {
      error.value = 'insecure'
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      error.value = 'unsupported'
      return
    }
    starting.value = true
    try {
      await prepareDecoder()
      const video: MediaTrackConstraints =
        deviceIndex >= 0 && deviceIds[deviceIndex]
          ? { deviceId: { exact: deviceIds[deviceIndex] }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } }
      stream = await navigator.mediaDevices.getUserMedia({ video, audio: false })

      const el = videoEl.value
      if (!el) throw new Error('no-video')
      el.srcObject = stream
      el.setAttribute('playsinline', 'true')
      el.muted = true
      await el.play()

      const track = stream.getVideoTracks()[0]
      const caps: any = track?.getCapabilities?.() ?? {}
      torchAvailable.value = !!caps.torch
      torchOn.value = false
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        deviceIds = devices.filter((d) => d.kind === 'videoinput').map((d) => d.deviceId)
        canSwitch.value = deviceIds.length > 1
        const current = track?.getSettings?.().deviceId
        if (current) deviceIndex = Math.max(0, deviceIds.indexOf(current))
      } catch {
        canSwitch.value = false
      }

      running.value = true
      loop()
    } catch (e: any) {
      stop()
      const name = e?.name || ''
      error.value = name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'notfound' : 'failed'
    } finally {
      starting.value = false
    }
  }

  function stop() {
    cancelAnimationFrame(raf)
    running.value = false
    torchOn.value = false
    torchAvailable.value = false
    stream?.getTracks().forEach((t) => t.stop())
    stream = null
    if (videoEl.value) videoEl.value.srcObject = null
  }

  async function decode(): Promise<string | null> {
    const el = videoEl.value
    if (!el || el.readyState < 2 || !el.videoWidth) return null
    if (detector) {
      const found = await detector.detect(el)
      return found?.[0]?.rawValue || null
    }
    if (jsQR) {
      const scale = Math.min(1, 720 / el.videoWidth)
      const w = Math.round(el.videoWidth * scale)
      const h = Math.round(el.videoHeight * scale)
      canvas = canvas || document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return null
      ctx.drawImage(el, 0, 0, w, h)
      const img = ctx.getImageData(0, 0, w, h)
      return jsQR(img.data, w, h)?.data || null
    }
    return null
  }

  function loop() {
    raf = requestAnimationFrame(async (now) => {
      if (!running.value) return
      if (now - lastTick > 140) {
        lastTick = now
        try {
          const code = await decode()
          if (code) onCode(code)
        } catch {
          /* une image illisible n'est pas une erreur */
        }
      }
      if (running.value) loop()
    })
  }

  async function toggleTorch() {
    const track = stream?.getVideoTracks()[0]
    if (!track || !torchAvailable.value) return
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn.value } as any] })
      torchOn.value = !torchOn.value
    } catch {
      torchAvailable.value = false
    }
  }

  async function switchCamera() {
    if (!canSwitch.value) return
    deviceIndex = (deviceIndex + 1) % deviceIds.length
    stop()
    await start()
  }

  // Coupe la caméra quand l'onglet passe en arrière-plan (batterie, vie privée)
  function onVisibility() {
    if (document.hidden && running.value) stop()
  }
  onMounted(() => document.addEventListener('visibilitychange', onVisibility))
  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVisibility)
    stop()
  })

  return { videoEl, running, starting, error, torchAvailable, torchOn, canSwitch, start, stop, toggleTorch, switchCamera }
}
