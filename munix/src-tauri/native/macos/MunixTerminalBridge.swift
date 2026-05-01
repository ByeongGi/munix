import AppKit
import QuartzCore
import Darwin

#if MUNIX_HAS_GHOSTTY
import CGhostty
#endif

private var terminalViews: [String: TerminalSurfaceView] = [:]
public typealias TerminalEventCallback = @convention(c) (
    UnsafePointer<CChar>?,
    UnsafePointer<CChar>?,
    UnsafePointer<CChar>?
) -> Void
private var terminalEventCallback: TerminalEventCallback?

#if MUNIX_HAS_GHOSTTY
private var ghosttyInitialized = false
private var ghosttyApp: ghostty_app_t?
private weak var focusedTerminalView: TerminalSurfaceView?

private func ghosttyMods(_ flags: NSEvent.ModifierFlags) -> ghostty_input_mods_e {
    var mods: UInt32 = GHOSTTY_MODS_NONE.rawValue
    if flags.contains(.shift) { mods |= GHOSTTY_MODS_SHIFT.rawValue }
    if flags.contains(.control) { mods |= GHOSTTY_MODS_CTRL.rawValue }
    if flags.contains(.option) { mods |= GHOSTTY_MODS_ALT.rawValue }
    if flags.contains(.command) { mods |= GHOSTTY_MODS_SUPER.rawValue }
    if flags.contains(.capsLock) { mods |= GHOSTTY_MODS_CAPS.rawValue }
    return ghostty_input_mods_e(mods)
}
#endif

private final class TerminalSurfaceView: NSView, NSTextInputClient {
    let terminalId: String
    let workingDirectory: String
#if MUNIX_HAS_GHOSTTY
    private var surface: ghostty_surface_t?
    private var keyTextAccumulator: [String]?
    private var markedText = NSMutableAttributedString()
    private var trackingArea: NSTrackingArea?
#endif

    override var acceptsFirstResponder: Bool { true }
    override var wantsUpdateLayer: Bool { true }

    init(id: String, workingDirectory: String, frame: NSRect) {
        self.terminalId = id
        self.workingDirectory = workingDirectory
        super.init(frame: frame)

        wantsLayer = true
        let layer = CALayer()
        layer.backgroundColor = NSColor(
            calibratedRed: 0.02,
            green: 0.24,
            blue: 0.22,
            alpha: 0.92
        ).cgColor
        self.layer = layer
    }

    required init?(coder: NSCoder) {
        nil
    }

    override func acceptsFirstMouse(for event: NSEvent?) -> Bool {
        true
    }

    override func becomeFirstResponder() -> Bool {
#if MUNIX_HAS_GHOSTTY
        focusedTerminalView = self
        if let surface {
            ghostty_surface_set_focus(surface, true)
        }
#endif
        return true
    }

    override func resignFirstResponder() -> Bool {
#if MUNIX_HAS_GHOSTTY
        if focusedTerminalView === self {
            focusedTerminalView = nil
        }
        if let surface {
            ghostty_surface_set_focus(surface, false)
        }
#endif
        return true
    }

#if MUNIX_HAS_GHOSTTY
    deinit {
        if let trackingArea {
            removeTrackingArea(trackingArea)
        }
        if let surface {
            ghostty_surface_free(surface)
        }
    }

    func attachGhosttySurface(app: ghostty_app_t) -> String? {
        var config = ghostty_surface_config_new()
        config.platform_tag = GHOSTTY_PLATFORM_MACOS
        config.platform.macos.nsview = Unmanaged.passUnretained(self).toOpaque()
        config.userdata = Unmanaged.passUnretained(self).toOpaque()
        config.scale_factor = backingScaleFactor()

        return workingDirectory.withCString { cwd in
            config.working_directory = cwd
            guard let surface = ghostty_surface_new(app, &config) else {
                return "ghostty_surface_new failed"
            }
            self.surface = surface
            window?.acceptsMouseMovedEvents = true
            syncGhosttyGeometry()
            ghostty_surface_set_focus(surface, true)
            return nil
        }
    }

