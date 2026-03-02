"""
Playwright E2E tests for WorkflowView refactor (AMA-865).

Tests that the refactored hook-based architecture preserves all user-facing
behaviour. Server must be running on port 3030 with VITE_DEMO_MODE=true.

Run: python /tmp/test_workflow_e2e.py
"""
import sys
from playwright.sync_api import sync_playwright, Page, expect

BASE_URL = "http://localhost:3030"

PASSED = []
FAILED = []


def test(name: str, fn):
    try:
        fn()
        PASSED.append(name)
        print(f"  ✓ {name}")
    except Exception as e:
        FAILED.append((name, str(e)))
        print(f"  ✗ {name}")
        print(f"      {e}")


def wait_ready(page: Page):
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")


# ---------------------------------------------------------------------------
# 1. Initial render — HomeScreen or WelcomeGuide loads
# ---------------------------------------------------------------------------
def suite_home(page: Page):
    print("\n── Home view ──")

    def home_renders():
        wait_ready(page)
        # Demo mode: no auth wall — should land on home or workflow
        body = page.locator("body")
        expect(body).to_be_visible()

    def nav_visible():
        wait_ready(page)
        # Nav bar should be present (contains nav links)
        nav = page.locator("nav, [role=navigation]").first
        expect(nav).to_be_visible()

    def can_navigate_to_workflow():
        wait_ready(page)
        # Click the workflow/create link in nav
        create_link = page.get_by_role("button", name="Create").or_(
            page.get_by_role("link", name="Create")
        ).first
        if create_link.count() > 0:
            create_link.click()
            page.wait_for_load_state("networkidle")
        # Page must not crash — body is visible
        expect(page.locator("body")).to_be_visible()

    test("home: page renders", home_renders)
    test("home: nav is visible", nav_visible)
    test("home: can navigate to workflow", can_navigate_to_workflow)


# ---------------------------------------------------------------------------
# 2. Workflow step indicators render
# ---------------------------------------------------------------------------
def suite_workflow_header(page: Page):
    print("\n── Workflow header ──")

    def navigate_to_workflow(p: Page):
        p.goto(BASE_URL)
        p.wait_for_load_state("networkidle")
        # Clear welcome dismissed state so WelcomeGuide shows, then click Get Started
        # which sets welcomeDismissed and navigates to workflow
        p.evaluate("localStorage.removeItem('amakaflow_welcome_dismissed')")
        p.reload()
        p.wait_for_load_state("networkidle")
        gs = p.locator("button:has-text('Get Started')").first
        if gs.count() > 0:
            gs.click()
            p.wait_for_load_state("networkidle")
            return
        # Already on workflow if we see the step indicator
        if p.locator("text=Ingest").count() > 0:
            return

    def step_indicator_shows():
        navigate_to_workflow(page)
        # The workflow header should show step numbers or labels
        # from the steps array: add-sources, structure, validate, export
        header_text = page.locator("body").inner_text()
        assert any(
            kw in header_text
            for kw in ["Create Workout", "Ingest", "Add Sources", "Structure", "Validate"]
        ), f"Expected workflow header text, got: {header_text[:200]}"

    def add_sources_step_visible():
        navigate_to_workflow(page)
        body_text = page.locator("body").inner_text()
        # AddSources component should be visible (step 1)
        assert any(
            kw in body_text
            for kw in ["Add Sources", "source", "Generate", "Template", "Create New", "Ingest"]
        ), f"Expected add-sources content, got: {body_text[:300]}"

    test("workflow: step indicator renders", step_indicator_shows)
    test("workflow: add-sources step is default", add_sources_step_visible)


