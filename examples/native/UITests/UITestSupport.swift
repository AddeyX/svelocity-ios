import XCTest

extension XCUIElement {
    @MainActor
    func activate() {
        #if os(macOS)
        click()
        #else
        tap()
        #endif
    }
}
