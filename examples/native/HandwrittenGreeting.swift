import SwiftUI

// Keep behavior and layout equivalent to examples/Greeting.svelte.
// This is the reference implementation, not generated output.
struct HandwrittenGreeting: View {
    private let title: String = "Hello from Svelocity"
    @State private var expanded: Bool = false

    var body: some View {
        VStack(spacing: 12) {
            Text(verbatim: title)
            Button(action: { expanded = !expanded }) {
                Text(verbatim: "Toggle details")
            }
            if expanded {
                Text(verbatim: "This view and its state execute as native Swift.")
            } else {
                Text(verbatim: "Tap to see more.")
            }
        }
        .padding(24)
    }
}