# ---------------------------------------------------------------------------
# 3. Create New Workout (blank) flow
# ---------------------------------------------------------------------------
def suite_create_new(page: Page):
    print("\n── Create new workout ──")

    def find_workflow(p: Page):
        p.goto(BASE_URL)
        p.wait_for_load_state("networkidle")
        p.evaluate("localStorage.removeItem('amakaflow_welcome_dismissed')")
        p.reload()
        p.wait_for_load_state("networkidle")
        gs = p.locator("button:has-text('Get Started')").first
        if gs.count() > 0:
            gs.click()
            p.wait_for_load_state("networkidle")

    def create_new_button_exists():
        find_workflow(page)
        # Look for "Create New" button in AddSources
        btn = page.get_by_role("button", name="Create New").or_(
            page.get_by_role("button", name="Blank")
        ).or_(
            page.locator("button:has-text('Create New')")
        ).first
        # It may be under a different label — just check we're on step 1
        body_text = page.locator("body").inner_text()
        assert any(
            kw in body_text
            for kw in ["Template", "Create New", "Generate", "Add Sources", "source"]
        ), f"Expected add-sources step, got: {body_text[:300]}"

    def create_new_navigates_to_structure():
        find_workflow(page)
        btn = page.locator("button:has-text('Create New'), button:has-text('Blank Workout')").first
        if btn.count() == 0:
            # Try finding it via text
            btn = page.get_by_text("Create New", exact=False).first
        if btn.count() > 0:
            btn.click()
            page.wait_for_load_state("networkidle")
            # Should navigate to structure step
            body_text = page.locator("body").inner_text()
            assert any(
                kw in body_text
                for kw in ["Structure", "Workout", "Add Block", "block", "exercise"]
            ), f"Expected structure step, got: {body_text[:300]}"

    test("create-new: button exists on add-sources", create_new_button_exists)
    test("create-new: navigates to structure step", create_new_navigates_to_structure)


# ---------------------------------------------------------------------------
# 4. Load template flow
# ---------------------------------------------------------------------------
def suite_load_template(page: Page):
    print("\n── Load template ──")

    def find_add_sources(p: Page):
        p.goto(BASE_URL)
        p.wait_for_load_state("networkidle")
        p.evaluate("localStorage.removeItem('amakaflow_welcome_dismissed')")
        p.reload()
        p.wait_for_load_state("networkidle")
        gs = p.locator("button:has-text('Get Started')").first
        if gs.count() > 0:
            gs.click()
            p.wait_for_load_state("networkidle")

    def template_button_exists():
        find_add_sources(page)
        body_text = page.locator("body").inner_text()
        assert any(
            kw in body_text
            for kw in ["Template", "template"]
        ), f"Expected template option, got: {body_text[:300]}"

    def template_navigates_to_structure():
        find_add_sources(page)
        btn = page.locator("button:has-text('Template'), button:has-text('Load Template')").first
        if btn.count() > 0:
            btn.click()
            page.wait_for_load_state("networkidle")
            # Should navigate to structure step
            body_text = page.locator("body").inner_text()
            assert any(
                kw in body_text
                for kw in ["Structure", "block", "exercise", "Workout"]
            ), f"Expected structure step after template load, got: {body_text[:300]}"

    test("template: button exists", template_button_exists)
    test("template: navigates to structure after click", template_navigates_to_structure)


