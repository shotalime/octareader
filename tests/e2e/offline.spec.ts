import { readFile } from 'node:fs/promises'
import { createServer, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { extname, resolve, sep } from 'node:path'

import { expect, test } from '@playwright/test'

const distRoot = resolve(process.cwd(), 'dist')

const contentTypeFor = (path: string): string => {
  switch (extname(path)) {
    case '.css':
      return 'text/css; charset=utf-8'
    case '.html':
      return 'text/html; charset=utf-8'
    case '.ico':
      return 'image/x-icon'
    case '.js':
      return 'text/javascript; charset=utf-8'
    case '.json':
    case '.webmanifest':
      return 'application/manifest+json; charset=utf-8'
    case '.png':
      return 'image/png'
    case '.svg':
      return 'image/svg+xml'
    default:
      return 'application/octet-stream'
  }
}

const sendFile = async (
  response: ServerResponse,
  path: string,
): Promise<void> => {
  const content = await readFile(path)
  response.statusCode = 200
  response.setHeader('Content-Type', contentTypeFor(path))
  response.end(content)
}

const handleRequest = async (
  requestUrl: string | undefined,
  response: ServerResponse,
): Promise<void> => {
  const url = new URL(requestUrl ?? '/', 'http://127.0.0.1')
  const requestedPath =
    url.pathname === '/' ? 'index.html' : url.pathname.slice(1)
  const filePath = resolve(distRoot, requestedPath)

  if (!filePath.startsWith(`${distRoot}${sep}`)) {
    response.statusCode = 403
    response.end()
    return
  }

  try {
    await sendFile(response, filePath)
  } catch (_error: unknown) {
    await sendFile(response, resolve(distRoot, 'index.html'))
  }
}

const listen = async (server: Server): Promise<number> => {
  await new Promise<void>((resolveListen, rejectListen) => {
    const onError = (error: Error): void => rejectListen(error)
    server.once('error', onError)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', onError)
      resolveListen()
    })
  })

  const address = server.address() as AddressInfo | null

  if (address === null) {
    throw new Error('Тестовый HTTP-сервер не вернул адрес')
  }

  return address.port
}

const close = async (server: Server): Promise<void> => {
  if (!server.listening) {
    return
  }

  await new Promise<void>((resolveClose, rejectClose) => {
    server.close((error) => {
      if (error !== undefined) {
        rejectClose(error)
        return
      }

      resolveClose()
    })
  })
}

test('app shell открывается после остановки origin-сервера', async ({
  page,
}) => {
  const server = createServer((request, response) => {
    void handleRequest(request.url, response).catch(() => {
      response.statusCode = 500
      response.end()
    })
  })
  const port = await listen(server)
  const origin = `http://127.0.0.1:${port}`

  try {
    await page.goto(origin)
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready

      if (navigator.serviceWorker.controller === null) {
        await new Promise<void>((resolveController) => {
          navigator.serviceWorker.addEventListener(
            'controllerchange',
            () => resolveController(),
            { once: true },
          )
        })
      }
    })

    await close(server)
    await page.goto(origin, { waitUntil: 'domcontentloaded' })

    await expect(
      page.getByRole('heading', { level: 1, name: 'Книги' }),
    ).toBeVisible()
  } finally {
    await close(server)
  }
})
