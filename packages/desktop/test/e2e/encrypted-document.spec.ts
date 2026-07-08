import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { encryptMarkdown } from '../../src/main/crypto/mdeCrypto'
import {
  clickMenuById,
  forceCloseElectronApp,
  getMarkdownContent,
  launchElectron,
  waitForEditor,
  waitForMenuReady
} from './helpers'

const tabSelector = '.tabs-container > li'

test.describe('Encrypted documents', () => {
  let app: ElectronApplication
  let page: Page
  let mdePath: string

  test.beforeAll(async() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'marktext-mde-e2e-'))
    mdePath = path.join(dir, 'secret.mde')
    const payload = encryptMarkdown('# Encrypted note\n\nHello secure world.', 'pass1234')
    fs.writeFileSync(mdePath, payload)

    const launched = await launchElectron([mdePath])
    app = launched.app
    page = launched.page
    await waitForMenuReady(app)
  })

  test.afterAll(async() => {
    if (app) await forceCloseElectronApp(app)
  })

  test('opens locked mde and unlocks with password', async() => {
    await page.locator('.el-dialog').waitFor({ state: 'visible', timeout: 15000 })
    const dialog = page.locator('.el-dialog')
    await dialog.locator('input[type="password"]').first().fill('pass1234')
    await dialog.getByRole('button', { name: 'Unlock' }).click()
    await page.locator('.el-dialog').waitFor({ state: 'hidden', timeout: 10000 })

    await waitForEditor(page)
    const markdown = await getMarkdownContent(page, app)
    expect(markdown).toContain('Hello secure world.')
  })

  test('locks document from menu', async() => {
    await clickMenuById(app, 'lockDocumentMenuItem')
    await page.locator('.locked-overlay').waitFor({ state: 'visible', timeout: 5000 })
  })

  test('creates new encrypted tab from menu', async() => {
    const before = await page.locator(tabSelector).count()
    await clickMenuById(app, 'newEncryptedTabMenuItem')
    await page.waitForFunction(
      ({ selector, prev }) => document.querySelectorAll(selector).length > prev,
      { selector: tabSelector, prev: before },
      { timeout: 5000 }
    )
    const after = await page.locator(tabSelector).count()
    expect(after).toBeGreaterThan(before)
    await waitForEditor(page)
  })
})