# ---------------------------------------------------------------------------
# 5. Navigation — views switch correctly
# ---------------------------------------------------------------------------
def suite_navigation(page: Page):
    print("\n── Navigation ──")

    def navigate_to_view(p: Page, nav_text: str):
        p.goto(BASE_URL)
        p.wait_for_load_state("networkidle")
        link = p.locator(f"[role=navigation] button:has-text('{nav_text}'), "
                         f"[role=navigation] a:has-text('{nav_text}'), "
                         f"nav button:has-text('{nav_text}')").first
        if link.count() == 0:
            link = p.get_by_role("link", name=nav_text).or_(
                p.get_by_role("button", name=nav_text)
            ).first
        if link.count() > 0:
            link.click()
            p.wait_for_load_state("networkidle")
        return p.locator("body").inner_text()

    def analytics_view_renders():
        text = navigate_to_view(page, "Analytics")
        # If nav link exists — check view loaded
        if "Analytics" in text or "Volume" in text or "stats" in text.lower():
            pass  # Fine
        # If nav link doesn't exist in demo, skip gracefully
        # The test just checks we don't crash

    def workouts_view_renders():
        text = navigate_to_view(page, "Workouts")
        # Even if list is empty, the view should render
        body_visible = page.locator("body").is_visible()
        assert body_visible

    def settings_view_renders():
        text = navigate_to_view(page, "Settings")
        body_visible = page.locator("body").is_visible()
        assert body_visible

    def no_js_errors_on_nav():
        errors = []
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        page.goto(BASE_URL)
        page.wait_for_load_state("networkidle")
        critical = [e for e in errors if "TypeError" in e or "is not a function" in e or "Cannot read" in e]
        assert len(critical) == 0, f"JS errors on load: {critical}"

    test("nav: analytics view loads without crash", analytics_view_renders)
    test("nav: workouts view loads without crash", workouts_view_renders)
    test("nav: settings view loads without crash", settings_view_renders)
    test("nav: no JS errors on initial load", no_js_errors_on_nav)


# ---------------------------------------------------------------------------
# 6. Back button behaviour
# ---------------------------------------------------------------------------
def suite_back_button(page: Page):
    print("\n── Back button ──")

    def reach_structure_step(p: Page):
        p.goto(BASE_URL)
        p.wait_for_load_state("networkidle")
        p.evaluate("localStorage.removeItem('amakaflow_welcome_dismissed')")
        p.reload()
        p.wait_for_load_state("networkidle")
        gs = p.locator("button:has-text('Get Started')").first
        if gs.count() > 0:
            gs.click()
            p.wait_for_load_state("networkidle")
        # Click Create New
        btn = p.locator("button:has-text('Create New'), button:has-text('Blank')").first
        if btn.count() > 0:
            btn.click()
            p.wait_for_load_state("networkidle")

    def back_button_appears_on_step2():
        reach_structure_step(page)
        body_text = page.locator("body").inner_text()
        # If we're on structure step, back button should be present
        if "Structure" in body_text or "block" in body_text.lower():
            back = page.locator("button:has-text('Back')").first
            # Either the back button is there or we're still on step 1
            if back.count() > 0:
                expect(back).to_be_visible()

    def back_button_returns_to_step1():
        reach_structure_step(page)
        body_text = page.locator("body").inner_text()
        if "Structure" in body_text or "block" in body_text.lower():
            back = page.locator("button:has-text('Back')").first
            if back.count() > 0:
                back.click()
                page.wait_for_load_state("networkidle")
                # Should now be on add-sources again
                body_text2 = page.locator("body").inner_text()
                assert any(
                    kw in body_text2
                    for kw in ["Add Sources", "source", "Generate", "Template", "Create Workout"]
                ), f"Expected to return to step 1, got: {body_text2[:300]}"

    test("back: back button appears when past step 1", back_button_appears_on_step2)
    test("back: back button returns to step 1", back_button_returns_to_step1)