    func syncGhosttyGeometry() {
        guard let surface else { return }
        let scale = backingScaleFactor()
        let backed = convertToBacking(bounds.size)
        ghostty_surface_set_content_scale(surface, Double(scale), Double(scale))
        if backed.width > 0 && backed.height > 0 {
            ghostty_surface_set_size(surface, UInt32(backed.width), UInt32(backed.height))
        }
    }

    private func backingScaleFactor() -> Double {
        Double(window?.backingScaleFactor ?? NSScreen.main?.backingScaleFactor ?? 1.0)
    }

    override func setFrameSize(_ newSize: NSSize) {
        super.setFrameSize(newSize)
        syncGhosttyGeometry()
    }

    override func viewDidChangeBackingProperties() {
        super.viewDidChangeBackingProperties()
        syncGhosttyGeometry()
    }

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        if let trackingArea {
            removeTrackingArea(trackingArea)
        }
        let area = NSTrackingArea(
            rect: bounds,
            options: [.activeInKeyWindow, .inVisibleRect, .mouseMoved, .mouseEnteredAndExited],
            owner: self,
            userInfo: nil
        )
        trackingArea = area
        addTrackingArea(area)
    }

    override func keyDown(with event: NSEvent) {
        if handleConvenienceShortcut(event) {
            return
        }

        let action = event.isARepeat ? GHOSTTY_ACTION_REPEAT : GHOSTTY_ACTION_PRESS
        let hadMarkedText = hasMarkedText()
        keyTextAccumulator = []
        defer { keyTextAccumulator = nil }

        interpretKeyEvents([event])
        syncPreedit(clearIfNeeded: hadMarkedText)

        let composing = hasMarkedText() || hadMarkedText
        if let texts = keyTextAccumulator, !texts.isEmpty {
            for text in texts {
                if Self.shouldSuppressComposingControlInput(text, composing: composing) {
                    continue
                }
                sendKey(action, event: event, text: text)
            }
        } else {
            if Self.shouldSuppressComposingControlInput(event.characters, composing: composing) {
                return
            }
            sendKey(action, event: event, text: event.characters, composing: composing)
        }
    }

    override func keyUp(with event: NSEvent) {
        sendKey(GHOSTTY_ACTION_RELEASE, event: event, text: nil)
    }

    override func flagsChanged(with event: NSEvent) {
        let mod: UInt32
        switch event.keyCode {
        case 0x39:
            mod = GHOSTTY_MODS_CAPS.rawValue
        case 0x38, 0x3C:
            mod = GHOSTTY_MODS_SHIFT.rawValue
        case 0x3B, 0x3E:
            mod = GHOSTTY_MODS_CTRL.rawValue
        case 0x3A, 0x3D:
            mod = GHOSTTY_MODS_ALT.rawValue
        case 0x37, 0x36:
            mod = GHOSTTY_MODS_SUPER.rawValue
        default:
            return
        }

        let mods = ghosttyMods(event.modifierFlags)
        let action = (mods.rawValue & mod != 0) ? GHOSTTY_ACTION_PRESS : GHOSTTY_ACTION_RELEASE
        sendKey(action, event: event, text: nil)
    }

    private func handleConvenienceShortcut(_ event: NSEvent) -> Bool {
        guard !hasMarkedText() else { return false }

        let flags = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
        guard flags.contains(.control) || flags.contains(.command) else { return false }
        guard !flags.contains(.option) else { return false }

        let characters = [
            event.charactersIgnoringModifiers,
            event.characters,
        ]
            .compactMap { $0 }
            .filter { !$0.isEmpty }

        let action: String?
        if characters.contains("+") || characters.contains("=") {
            action = "increase_font_size:1"
        } else if characters.contains("-") {
            action = "decrease_font_size:1"
        } else if characters.contains("0") {
            action = "reset_font_size"
        } else {
            action = nil
        }

        guard let action else { return false }
        guard performBindingAction(action) else { return false }
        syncGhosttyGeometry()
        return true
    }

    private func performBindingAction(_ action: String) -> Bool {
        guard let surface else { return false }
        return action.withCString { ptr in
            ghostty_surface_binding_action(surface, ptr, UInt(action.utf8.count))
        }
    }

    private func sendKey(
        _ action: ghostty_input_action_e,
        event: NSEvent,
        text: String?,
        composing: Bool = false
    ) {
        guard let surface else { return }

        var keyEvent = ghostty_input_key_s()
        keyEvent.action = action
        keyEvent.keycode = UInt32(event.keyCode)
        keyEvent.mods = ghosttyMods(event.modifierFlags)
        keyEvent.consumed_mods = ghosttyMods(
            event.modifierFlags.subtracting([.control, .command])
        )
        keyEvent.composing = composing
        keyEvent.text = nil
        keyEvent.unshifted_codepoint = 0

        if event.type == .keyDown || event.type == .keyUp,
           let chars = event.characters(byApplyingModifiers: []),
           let codepoint = chars.unicodeScalars.first {
            keyEvent.unshifted_codepoint = codepoint.value
        }

        if let text, !text.isEmpty, let first = text.utf8.first, first >= 0x20 {
            text.withCString { ptr in
                keyEvent.text = ptr
                _ = ghostty_surface_key(surface, keyEvent)
            }
        } else {
            _ = ghostty_surface_key(surface, keyEvent)
        }
    }

    override func doCommand(by selector: Selector) {
        // AppKit beeps for unhandled command selectors. Terminal escape handling
        // is driven by ghostty_surface_key above, so selectors are intentionally swallowed.
    }

    override func mouseDown(with event: NSEvent) {
        window?.makeFirstResponder(self)
        sendMouseButton(GHOSTTY_MOUSE_PRESS, button: GHOSTTY_MOUSE_LEFT, event: event)
    }

    override func mouseUp(with event: NSEvent) {
        sendMouseButton(GHOSTTY_MOUSE_RELEASE, button: GHOSTTY_MOUSE_LEFT, event: event)
    }

    override func rightMouseDown(with event: NSEvent) {
        window?.makeFirstResponder(self)
        sendMouseButton(GHOSTTY_MOUSE_PRESS, button: GHOSTTY_MOUSE_RIGHT, event: event)
    }

    override func rightMouseUp(with event: NSEvent) {
        sendMouseButton(GHOSTTY_MOUSE_RELEASE, button: GHOSTTY_MOUSE_RIGHT, event: event)
    }

    override func otherMouseDown(with event: NSEvent) {
        window?.makeFirstResponder(self)
        sendMouseButton(GHOSTTY_MOUSE_PRESS, button: GHOSTTY_MOUSE_MIDDLE, event: event)
    }

    override func otherMouseUp(with event: NSEvent) {
        sendMouseButton(GHOSTTY_MOUSE_RELEASE, button: GHOSTTY_MOUSE_MIDDLE, event: event)
    }

    private func sendMouseButton(
        _ state: ghostty_input_mouse_state_e,
        button: ghostty_input_mouse_button_e,
        event: NSEvent
    ) {
        guard let surface else { return }
        sendMousePosition(event)
        _ = ghostty_surface_mouse_button(surface, state, button, ghosttyMods(event.modifierFlags))
    }

    override func mouseMoved(with event: NSEvent) {
        sendMousePosition(event)
    }

    override func mouseDragged(with event: NSEvent) {
        sendMousePosition(event)
    }

    override func rightMouseDragged(with event: NSEvent) {
        sendMousePosition(event)
    }

    override func otherMouseDragged(with event: NSEvent) {
        sendMousePosition(event)
    }

    private func sendMousePosition(_ event: NSEvent) {
        guard let surface else { return }
        let pos = convert(event.locationInWindow, from: nil)
        ghostty_surface_mouse_pos(
            surface,
            Double(pos.x),
            Double(bounds.height - pos.y),
            ghosttyMods(event.modifierFlags)
        )
    }

    override func scrollWheel(with event: NSEvent) {
        guard let surface else { return }
        var x = event.scrollingDeltaX
        var y = event.scrollingDeltaY
        let precise = event.hasPreciseScrollingDeltas
        if precise {
            x *= 2
            y *= 2
        }

        var mods: Int32 = 0
        if precise {
            mods |= 0b0000_0001
        }

        let momentum: UInt8
        switch event.momentumPhase {
        case .began:
            momentum = 1
        case .stationary:
            momentum = 2
        case .changed:
            momentum = 3
        case .ended:
            momentum = 4
        case .cancelled:
            momentum = 5
        case .mayBegin:
            momentum = 6
        default:
            momentum = 0
        }
        mods |= Int32(momentum) << 1

        ghostty_surface_mouse_scroll(surface, x, y, mods)
    }

    func completeClipboardRequest(_ state: UnsafeMutableRawPointer?) -> Bool {
        guard let surface else { return false }
        guard let text = NSPasteboard.general.string(forType: .string) else { return false }
        text.withCString { ptr in
            ghostty_surface_complete_clipboard_request(surface, ptr, state, false)
        }
        return true
    }

    private func syncPreedit(clearIfNeeded: Bool = true) {
        guard let surface else { return }

        if markedText.length > 0 {
            let text = markedText.string
            text.withCString { ptr in
                ghostty_surface_preedit(surface, ptr, UInt(text.utf8.count))
            }
        } else if clearIfNeeded {
            ghostty_surface_preedit(surface, nil, 0)
        }
    }

    private static func shouldSuppressComposingControlInput(
        _ text: String?,
        composing: Bool
    ) -> Bool {
        guard composing, let text else { return false }
        let scalars = text.unicodeScalars
        guard let scalar = scalars.first,
              scalars.index(after: scalars.startIndex) == scalars.endIndex else {
            return false
        }
        return scalar.value < 0x20
    }
