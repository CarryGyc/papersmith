import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const APP_URL = process.env.PAPERSMITH_E2E_URL ?? 'http://127.0.0.1:43227'

test('PaperSmith loads editor and accepts inserted text as a draft version', async ({ page }) => {
  const insertedText = `Codex draft version verification ${Date.now()}.`

  await page.goto(APP_URL)

  await expect(page.getByLabel('PaperSmith editor workspace')).toBeVisible()
  await expect(page.locator('.brand-wordmark')).toHaveText('PaperSmith')
  await expect(page.getByLabel('Paper document editor')).toBeVisible()

  const response = await page.request.post(`${APP_URL}/api/insert-text`, {
    data: { text: insertedText }
  })
  expect(response.ok()).toBe(true)

  await page.reload()
  await expect(page.getByText(insertedText)).toBeVisible()
  await expect(page.locator('.version-switcher')).toBeVisible()
})

test('PaperSmith keeps multiple annotation comments visible in the inspector', async ({ page }) => {
  const suffix = Date.now()
  const firstComment = `comment 1 ${suffix}`
  const secondComment = `comment 2 ${suffix}`

  await page.goto(APP_URL)

  await expect(page.getByLabel('PaperSmith editor workspace')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Annotations' })).toBeVisible()
  await expect(page.getByText('Text Info')).toHaveCount(0)

  const firstResponse = await page.request.post(`${APP_URL}/api/annotations`, {
    data: {
      type: 'clarity',
      comment: firstComment,
      selection: {
        text: 'Start',
        range: { from: 1, to: 6 },
        docVersion: 1
      }
    }
  })
  expect(firstResponse.ok()).toBe(true)

  const secondResponse = await page.request.post(`${APP_URL}/api/annotations`, {
    data: {
      type: 'clarity',
      comment: secondComment,
      selection: {
        text: 'PaperSmith',
        range: { from: 20, to: 30 },
        docVersion: 1
      }
    }
  })
  expect(secondResponse.ok()).toBe(true)

  await page.reload()

  await expect(page.getByText(firstComment)).toBeVisible()
  await expect(page.getByText(secondComment)).toBeVisible()
  await expect(page.locator('.annotation-details').filter({ hasText: firstComment }).getByText('Start', { exact: true })).toBeVisible()
  await expect(page.locator('.annotation-details').filter({ hasText: secondComment }).getByText('PaperSmith', { exact: true })).toBeVisible()
})

test('PaperSmith downloads revision feedback markdown for Codex', async ({ page }) => {
  const suffix = Date.now()
  const localComment = `rewrite this marked wording ${suffix}`
  const overallComment = `make unmarked text more academic ${suffix}`

  await page.goto(APP_URL)

  const annotationResponse = await page.request.post(`${APP_URL}/api/annotations`, {
    data: {
      type: 'clarity',
      comment: localComment,
      selection: {
        text: 'You',
        range: { from: 1, to: 4 },
        docVersion: 1
      }
    }
  })
  expect(annotationResponse.ok()).toBe(true)

  await page.reload()
  await page.getByLabel('Overall comment').fill(overallComment)
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Copy feedback' }).click()
  ])

  expect(download.suggestedFilename()).toBe('papersmith-feedback.md')
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copy feedback' })).toBeVisible({ timeout: 4000 })

  const downloadPath = await download.path()
  const fileText = await readFile(downloadPath, 'utf8')
  expect(fileText).toContain('# PaperSmith Revision Feedback')
  expect(fileText).toContain('请严格区分局部批注与整体批注的作用范围。')
  expect(fileText).toContain('Overall Comment 只适用于未被 Local Comments 覆盖的其他内容。')
  expect(fileText).toContain(overallComment)
  expect(fileText).toContain('标注文本：You')
  expect(fileText).toContain(`Comment：请按这个要求改这部分：${localComment}`)
})
