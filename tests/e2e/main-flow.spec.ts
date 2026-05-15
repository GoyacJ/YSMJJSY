import { expect, test } from '@playwright/test'

test('creates a key, configures profile, chats, designs, and re-enters', async ({ page }, testInfo) => {
  const runId = Date.now()
  const key = `e2e-${testInfo.project.name}-${runId}`
  const forwardedIp = `e2e-${testInfo.project.name}-${runId}`

  await page.setExtraHTTPHeaders({ 'x-forwarded-for': forwardedIp })

  await page.route('**/api/chat', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ reply: '这句我会记得。' }),
    })
  })
  await page.route('**/api/design/preview', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        schema: {
          version: 1,
          theme: 'moon-note',
          palette: 'midnight',
          title: '银河信笺',
          subtitle: '把这一页改成更像星空的样子。',
          sections: [
            { type: 'letter', layout: 'star-trail', text: '这是一段由设计模式生成的预览。' },
            { type: 'star-scene', density: 0.8, caption: '保存后，这片星空会留在这把钥匙里。' },
          ],
        },
      }),
    })
  })

  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: '创建钥匙' }).click()
  await page.getByPlaceholder('写下新钥匙').fill(key)
  const createResponse = page.waitForResponse(response =>
    response.url().includes('/api/keys') && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: '保存钥匙' }).click()
  expect((await createResponse).ok()).toBe(true)

  await expect(page.getByLabel('星信设定')).toBeVisible()
  await page.getByRole('textbox', { name: '称呼' }).fill('月光')
  await page.getByRole('combobox', { name: 'MBTI' }).selectOption('INFJ')
  await page.getByRole('button', { name: '保存设定' }).click()

  await expect(page.getByLabel('信件正文')).toBeVisible()
  await expect(page.getByText('写给你', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '去看星空' }).click()
  await expect(page.getByLabel('钥匙页面')).toBeVisible()
  await expect(page.getByRole('complementary', { name: '星信' })).toBeVisible()

  await page.getByLabel('和星信说话').fill('这封信是真的吗？')
  await page.getByRole('button', { name: '发送' }).click()
  await expect(page.getByText('这句我会记得。')).toBeVisible()

  await page.getByRole('button', { name: '设计模式' }).click()
  await page.getByPlaceholder('请输入你的创意想法').fill('把页面改成银河和月光')
  await page.getByRole('button', { name: '发送' }).click()
  await expect(page.getByText('银河信笺')).toBeVisible()
  await page.getByRole('button', { name: '保存这个设计' }).click()
  await expect(page.getByText('保存后，这片星空会留在这把钥匙里。')).toBeVisible()

  await page.getByRole('button', { name: '打开设置' }).click()
  await expect(page.getByRole('dialog', { name: '星信设置' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: '称呼' })).toHaveValue('月光')
  await expect(page.getByRole('combobox', { name: 'MBTI' })).toHaveValue('INFJ')
  await page.getByRole('button', { name: '关闭设置' }).click()

  await page.reload()
  await page.waitForLoadState('networkidle')
  await page.getByPlaceholder('输入钥匙').fill(key)
  await expect(page.getByPlaceholder('输入钥匙')).toHaveValue(key)
  const unlockResponse = page.waitForResponse(response =>
    response.url().includes('/api/unlock') && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: '打开这封信' }).click()
  expect((await unlockResponse).ok()).toBe(true)
  await expect(page.getByLabel('星信设定')).toHaveCount(0)
  await expect(page.getByLabel('信件正文')).toBeVisible()
})