#endif

    func insertText(_ string: Any, replacementRange: NSRange) {
#if MUNIX_HAS_GHOSTTY
        let chars: String
        switch string {
        case let attributed as NSAttributedString:
            chars = attributed.string
        case let plain as String:
            chars = plain
        default:
            return
        }
        unmarkText()
        keyTextAccumulator?.append(chars)
        if keyTextAccumulator == nil, let surface {
            chars.withCString { ptr in
                ghostty_surface_text(surface, ptr, UInt(chars.utf8.count))
            }
        }
#endif
    }

    func setMarkedText(_ string: Any, selectedRange: NSRange, replacementRange: NSRange) {
#if MUNIX_HAS_GHOSTTY
        let chars: String
        switch string {
        case let attributed as NSAttributedString:
            chars = attributed.string
        case let plain as String:
            chars = plain
        default:
            return
        }
        markedText = NSMutableAttributedString(string: chars)
        if keyTextAccumulator == nil {
            syncPreedit()
        }
#endif
    }

    func unmarkText() {
#if MUNIX_HAS_GHOSTTY
        if markedText.length > 0 {
            markedText.mutableString.setString("")
            syncPreedit()
        }
#endif
    }

    func selectedRange() -> NSRange {
#if MUNIX_HAS_GHOSTTY
        guard let surface else { return NSRange(location: NSNotFound, length: 0) }
        var text = ghostty_text_s()
        guard ghostty_surface_read_selection(surface, &text) else {
            return NSRange(location: NSNotFound, length: 0)
        }
        defer { ghostty_surface_free_text(surface, &text) }
        return NSRange(location: Int(text.offset_start), length: Int(text.offset_len))
#else
        NSRange(location: NSNotFound, length: 0)
#endif
    }

    func markedRange() -> NSRange {
#if MUNIX_HAS_GHOSTTY
        guard markedText.length > 0 else { return NSRange(location: NSNotFound, length: 0) }
        return NSRange(location: 0, length: markedText.length)
#else
        NSRange(location: NSNotFound, length: 0)
#endif
    }

    func hasMarkedText() -> Bool {
#if MUNIX_HAS_GHOSTTY
        markedText.length > 0
#else
        false
#endif
    }

    func attributedSubstring(forProposedRange range: NSRange, actualRange: NSRangePointer?) -> NSAttributedString? {
#if MUNIX_HAS_GHOSTTY
        guard let surface, range.length > 0 else { return nil }
        var text = ghostty_text_s()
        guard ghostty_surface_read_selection(surface, &text) else { return nil }
        defer { ghostty_surface_free_text(surface, &text) }
        guard let ptr = text.text else { return nil }
        let bytes = UnsafeBufferPointer(start: ptr, count: Int(text.text_len))
        let data = Data(bytes: bytes.baseAddress!, count: bytes.count)
        guard let string = String(data: data, encoding: .utf8) else { return nil }
        return NSAttributedString(string: string)
#else
        nil
#endif
    }

    func validAttributesForMarkedText() -> [NSAttributedString.Key] { [] }

    func firstRect(forCharacterRange range: NSRange, actualRange: NSRangePointer?) -> NSRect {
#if MUNIX_HAS_GHOSTTY
        guard let surface else {
            return window?.convertToScreen(convert(bounds, to: nil)) ?? .zero
        }

        var x: Double = 0
        var y: Double = 0
        var width: Double = 0
        var height: Double = 0
        ghostty_surface_ime_point(surface, &x, &y, &width, &height)

        let viewRect = NSRect(
            x: x,
            y: bounds.height - y,
            width: range.length == 0 ? 0 : width,
            height: max(height, 1)
        )
        let windowRect = convert(viewRect, to: nil)
        return window?.convertToScreen(windowRect) ?? windowRect
#else
        .zero
#endif
    }

    func characterIndex(for point: NSPoint) -> Int { 0 }
}

