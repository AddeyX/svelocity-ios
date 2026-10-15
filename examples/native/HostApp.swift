import SwiftUI

@main
struct SvelocityDemoApp: App {
    var body: some Scene {
        WindowGroup {
            #if SVELOCITY_GENERATED
            Greeting()
                #if os(macOS)
                .frame(minWidth: 420, minHeight: 240)
                #endif
            #else
            HandwrittenGreeting()
                #if os(macOS)
                .frame(minWidth: 420, minHeight: 240)
                #endif
            #endif
        }
    }
}
