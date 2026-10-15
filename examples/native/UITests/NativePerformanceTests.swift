import XCTest

final class NativePerformanceTests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testLaunchPerformance() {
        let app = XCUIApplication()
        let options = XCTMeasureOptions()
        options.iterationCount = 5

        measure(metrics: [XCTApplicationLaunchMetric(waitUntilResponsive: true)], options: options) {
            app.launch()
            XCTAssertTrue(app.buttons["Toggle details"].waitForExistence(timeout: 10))
            app.terminate()
        }
    }

    @MainActor
    func testTogglePerformance() {
        let app = XCUIApplication()
        app.launch()
        defer { app.terminate() }

        let button = app.buttons["Toggle details"].firstMatch
        let collapsed = app.staticTexts["Tap to see more."].firstMatch
        let expanded = app.staticTexts["This view and its state execute as native Swift."].firstMatch
        XCTAssertTrue(button.waitForExistence(timeout: 10))

        let options = XCTMeasureOptions()
        options.iterationCount = 5
        options.invocationOptions = [.manuallyStart]

        // Clock time includes automation and waiting for observable UI state.
        // The memory metric records the application's physical memory behavior.
        measure(metrics: [XCTClockMetric(), XCTMemoryMetric(application: app)], options: options) {
            XCTAssertTrue(collapsed.waitForExistence(timeout: 5))
            startMeasuring()
            button.activate()
            XCTAssertTrue(expanded.waitForExistence(timeout: 5))
            stopMeasuring()
            button.activate()
            XCTAssertTrue(collapsed.waitForExistence(timeout: 5))
        }
    }
}