private func bridgeError(_ message: String) -> UnsafeMutablePointer<CChar>? {
    strdup(message)
}

private func emitTerminalEvent(id: String, kind: String, detail: String? = nil) {
    guard let terminalEventCallback else { return }
    id.withCString { idPtr in
        kind.withCString { kindPtr in
            if let detail {
                detail.withCString { detailPtr in
                    terminalEventCallback(idPtr, kindPtr, detailPtr)
                }
            } else {
                terminalEventCallback(idPtr, kindPtr, nil)
            }
        }
    }
}

#if MUNIX_HAS_GHOSTTY
private func wakeupCallback(_ userdata: UnsafeMutableRawPointer?) {
    DispatchQueue.main.async {
        if let app = ghosttyApp {
            ghostty_app_tick(app)
        }
    }
}

private func actionCallback(
    _ app: ghostty_app_t?,
    _ target: ghostty_target_s,
    _ action: ghostty_action_s
) -> Bool {
    switch action.tag {
    case GHOSTTY_ACTION_QUIT:
        return true

    case GHOSTTY_ACTION_CLOSE_WINDOW:
        if target.tag == GHOSTTY_TARGET_SURFACE,
           let view = terminalView(for: target.target.surface) {
            terminalViews.removeValue(forKey: view.terminalId)
            view.removeFromSuperview()
            emitTerminalEvent(id: view.terminalId, kind: "closed", detail: "closeWindowAction")
            return true
        }
        return false

    case GHOSTTY_ACTION_SHOW_CHILD_EXITED:
        if target.tag == GHOSTTY_TARGET_SURFACE,
           let view = terminalView(for: target.target.surface) {
            emitTerminalEvent(
                id: view.terminalId,
                kind: "childExited",
                detail: String(action.action.child_exited.exit_code)
            )
        }
        return true

    case GHOSTTY_ACTION_INITIAL_SIZE, GHOSTTY_ACTION_SIZE_LIMIT:
        return true

    case GHOSTTY_ACTION_SET_TITLE, GHOSTTY_ACTION_SET_TAB_TITLE:
        return true

    default:
        if action.tag == GHOSTTY_ACTION_COMMAND_FINISHED,
           target.tag == GHOSTTY_TARGET_SURFACE,
           let view = terminalView(for: target.target.surface) {
            emitTerminalEvent(
                id: view.terminalId,
                kind: "commandFinished",
                detail: String(action.action.command_finished.exit_code)
            )
            return true
        }
        return false
    }
}