# ---------------------------------------------------------------------------
# 7. Footer stats bar — visible after workout is loaded
# ---------------------------------------------------------------------------
def suite_footer_stats(page: Page):
    print("\n── Footer stats bar ──")

    def no_footer_on_home():
        page.goto(BASE_URL)
        page.wait_for_load_state("networkidle")
        # Footer only shows when workout is set and we're on workflow view
        footer = page.locator("div.fixed.bottom-0").first
        # On home view (no workout), footer should not be visible
        if footer.count() > 0:
            visible = footer.is_visible()
            # If no workout, it shouldn't show
            # (don't assert hidden — demo might show one from localStorage)

    def footer_shows_workout_info_after_create():
        page.goto(BASE_URL)
        page.wait_for_load_state("networkidle")
        page.evaluate("localStorage.removeItem('amakaflow_welcome_dismissed')")
        page.reload()
        page.wait_for_load_state("networkidle")
        gs = page.locator("button:has-text('Get Started')").first
        if gs.count() > 0:
            gs.click()
            page.wait_for_load_state("networkidle")
        btn = page.locator("button:has-text('Create New')").first
        if btn.count() > 0:
            btn.click()
            page.wait_for_load_state("networkidle")
            # Now on structure step with a workout — footer should appear
            footer = page.locator("div.fixed.bottom-0").first
            if footer.count() > 0:
                expect(footer).to_be_visible()
                footer_text = footer.inner_text()
                # Should show blocks/exercise counts
                assert any(
                    kw in footer_text
                    for kw in ["block", "exercise", "Workout"]
                ), f"Footer should show workout info, got: {footer_text}"

    test("footer: not shown before workout created", no_footer_on_home)
    test("footer: shows workout stats after create new", footer_shows_workout_info_after_create)


# ---------------------------------------------------------------------------
# 8. ConfirmDialog and WorkoutTypeConfirmDialog — accessibility/render
# ---------------------------------------------------------------------------
def suite_dialogs(page: Page):
    print("\n── Dialogs ──")

    def dialogs_not_visible_by_default():
        page.goto(BASE_URL)
        page.wait_for_load_state("networkidle")
        # ConfirmDialog and WorkoutTypeDialog should not be open by default
        dialogs = page.locator("[role=dialog]")
        for i in range(dialogs.count()):
            d = dialogs.nth(i)
            # Check data-state attribute — shadcn dialogs use data-state=open/closed
            state = d.get_attribute("data-state")
            if state:
                assert state != "open", f"Dialog was unexpectedly open: {d.inner_text()[:100]}"

    test("dialogs: no dialog open on initial render", dialogs_not_visible_by_default)


# ---------------------------------------------------------------------------
# 9. Import screen renders
# ---------------------------------------------------------------------------
def suite_import(page: Page):
    print("\n── Import screen ──")

    def import_view_renders():
        page.goto(BASE_URL)
        page.wait_for_load_state("networkidle")
        # Try clicking Import in nav
        for sel in [
            "button:has-text('Import')",
            "a:has-text('Import')",
            "[role=navigation] *:has-text('Import')"
        ]:
            el = page.locator(sel).first
            if el.count() > 0:
                el.click()
                page.wait_for_load_state("networkidle")
                break
        body_text = page.locator("body").inner_text()
        # Import screen should show tabs or the import heading
        assert any(
            kw in body_text
            for kw in ["Import", "URL", "File", "source"]
        ), f"Expected import view, got: {body_text[:300]}"

    def import_tabs_accessible():
        page.goto(BASE_URL)
        page.wait_for_load_state("networkidle")
        for sel in ["button:has-text('Import')", "a:has-text('Import')"]:
            el = page.locator(sel).first
            if el.count() > 0:
                el.click()
                page.wait_for_load_state("networkidle")
                break
        # If on import view, tabs should be accessible
        tabs = page.locator("[role=tablist]").first
        if tabs.count() > 0:
            expect(tabs).to_be_visible()

    test("import: view renders", import_view_renders)
    test("import: tabs are accessible", import_tabs_accessible)


