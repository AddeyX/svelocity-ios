import XCTest

final class NativeSmokeTests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testButtonUpdatesConditionalContent() {
        let app = XCUIApplication()
        app.launch()
        defer { app.terminate() }

        XCTAssertTrue(app.staticTexts["Hello from Svelocity"].waitForExistence(timeout: 10))
        let button = app.buttons["Toggle details"].firstMatch
        let collapsed = app.staticTexts["Tap to see more."].firstMatch
        let expanded = app.staticTexts["This view and its state execute as native Swift."].firstMatch

        XCTAssertTrue(button.waitForExistence(timeout: 5))
        XCTAssertTrue(collapsed.exists)
        XCTAssertFalse(expanded.exists)

        button.activate()
        XCTAssertTrue(expanded.waitForExistence(timeout: 5))
        XCTAssertFalse(collapsed.exists)

        button.activate()
        XCTAssertTrue(collapsed.waitForExistence(timeout: 5))
        XCTAssertFalse(expanded.exists)
    }
}
