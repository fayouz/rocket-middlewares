// @ts-check
// Suite mode, end to end (suite/compose.yaml): sign-in to Rocket Print through Rocket Auth, administrator through
// the rocket-admins group, application switcher, Rocket Mailer then Rocket Cloud without a second sign-in, logout
// propagated to Rocket Auth.
const fs = require('node:fs')
const { test, expect } = require('@playwright/test')

const AUTH = process.env.SUITE_AUTH_URL ?? 'http://localhost:3100'
const PRINT = process.env.SUITE_PRINT_URL ?? 'http://localhost:3300'
const CLOUD = process.env.SUITE_CLOUD_URL ?? 'http://localhost:3200'
const MAILER = process.env.SUITE_MAILER_URL ?? 'http://localhost:3000'
// An LDAP account of Rocket Auth, unknown to the bricks: created at its first sign-in, administrator only
// through its directory group rocket-admins.
const EMAIL = process.env.SUITE_EMAIL ?? 'marie.martin@example.org'
const PASSWORD = process.env.SUITE_PASSWORD ?? 'password'
const ADMIN_GROUP = 'rocket-admins'

const escape = (/** @type {string} */ s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const at = (/** @type {string} */ base, path = '') => new RegExp('^' + escape(base + path))

fs.mkdirSync('screenshots', { recursive: true })

/** The signed-in user of a brick, read through its interface's /api proxy with its own token cookie. */
async function me(/** @type {import('@playwright/test').Page} */ page, /** @type {string} */ appId) {
  return page.evaluate(async (cookie) => {
    const token = document.cookie.split('; ').find(c => c.startsWith(cookie + '='))?.slice(cookie.length + 1)
    if (!token) return null
    const response = await fetch('/api/me', { headers: { Authorization: 'Bearer ' + decodeURIComponent(token), Accept: 'application/json' } })
    return response.ok ? response.json() : null
  }, `rocket_${appId}_token`)
}

test('suite: sign-in through Rocket Auth, switcher, single sign-on, logout', async ({ page }) => {
  const errors = /** @type {string[]} */ ([])
  page.on('pageerror', e => errors.push(e.message))
  // Every address the tab goes through: proves when Rocket Auth asks for a password.
  const visited = /** @type {string[]} */ ([])
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) visited.push(frame.url()) })
  const shot = (/** @type {string} */ name) => page.screenshot({ path: `screenshots/${name}.png`, fullPage: true })

  await test.step('Rocket Print sends the visitor to Rocket Auth', async () => {
    await page.goto(PRINT + '/')
    await page.waitForURL(at(AUTH, '/login'))
    await shot('1-auth-login')
  })

  await test.step('signing in at Rocket Auth lands back in Rocket Print, as administrator', async () => {
    await page.getByLabel(/e-?mail/i).fill(EMAIL)
    await page.getByLabel(/mot de passe/i).fill(PASSWORD)
    await page.getByRole('button', { name: /^se connecter$/i }).click()
    await page.waitForURL(at(PRINT, '/'))
    await expect(page).toHaveURL(new RegExp('^' + escape(PRINT) + '/?$'))

    const user = await me(page, 'print')
    expect(user?.user?.email).toBe(EMAIL)
    expect(user?.user?.groups).toContain(ADMIN_GROUP)
    expect(user?.roles).toContain('ROLE_ADMIN')
    // The administration menu is there.
    await expect(page.getByRole('link', { name: 'Utilisateurs' })).toBeVisible()
    await shot('2-print-admin')
  })

  await test.step('the switcher lists Rocket Cloud, Rocket Mailer, Rocket Print and "Mon compte"', async () => {
    // The list comes from Rocket Auth (GET /api/suite/apps), cached by the brick: reload until it is there.
    await expect(async () => {
      await page.reload()
      await page.getByTestId('app-switcher').click()
      await expect(page.getByRole('menuitem', { name: /Rocket Cloud/ })).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 90_000 })
    await expect(page.getByRole('menuitem', { name: /Rocket Mailer/ })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: /Rocket Print/ })).toBeVisible()
    const account = page.getByRole('menuitem', { name: /Mon compte/ })
    await expect(account).toBeVisible()
    await expect(account).toHaveAttribute('href', at(AUTH))
    await shot('3-switcher')
  })

  await test.step('Rocket Mailer opens from the switcher without a second sign-in', async () => {
    const passwordPages = visited.filter(url => at(AUTH, '/login').test(url)).length
    await page.getByRole('menuitem', { name: /Rocket Mailer/ }).click()
    await page.waitForURL(new RegExp('^' + escape(MAILER) + '/?$'))
    await expect(page.getByTestId('app-switcher')).toContainText('Rocket Mailer')
    // Went through Rocket Auth's authorization, never through its sign-in page again.
    expect(visited.filter(url => at(AUTH, '/login').test(url)).length).toBe(passwordPages)

    const user = await me(page, 'mailer')
    expect(user?.user?.email).toBe(EMAIL)
    expect(user?.roles).toContain('ROLE_ADMIN')
    await expect(page.getByRole('link', { name: 'Utilisateurs' })).toBeVisible()
    await shot('4-mailer')
  })

  await test.step('Rocket Cloud opens from the switcher of Rocket Mailer without a second sign-in', async () => {
    const passwordPages = visited.filter(url => at(AUTH, '/login').test(url)).length
    await page.getByTestId('app-switcher').click()
    await page.getByRole('menuitem', { name: /Rocket Cloud/ }).click()
    await page.waitForURL(new RegExp('^' + escape(CLOUD) + '/?$'))
    await expect(page.getByTestId('app-switcher')).toContainText('Rocket Cloud')
    // Went through Rocket Auth's authorization, never through its sign-in page again.
    expect(visited.filter(url => at(AUTH, '/login').test(url)).length).toBe(passwordPages)

    const user = await me(page, 'cloud')
    expect(user?.user?.email).toBe(EMAIL)
    expect(user?.roles).toContain('ROLE_ADMIN')
    await expect(page.getByRole('link', { name: 'Utilisateurs' })).toBeVisible()
    await shot('5-cloud')
  })

  await test.step('logging out of Rocket Cloud also ends the Rocket Auth session', async () => {
    await page.getByRole('button', { name: 'Se déconnecter' }).click()
    await page.waitForURL(at(CLOUD, '/login?logged_out=1'))
    await expect(page.getByText('Vous êtes déconnecté.')).toBeVisible()
    await shot('6-cloud-logged-out')

    // Signing in again: Rocket Auth asks for the password.
    await page.getByRole('button', { name: /Se connecter avec Rocket Auth/ }).click()
    await page.waitForURL(at(AUTH, '/login'))
    await expect(page.getByLabel(/mot de passe/i)).toBeVisible()
    await shot('7-auth-asks-again')
  })

  expect(errors, 'JavaScript errors on the pages').toEqual([])
})