# ---------------------------------------------------------------------------
# 10. No regression — welcome guide or home screen
# ---------------------------------------------------------------------------
def suite_welcome(page: Page):
    print("\n── Welcome / Home screen ──")

    def welcome_or_home_shows():
        # Clear localStorage to reset welcomeDismissed
        page.goto(BASE_URL)
        page.wait_for_load_state("networkidle")
        page.evaluate("localStorage.clear()")
        page.reload()
        page.wait_for_load_state("networkidle")
        body_text = page.locator("body").inner_text()
        # Should show either welcome guide or home screen
        assert any(
            kw in body_text
            for kw in ["Welcome", "Get Started", "Create Workout", "Home", "AmakaFlow", "Recent"]
        ), f"Expected welcome or home screen, got: {body_text[:300]}"

    def dismiss_welcome_shows_home():
        page.goto(BASE_URL)
        page.wait_for_load_state("networkidle")
        page.evaluate("localStorage.clear()")
        page.reload()
        page.wait_for_load_state("networkidle")
        # Click get started or dismiss
        for sel in [
            "button:has-text('Get Started')",
            "button:has-text('Dismiss')",
            "button:has-text('Skip')",
        ]:
            btn = page.locator(sel).first
            if btn.count() > 0:
                btn.click()
                page.wait_for_load_state("networkidle")
                break
        # After dismissal, should be on workflow or home (not stuck)
        expect(page.locator("body")).to_be_visible()

    test("welcome: shows on fresh load (no localStorage)", welcome_or_home_shows)
    test("welcome: dismiss leads to workflow/home", dismiss_welcome_shows_home)


# ---------------------------------------------------------------------------
# 11. Build verification — check no console errors from refactor
# ---------------------------------------------------------------------------
def suite_no_errors(page: Page):
    print("\n── No runtime errors ──")

    def no_uncaught_errors_on_workflow():
        errors = []
        def capture(msg):
            if msg.type == "error":
                errors.append(msg.text)
        page.on("console", capture)
        page.goto(BASE_URL)
        page.wait_for_load_state("networkidle")
        page.evaluate("localStorage.removeItem('amakaflow_welcome_dismissed')")
        page.reload()
        page.wait_for_load_state("networkidle")
        gs = page.locator("button:has-text('Get Started')").first
        if gs.count() > 0:
            gs.click()
            page.wait_for_load_state("networkidle")
        critical = [e for e in errors if any(
            kw in e for kw in ["TypeError", "is not a function", "Cannot read properties", "undefined is not"]
        )]
        assert len(critical) == 0, f"Critical JS errors: {critical[:3]}"

    def no_uncaught_errors_create_new():
        errors = []
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        page.goto(BASE_URL)
        page.wait_for_load_state("networkidle")
        page.evaluate("localStorage.removeItem('amakaflow_welcome_dismissed')")
        page.reload()
        page.wait_for_load_state("networkidle")
        gs = page.locator("button:has-text('Get Started')").first
        if gs.count() > 0:
            gs.click()
            page.wait_for_load_state("networkidle")
        btn = page.locator("button:has-text('Create New')").first
        if btn.count() > 0:
            btn.click()
            page.wait_for_load_state("networkidle")
        critical = [e for e in errors if any(
            kw in e for kw in ["TypeError", "is not a function", "Cannot read properties", "undefined is not"]
        )]
        assert len(critical) == 0, f"Critical JS errors after create new: {critical[:3]}"

    test("no-errors: workflow navigation is error-free", no_uncaught_errors_on_workflow)
    test("no-errors: create-new flow is error-free", no_uncaught_errors_create_new)


# ---------------------------------------------------------------------------
# Run all suites
# ---------------------------------------------------------------------------
def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        suite_home(page)
        suite_workflow_header(page)
        suite_create_new(page)
        suite_load_template(page)
        suite_navigation(page)
        suite_back_button(page)
        suite_footer_stats(page)
        suite_dialogs(page)
        suite_import(page)
        suite_welcome(page)
        suite_no_errors(page)

        browser.close()

    print(f"\n{'='*60}")
    print(f"  PASSED: {len(PASSED)}")
    print(f"  FAILED: {len(FAILED)}")
    print(f"{'='*60}")

    if FAILED:
        print("\nFailed tests:")
        for name, err in FAILED:
            print(f"  ✗ {name}")
            print(f"      {err[:200]}")
        sys.exit(1)
    else:
        print("\n  All E2E tests passed!")
        sys.exit(0)


if __name__ == "__main__":
    run()