private func terminalView(for surface: ghostty_surface_t?) -> TerminalSurfaceView? {
    guard let surface else { return nil }
    guard let userdata = ghostty_surface_userdata(surface) else { return nil }
    return Unmanaged<TerminalSurfaceView>.fromOpaque(userdata).takeUnretainedValue()
}

private func readClipboardCallback(
    _ userdata: UnsafeMutableRawPointer?,
    _ loc: ghostty_clipboard_e,
    _ state: UnsafeMutableRawPointer?
) -> Bool {
    focusedTerminalView?.completeClipboardRequest(state) ?? false
}

private func confirmReadClipboardCallback(
    _ userdata: UnsafeMutableRawPointer?,
    _ content: UnsafePointer<CChar>?,
    _ state: UnsafeMutableRawPointer?,
    _ request: ghostty_clipboard_request_e
) {
    _ = focusedTerminalView?.completeClipboardRequest(state)
}

private func writeClipboardCallback(
    _ userdata: UnsafeMutableRawPointer?,
    _ loc: ghostty_clipboard_e,
    _ content: UnsafePointer<ghostty_clipboard_content_s>?,
    _ len: Int,
    _ confirm: Bool
) {
    guard let content, len > 0 else { return }
    let data = String(cString: content[0].data)
    NSPasteboard.general.clearContents()
    NSPasteboard.general.setString(data, forType: .string)
}

