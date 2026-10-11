from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.set_viewport_size({"width": 375, "height": 812})
    page.goto("http://localhost:3000/test-dialog")
    page.wait_for_timeout(2000)

    # We click LOA button
    loa_btn = page.locator('button', has_text='Request Leave')
    if not loa_btn.is_visible():
        loa_btn = page.locator('button', has_text='LOA')
    if loa_btn.is_visible():
        loa_btn.click()
        page.wait_for_timeout(1000)
    else:
        # Fallback to general interaction
        loa_btn = page.locator('button.bg-orange-500')
        if loa_btn.is_visible():
            loa_btn.click()
            page.wait_for_timeout(1000)

    # Press Tab to see focus visible logic
    page.keyboard.press("Tab")
    page.wait_for_timeout(500)
    page.keyboard.press("Tab")
    page.wait_for_timeout(500)

    page.screenshot(path="/home/jules/verification/screenshots/verification.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(record_video_dir="/home/jules/verification/videos")
        # Bypass clerk middleware checks if any
        context.add_cookies([{"name": "__clerk_db_jwt", "value": "dummy", "domain": "localhost", "path": "/"}])
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
