import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const readProjectFile = (path: string): Promise<string> =>
  readFile(resolve(process.cwd(), path), 'utf8')

describe('GitHub Pages deployment', () => {
  it('builds and deploys the dist artifact for the repository subpath', async () => {
    const [packageJson, workflow] = await Promise.all([
      readProjectFile('package.json'),
      readProjectFile('.github/workflows/deploy-pages.yml'),
    ])

    expect(packageJson).toContain('npm run build -- --base=/octareader/')
    expect(workflow).toContain('npm run validate')
    expect(workflow).toContain('npm run build:pages')
    expect(workflow).toContain('actions/configure-pages@v6')
    expect(workflow).toContain('actions/upload-pages-artifact@v4')
    expect(workflow).toContain('actions/deploy-pages@v4')
    expect(workflow).toContain('path: dist')
  })

  it('creates a history-mode fallback from the built application shell', async () => {
    const prepareScript = await readProjectFile('scripts/prepare-pages.mjs')

    expect(prepareScript).toContain('index.html')
    expect(prepareScript).toContain('404.html')
  })
})