private func closeSurfaceCallback(_ userdata: UnsafeMutableRawPointer?, _ processAlive: Bool) {
    guard let userdata else { return }
    let view = Unmanaged<TerminalSurfaceView>.fromOpaque(userdata).takeUnretainedValue()
    terminalViews.removeValue(forKey: view.terminalId)
    view.removeFromSuperview()
    emitTerminalEvent(
        id: view.terminalId,
        kind: "closed",
        detail: processAlive ? "processAlive" : "processExited"
    )
}

private func ensureGhosttyApp() -> String? {
    if ghosttyApp != nil {
        return nil
    }

    if !ghosttyInitialized {
        var argv = [strdup("munix")]
        defer {
            for arg in argv {
                free(arg)
            }
        }

        guard ghostty_init(1, &argv) == GHOSTTY_SUCCESS else {
            return "ghostty_init failed"
        }
        ghosttyInitialized = true
    }

    guard let config = ghostty_config_new() else {
        return "ghostty_config_new failed"
    }
    ghostty_config_load_default_files(config)
    ghostty_config_finalize(config)
    defer { ghostty_config_free(config) }

    var runtimeConfig = ghostty_runtime_config_s(
        userdata: nil,
        supports_selection_clipboard: false,
        wakeup_cb: wakeupCallback,
        action_cb: actionCallback,
        read_clipboard_cb: readClipboardCallback,
        confirm_read_clipboard_cb: confirmReadClipboardCallback,
        write_clipboard_cb: writeClipboardCallback,
        close_surface_cb: closeSurfaceCallback
    )

    guard let app = ghostty_app_new(&runtimeConfig, config) else {
        return "ghostty_app_new failed"
    }
    ghosttyApp = app
    return nil
}
#endif

