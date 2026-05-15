import { expect, test } from '@playwright/test'

test('unlocks the letter and reaches the star chat', async ({ page }) => {
  await page.route('**/api/chat', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ reply: '这句我会记得。' }),
    })
  })

  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await page.getByPlaceholder('输入钥匙').fill('000000')
  await page.getByRole('button', { name: '打开这封信' }).click()
  await expect(page.getByRole('alert')).toContainText('这不是这封信的钥匙。')

  await page.getByPlaceholder('输入钥匙').fill('100522')
  await page.getByRole('button', { name: '打开这封信' }).click()
  await expect(page.getByLabel('信件正文')).toBeVisible()
  await expect(page.getByText('写给你', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: '去看星空' }).click()
  await expect(page.getByLabel('星空告白')).toBeVisible()
  await expect(page.getByRole('complementary', { name: '星信' })).toBeVisible()

  await page.getByLabel('和星信说话').fill('这封信是真的吗？')
  await page.getByRole('button', { name: '发送' }).click()
  await expect(page.getByText('这句我会记得。')).toBeVisible()
})
