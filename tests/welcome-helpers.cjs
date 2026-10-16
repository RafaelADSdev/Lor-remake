// Match presentation settings live behind the lobby's native disclosure.
async function selectMatchSetting(page, selector, value) {
  const settings = page.locator(".welcome-settings");
  if (!(await settings.evaluate((element) => element.open)))
    await settings.locator("summary").click();
  await page.locator(selector).selectOption(value);
}

module.exports = { selectMatchSetting };