@_cdecl("munix_terminal_bridge_string_free")
public func munix_terminal_bridge_string_free(_ ptr: UnsafeMutablePointer<CChar>?) {
    free(ptr)
}

@_cdecl("munix_terminal_bridge_set_event_callback")
public func munix_terminal_bridge_set_event_callback(_ callback: TerminalEventCallback?) {
    terminalEventCallback = callback
}

@_cdecl("munix_terminal_bridge_open")
public func munix_terminal_bridge_open(
    _ parentRaw: UnsafeMutableRawPointer?,
    _ idRaw: UnsafePointer<CChar>?,
    _ cwdRaw: UnsafePointer<CChar>?
) -> UnsafeMutablePointer<CChar>? {
    guard let parentRaw else {
        return bridgeError("parent NSView is null")
    }
    guard let idRaw else {
        return bridgeError("terminal id is null")
    }

    let id = String(cString: idRaw)
    let cwd = cwdRaw.map { String(cString: $0) } ?? ""
    let parent = Unmanaged<NSView>.fromOpaque(parentRaw).takeUnretainedValue()

    if let existing = terminalViews.removeValue(forKey: id) {
        existing.removeFromSuperview()
    }

    let view = TerminalSurfaceView(
        id: id,
        workingDirectory: cwd,
        frame: NSRect(x: 0, y: 0, width: 1, height: 1)
    )
    parent.addSubview(view)
    terminalViews[id] = view
    parent.window?.makeFirstResponder(view)

#if MUNIX_HAS_GHOSTTY
    if let error = ensureGhosttyApp() {
        terminalViews.removeValue(forKey: id)
        view.removeFromSuperview()
        return bridgeError(error)
    }
    if let app = ghosttyApp, let error = view.attachGhosttySurface(app: app) {
        terminalViews.removeValue(forKey: id)
        view.removeFromSuperview()
        return bridgeError(error)
    }
#endif

    return nil
}

@_cdecl("munix_terminal_bridge_set_bounds")
public func munix_terminal_bridge_set_bounds(
    _ idRaw: UnsafePointer<CChar>?,
    _ x: Double,
    _ y: Double,
    _ width: Double,
    _ height: Double
) -> UnsafeMutablePointer<CChar>? {
    guard let idRaw else {
        return bridgeError("terminal id is null")
    }
    let id = String(cString: idRaw)
    guard let view = terminalViews[id] else {
        return bridgeError("native terminal surface \(id) not found")
    }

    view.frame = NSRect(
        x: x,
        y: y,
        width: max(width, 1.0),
        height: max(height, 1.0)
    )
    view.needsDisplay = true
#if MUNIX_HAS_GHOSTTY
    view.syncGhosttyGeometry()
#endif

    return nil
}

@_cdecl("munix_terminal_bridge_focus")
public func munix_terminal_bridge_focus(
    _ idRaw: UnsafePointer<CChar>?,
    _ focused: Bool
) -> UnsafeMutablePointer<CChar>? {
    guard let idRaw else {
        return bridgeError("terminal id is null")
    }
    let id = String(cString: idRaw)
    guard let view = terminalViews[id] else {
        return bridgeError("native terminal surface \(id) not found")
    }

    if focused {
        view.window?.makeFirstResponder(view)
    } else if view.window?.firstResponder === view {
        view.window?.makeFirstResponder(nil)
    }

    return nil
}

@_cdecl("munix_terminal_bridge_close")
public func munix_terminal_bridge_close(
    _ idRaw: UnsafePointer<CChar>?
) -> UnsafeMutablePointer<CChar>? {
    guard let idRaw else {
        return bridgeError("terminal id is null")
    }
    let id = String(cString: idRaw)
    guard let view = terminalViews.removeValue(forKey: id) else {
        return nil
    }

    view.removeFromSuperview()
    emitTerminalEvent(id: id, kind: "closed", detail: "bridgeClose")
    return nil
}
