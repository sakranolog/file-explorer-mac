import { clipboard } from 'electron'

/**
 * OS-clipboard file interop (macOS).
 *
 * Electron's clipboard API has no first-class "file" flavor, but on macOS the
 * pasteboard bridges the legacy NSFilenamesPboardType (an XML plist array of
 * absolute paths) to the modern file-URL flavors in both directions. Writing it
 * makes Finder's Paste create copies of our files; reading it sees files copied
 * in Finder (and any other file manager).
 */

const PLIST_HEADER =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" ' +
  '"http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n'

const escapeXml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const unescapeXml = (s: string): string =>
  s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')

/** Put file references on the OS clipboard so Finder & other apps can paste them. */
export function writeFiles(paths: string[]): void {
  if (!paths.length) return
  const entries = paths.map((p) => `<string>${escapeXml(p)}</string>`).join('')
  const plist = `${PLIST_HEADER}<plist version="1.0"><array>${entries}</array></plist>`
  clipboard.writeBuffer('NSFilenamesPboardType', Buffer.from(plist, 'utf8'))
}

/** File paths currently on the OS clipboard; [] when it holds no files. */
export function readFiles(): string[] {
  // Primary: the bridged plist flavor — carries every file of a multi-select copy.
  try {
    const plist = clipboard.read('NSFilenamesPboardType')
    if (plist) {
      const paths = [...plist.matchAll(/<string>([\s\S]*?)<\/string>/g)].map((m) =>
        unescapeXml(m[1])
      )
      if (paths.length) return paths
    }
  } catch {
    /* flavor not present */
  }
  // Fallback: single file-URL flavor.
  try {
    const url = clipboard.read('public.file-url')
    if (url.startsWith('file://')) return [decodeURIComponent(new URL(url).pathname)]
  } catch {
    /* flavor not present / malformed URL */
  }
  return []
}

export function clear(): void {
  clipboard.clear()
}
