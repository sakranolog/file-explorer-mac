// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const clipboardMock = vi.hoisted(() => ({
  writeBuffer: vi.fn(),
  read: vi.fn().mockReturnValue(''),
  clear: vi.fn()
}))
vi.mock('electron', () => ({ clipboard: clipboardMock }))

import { writeFiles, readFiles, clear } from './clipboard'

beforeEach(() => {
  vi.clearAllMocks()
  clipboardMock.read.mockReturnValue('')
})

const plistWith = (...paths: string[]): string =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0">\n<array>\n${paths
    .map((p) => `\t<string>${p}</string>`)
    .join('\n')}\n</array>\n</plist>\n`

describe('writeFiles', () => {
  it('writes an NSFilenamesPboardType plist containing every path', () => {
    writeFiles(['/Users/x/a.txt', '/Users/x/b.txt'])
    expect(clipboardMock.writeBuffer).toHaveBeenCalledTimes(1)
    const [format, buf] = clipboardMock.writeBuffer.mock.calls[0]
    expect(format).toBe('NSFilenamesPboardType')
    const xml = (buf as Buffer).toString('utf8')
    expect(xml).toContain('<string>/Users/x/a.txt</string>')
    expect(xml).toContain('<string>/Users/x/b.txt</string>')
    expect(xml).toContain('<plist version="1.0"><array>')
  })

  it('XML-escapes special characters in paths', () => {
    writeFiles(['/Users/x/a & b <c>.txt'])
    const xml = (clipboardMock.writeBuffer.mock.calls[0][1] as Buffer).toString('utf8')
    expect(xml).toContain('<string>/Users/x/a &amp; b &lt;c&gt;.txt</string>')
  })

  it('does nothing for an empty list', () => {
    writeFiles([])
    expect(clipboardMock.writeBuffer).not.toHaveBeenCalled()
  })
})

describe('readFiles', () => {
  it('parses every path out of the NSFilenamesPboardType plist', () => {
    clipboardMock.read.mockImplementation((f: string) =>
      f === 'NSFilenamesPboardType' ? plistWith('/Users/x/a.txt', '/Users/x/b.txt') : ''
    )
    expect(readFiles()).toEqual(['/Users/x/a.txt', '/Users/x/b.txt'])
  })

  it('unescapes XML entities in parsed paths', () => {
    clipboardMock.read.mockImplementation((f: string) =>
      f === 'NSFilenamesPboardType' ? plistWith('/Users/x/a &amp; b &lt;c&gt;.txt') : ''
    )
    expect(readFiles()).toEqual(['/Users/x/a & b <c>.txt'])
  })

  it('falls back to public.file-url and decodes percent-encoding', () => {
    clipboardMock.read.mockImplementation((f: string) =>
      f === 'public.file-url' ? 'file:///Users/x/My%20Doc.txt' : ''
    )
    expect(readFiles()).toEqual(['/Users/x/My Doc.txt'])
  })

  it('returns [] when the clipboard holds no files', () => {
    expect(readFiles()).toEqual([])
  })

  it('returns [] when the clipboard holds plain text only', () => {
    clipboardMock.read.mockReturnValue('')
    expect(readFiles()).toEqual([])
  })

  it('survives a read() that throws (flavor not present)', () => {
    clipboardMock.read.mockImplementation(() => {
      throw new Error('no such format')
    })
    expect(readFiles()).toEqual([])
  })
})

describe('clear', () => {
  it('clears the system clipboard', () => {
    clear()
    expect(clipboardMock.clear).toHaveBeenCalled()
  })
})
