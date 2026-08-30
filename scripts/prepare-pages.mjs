import { copyFile } from 'node:fs/promises'
import { fileURLToPath, URL } from 'node:url'

const distributionDirectory = fileURLToPath(
  new URL('../dist/', import.meta.url),
)

// GitHub Pages serves 404.html for unknown history-mode routes. Reusing the
// application shell lets Vue Router resolve direct links such as /settings.
await copyFile(
  `${distributionDirectory}index.html`,
  `${distributionDirectory}404.html`,
)
