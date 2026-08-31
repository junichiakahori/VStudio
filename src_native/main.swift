import Cocoa
import WebKit
import UniformTypeIdentifiers

@available(macOS 11.3, *)
class LogWindowController: NSWindowController, WKNavigationDelegate, WKUIDelegate {
    var webView: WKWebView!
    var appPath: String = ""
    
    convenience init(appPath: String) {
        let window = NSWindow(
            contentRect: NSRect(x: 140, y: 140, width: 1020, height: 640),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "📋 VStudio 統合ログコンソール"
        window.minSize = NSSize(width: 780, height: 420)
        window.backgroundColor = NSColor(red: 0.05, green: 0.05, blue: 0.07, alpha: 1.0)
        window.appearance = NSAppearance(named: .darkAqua)
        self.init(window: window)
        self.appPath = appPath
        setupUI()
    }
    
    func setupUI() {
        guard let win = self.window, let contentView = win.contentView else { return }
        
        let config = WKWebViewConfiguration()
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")
        config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        config.setValue(true, forKey: "allowUniversalAccessFromFileURLs")
        
        webView = WKWebView(frame: contentView.bounds, configuration: config)
        webView.autoresizingMask = [.width, .height]
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.setValue(false, forKey: "drawsBackground")
        
        contentView.addSubview(webView)
        loadLogPage()
    }
    
    func loadLogPage() {
        if let url = URL(string: "https://localhost:8443/log_console.html") {
            var req = URLRequest(url: url)
            req.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
            webView.load(req)
        }
    }
    
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let localPath = (appPath as NSString).appendingPathComponent("log_console.html")
        let localURL = URL(fileURLWithPath: localPath)
        webView.loadFileURL(localURL, allowingReadAccessTo: URL(fileURLWithPath: appPath))
    }
}

@available(macOS 11.3, *)
class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, WKDownloadDelegate, NSWindowDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var loadingContainer: NSView!
    var progressIndicator: NSProgressIndicator!
    var loadingLabel: NSTextField!
    var subLabel: NSTextField!
    var checkTimer: Timer?
    var fallbackTimer: Timer?
    var launcherProcess: Process?
    var appPath: String = ""
    var isPageLoaded: Bool = false
    var logWindowController: LogWindowController?
    var popupWindows: [NSWindowController] = []

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        
        // Find project base directory
        let bundleURL = Bundle.main.bundleURL
        let bundlePath = bundleURL.path
        let parentDir = (bundlePath as NSString).deletingLastPathComponent
        
        let candidatePaths = [
            parentDir,
            "/Users/junichiakahori/Documents/Antigravity/VStudio",
            FileManager.default.currentDirectoryPath
        ]
        
        for p in candidatePaths {
            if FileManager.default.fileExists(atPath: (p as NSString).appendingPathComponent("launcher.py")) {
                appPath = p
                break
            }
        }
        
        if appPath.isEmpty {
            appPath = "/Users/junichiakahori/Documents/Antigravity/VStudio"
        }

        // 1. Setup Mac Native Menu Bar
        setupMenuBar()

        // 2. Create Dedicated Window
        let screenSize = NSScreen.main?.frame.size ?? CGSize(width: 1440, height: 900)
        let initialWidth: CGFloat = min(1380, screenSize.width * 0.94)
        let initialHeight: CGFloat = min(880, screenSize.height * 0.90)
        
        let rect = NSRect(
            x: (screenSize.width - initialWidth) / 2,
            y: (screenSize.height - initialHeight) / 2,
            width: initialWidth,
            height: initialHeight
        )
        
        window = NSWindow(
            contentRect: rect,
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "🎙️ VStudio"
        window.isMovable = true
        window.isMovableByWindowBackground = true
        window.setFrameAutosaveName("VStudioMainWindow")
        window.delegate = self
        window.minSize = NSSize(width: 900, height: 600)
        window.backgroundColor = NSColor(red: 0.08, green: 0.08, blue: 0.11, alpha: 1.0)
        
        // 3. Setup WebView Configuration
        let config = WKWebViewConfiguration()
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")
        config.preferences.javaScriptCanOpenWindowsAutomatically = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.allowsAirPlayForMediaPlayback = true
        config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        config.setValue(true, forKey: "allowUniversalAccessFromFileURLs")

        // Add Script Message Handler for robust export/import
        let userContentController = WKUserContentController()
        userContentController.add(self, name: "nativeHost")
        config.userContentController = userContentController

        webView = WKWebView(frame: window.contentView!.bounds, configuration: config)
        webView.autoresizingMask = [.width, .height]
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.setValue(false, forKey: "drawsBackground")
        
        window.contentView?.addSubview(webView)
        
        // 4. Setup Loading Indicator
        setupLoadingUI()
        
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        
        // 5. Start Background Servers
        startBackendServices()
    }
    
    func setupMenuBar() {
        let mainMenu = NSMenu()
        
        // App Menu
        let appMenuItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "VStudio について", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "VStudio を終了", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appMenuItem.submenu = appMenu
        mainMenu.addItem(appMenuItem)
        
        // Edit Menu (Allows Copy/Paste in inputs)
        let editMenuItem = NSMenuItem()
        let editMenu = NSMenu(title: "編集")
        editMenu.addItem(withTitle: "取り消し", action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(withTitle: "やり直し", action: Selector(("redo:")), keyEquivalent: "Z")
        editMenu.addItem(NSMenuItem.separator())
        editMenu.addItem(withTitle: "カット", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "コピー", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "ペースト", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "すべて選択", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editMenuItem.submenu = editMenu
        mainMenu.addItem(editMenuItem)
        
        // View Menu
        let viewMenuItem = NSMenuItem()
        let viewMenu = NSMenu(title: "表示")
        viewMenu.addItem(withTitle: "🔄 画面を再読み込み", action: #selector(reloadPage), keyEquivalent: "r")
        viewMenu.addItem(NSMenuItem.separator())
        
        let inspectItem = NSMenuItem(title: "🛠️ 開発者ツール (Inspect Element)", action: #selector(toggleDevTools), keyEquivalent: "i")
        inspectItem.keyEquivalentModifierMask = [.command, .option]
        viewMenu.addItem(inspectItem)
        
        let logItem = NSMenuItem(title: "📋 ログウィンドウを表示", action: #selector(showLogWindow), keyEquivalent: "l")
        viewMenu.addItem(logItem)
        
        viewMenu.addItem(NSMenuItem.separator())
        viewMenu.addItem(withTitle: "フルスクリーン切り替え", action: #selector(NSWindow.toggleFullScreen(_:)), keyEquivalent: "f")
        viewMenuItem.submenu = viewMenu
        mainMenu.addItem(viewMenuItem)
        
        // Window Menu
        let windowMenuItem = NSMenuItem()
        let windowMenu = NSMenu(title: "ウィンドウ")
        windowMenu.addItem(withTitle: "最小化", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        windowMenu.addItem(withTitle: "拡大/縮小", action: #selector(NSWindow.performZoom(_:)), keyEquivalent: "")
        windowMenuItem.submenu = windowMenu
        mainMenu.addItem(windowMenuItem)
        
        NSApp.mainMenu = mainMenu
    }
    
    @objc func reloadPage() {
        loadVStudioPage()
    }
    
    @objc func toggleDevTools() {
        // Trigger WebKit Inspector
        if let inspector = webView.perform(Selector(("_inspector")))?
            .takeUnretainedValue() as? AnyObject {
            _ = inspector.perform(Selector(("show")))
        }
    }
    
    @objc func showLogWindow() {
        if logWindowController == nil {
            logWindowController = LogWindowController(appPath: appPath)
        }
        logWindowController?.showWindow(nil)
        logWindowController?.window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    func setupLoadingUI() {
        loadingContainer = NSView(frame: window.contentView!.bounds)
        loadingContainer.autoresizingMask = [.width, .height]
        loadingContainer.wantsLayer = true
        loadingContainer.layer?.backgroundColor = NSColor(red: 0.08, green: 0.08, blue: 0.11, alpha: 1.0).cgColor
        
        progressIndicator = NSProgressIndicator()
        progressIndicator.style = .spinning
        progressIndicator.controlSize = .large
        progressIndicator.sizeToFit()
        progressIndicator.frame.origin = CGPoint(
            x: (loadingContainer.bounds.width - progressIndicator.bounds.width) / 2,
            y: (loadingContainer.bounds.height - progressIndicator.bounds.height) / 2 + 25
        )
        progressIndicator.autoresizingMask = [.minXMargin, .maxXMargin, .minYMargin, .maxYMargin]
        progressIndicator.startAnimation(nil)
        loadingContainer.addSubview(progressIndicator)
        
        loadingLabel = NSTextField(labelWithString: "🎙️ VStudio 起動中...")
        loadingLabel.font = NSFont.systemFont(ofSize: 18, weight: .bold)
        loadingLabel.textColor = NSColor.white
        loadingLabel.alignment = .center
        loadingLabel.frame = NSRect(
            x: 20,
            y: progressIndicator.frame.minY - 45,
            width: loadingContainer.bounds.width - 40,
            height: 30
        )
        loadingLabel.autoresizingMask = [.width, .minXMargin, .maxXMargin, .minYMargin, .maxYMargin]
        loadingContainer.addSubview(loadingLabel)
        
        subLabel = NSTextField(labelWithString: "サーバーとLive2D画面を初期化しています...")
        subLabel.font = NSFont.systemFont(ofSize: 13, weight: .regular)
        subLabel.textColor = NSColor(white: 0.65, alpha: 1.0)
        subLabel.alignment = .center
        subLabel.frame = NSRect(
            x: 20,
            y: loadingLabel.frame.minY - 24,
            width: loadingContainer.bounds.width - 40,
            height: 20
        )
        subLabel.autoresizingMask = [.width, .minXMargin, .maxXMargin, .minYMargin, .maxYMargin]
        loadingContainer.addSubview(subLabel)
        
        window.contentView?.addSubview(loadingContainer)
    }
    
    func hideLoadingUI() {
        guard !isPageLoaded else { return }
        isPageLoaded = true
        
        if loadingContainer != nil && loadingContainer.superview != nil {
            NSAnimationContext.runAnimationGroup({ context in
                context.duration = 0.35
                loadingContainer.animator().alphaValue = 0
            }, completionHandler: { [weak self] in
                self?.loadingContainer.removeFromSuperview()
            })
        }
    }
    
    func findBestPython() -> String {
        let frameworkPy = "/Library/Frameworks/Python.framework/Versions/3.14/bin/python3"
        if FileManager.default.fileExists(atPath: frameworkPy) {
            return frameworkPy
        }
        let homeDir = NSHomeDirectory()
        let pyenvShim = "\(homeDir)/.pyenv/shims/python3"
        if FileManager.default.fileExists(atPath: pyenvShim) {
            return pyenvShim
        }
        let candidates = [
            "/usr/local/bin/python3",
            "/opt/homebrew/bin/python3",
            "/usr/bin/python3"
        ]
        for c in candidates {
            if FileManager.default.fileExists(atPath: c) {
                return c
            }
        }
        return "/usr/bin/python3"
    }
    
    func startBackendServices() {
        let launcherScript = (appPath as NSString).appendingPathComponent("launcher.py")
        let pythonPath = findBestPython()
        
        let proc = Process()
        proc.executableURL = URL(fileURLWithPath: pythonPath)
        proc.arguments = [launcherScript, "--headless"]
        proc.currentDirectoryURL = URL(fileURLWithPath: appPath)
        
        let homeDir = NSHomeDirectory()
        var env = ProcessInfo.processInfo.environment
        let extraPaths = "/Library/Frameworks/Python.framework/Versions/3.14/bin:\(homeDir)/.pyenv/shims:\(homeDir)/.pyenv/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin"
        env["PATH"] = "\(extraPaths):\(env["PATH"] ?? "")"
        proc.environment = env
        
        do {
            try proc.run()
            launcherProcess = proc
        } catch {
            print("Failed to run launcher: \(error)")
        }
        
        // Polling loop
        var attempts = 0
        checkTimer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] timer in
            guard let self = self else { return }
            attempts += 1
            if self.checkPort(8443) {
                timer.invalidate()
                self.loadVStudioPage()
            } else if attempts >= 24 {
                timer.invalidate()
                self.loadVStudioPage()
            }
        }
        
        fallbackTimer = Timer.scheduledTimer(withTimeInterval: 4.0, repeats: false) { [weak self] _ in
            self?.hideLoadingUI()
        }
    }
    
    func checkPort(_ port: Int) -> Bool {
        var addr = sockaddr_in()
        addr.sin_family = sa_family_t(AF_INET)
        addr.sin_port = in_port_t(port).bigEndian
        addr.sin_addr.s_addr = inet_addr("127.0.0.1")
        
        let sock = socket(AF_INET, SOCK_STREAM, 0)
        if sock < 0 { return false }
        defer { close(sock) }
        
        let flags = fcntl(sock, F_GETFL, 0)
        _ = fcntl(sock, F_SETFL, flags | O_NONBLOCK)
        
        let res = withUnsafePointer(to: &addr) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                connect(sock, $0, socklen_t(MemoryLayout<sockaddr_in>.size))
            }
        }
        
        if res == 0 { return true }
        
        var tv = timeval(tv_sec: 0, tv_usec: 80000)
        var fdSet = fd_set()
        fdSet.fds_bits = (0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
        let mask: Int32 = 1 << (sock % 32)
        let index = Int(sock / 32)
        withUnsafeMutablePointer(to: &fdSet.fds_bits) { ptr in
            let rawPtr = UnsafeMutableRawPointer(ptr).assumingMemoryBound(to: Int32.self)
            rawPtr[index] |= mask
        }
        
        let selectRes = select(sock + 1, nil, &fdSet, nil, &tv)
        return selectRes > 0
    }

    func loadVStudioPage() {
        if let url = URL(string: "http://localhost:8443/live2d.html") {
            // 💡 localStorage（設定値）は絶対に消さず、メモリ・ディスクキャッシュとセッションのみをクリアする
            let dataStore = WKWebsiteDataStore.default()
            let cacheTypes: Set<String> = [
                WKWebsiteDataTypeDiskCache,
                WKWebsiteDataTypeMemoryCache,
                WKWebsiteDataTypeOfflineWebApplicationCache
            ]
            
            dataStore.removeData(ofTypes: cacheTypes, modifiedSince: Date(timeIntervalSince1970: 0)) { [weak self] in
                DispatchQueue.main.async {
                    guard let self = self else { return }
                    
                    // URLにタイムスタンプ（?v=...）を付与して、Viteの古いJS/CSSキャッシュを確実にバイパスさせる
                    var mutableReq = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalAndRemoteCacheData, timeoutInterval: 10.0)
                    if let originalURL = mutableReq.url, var components = URLComponents(url: originalURL, resolvingAgainstBaseURL: false) {
                        let timestamp = String(Int(Date().timeIntervalSince1970))
                        var queryItems = components.queryItems ?? []
                        queryItems.removeAll { $0.name == "v" }
                        queryItems.append(URLQueryItem(name: "v", value: timestamp))
                        components.queryItems = queryItems
                        if let stampedURL = components.url {
                            mutableReq.url = stampedURL
                        }
                    }
                    
                    self.webView.load(mutableReq)
                }
            }
        }
    }
    
    // MARK: - WKUIDelegate: Popup Windows (window.open support for Stream Wizard, etc.)
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        let width = windowFeatures.width?.doubleValue ?? 820
        let height = windowFeatures.height?.doubleValue ?? 720
        let popupRect = NSRect(x: 100, y: 100, width: width, height: height)
        
        let popupWindow = NSWindow(
            contentRect: popupRect,
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        popupWindow.title = "🪄 VStudio ウィザード / ツール"
        popupWindow.center()
        popupWindow.backgroundColor = NSColor(red: 0.08, green: 0.09, blue: 0.12, alpha: 1.0)
        popupWindow.appearance = NSAppearance(named: .darkAqua)
        
        configuration.preferences.setValue(true, forKey: "developerExtrasEnabled")
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
        
        let popupWebView = WKWebView(frame: popupWindow.contentView!.bounds, configuration: configuration)
        popupWebView.autoresizingMask = [.width, .height]
        popupWebView.navigationDelegate = self
        popupWebView.uiDelegate = self
        popupWebView.setValue(false, forKey: "drawsBackground")
        
        popupWindow.contentView?.addSubview(popupWebView)
        popupWindow.makeKeyAndOrderFront(nil)
        
        let controller = NSWindowController(window: popupWindow)
        controller.showWindow(nil)
        popupWindows.append(controller)
        
        return popupWebView
    }
    
    func webViewDidClose(_ webView: WKWebView) {
        if let win = webView.window {
            win.close()
        }
    }
    
    // MARK: - WKUIDelegate: File Picker (<input type="file">)
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let openPanel = NSOpenPanel()
        openPanel.canChooseFiles = true
        openPanel.canChooseDirectories = parameters.allowsDirectories
        openPanel.allowsMultipleSelection = parameters.allowsMultipleSelection
        openPanel.allowsOtherFileTypes = true
        openPanel.beginSheetModal(for: self.window) { response in
            if response == .OK {
                completionHandler(openPanel.urls)
            } else {
                completionHandler(nil)
            }
        }
    }
    
    // MARK: - WKUIDelegate: JavaScript alert() & confirm()
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = NSAlert()
        alert.messageText = "🎙️ VStudio"
        alert.informativeText = message
        alert.addButton(withTitle: "OK")
        alert.beginSheetModal(for: self.window) { _ in
            completionHandler()
        }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = NSAlert()
        alert.messageText = "🎙️ VStudio"
        alert.informativeText = message
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "キャンセル")
        alert.beginSheetModal(for: self.window) { response in
            completionHandler(response == .alertFirstButtonReturn)
        }
    }
    
    // MARK: - WKDownloadDelegate & Navigation Download Handling
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, preferences: WKWebpagePreferences, decisionHandler: @escaping (WKNavigationActionPolicy, WKWebpagePreferences) -> Void) {
        if navigationAction.shouldPerformDownload {
            decisionHandler(.download, preferences)
        } else {
            decisionHandler(.allow, preferences)
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        if navigationResponse.canShowMIMEType {
            decisionHandler(.allow)
        } else {
            decisionHandler(.download)
        }
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }

    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let savePanel = NSSavePanel()
        savePanel.nameFieldStringValue = suggestedFilename
        savePanel.allowedContentTypes = [.json]
        savePanel.beginSheetModal(for: self.window) { result in
            if result == .OK {
                completionHandler(savePanel.url)
            } else {
                completionHandler(nil)
            }
        }
    }
    
    func downloadDidFinish(_ download: WKDownload) {
        let alert = NSAlert()
        alert.messageText = "🎙️ VStudio"
        alert.informativeText = "設定ファイルのエクスポートが完了しました。"
        alert.addButton(withTitle: "OK")
        alert.beginSheetModal(for: self.window) { _ in }
    }

    // MARK: - WKScriptMessageHandler (Direct Native Bridge for Export)
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "nativeHost", let body = message.body as? [String: Any], let action = body["action"] as? String else {
            return
        }
        
        if action == "saveFile" {
            let filename = (body["filename"] as? String) ?? "live2d_settings.json"
            let content = (body["content"] as? String) ?? ""
            
            let savePanel = NSSavePanel()
            savePanel.nameFieldStringValue = filename
            savePanel.allowedContentTypes = [.json]
            savePanel.beginSheetModal(for: self.window) { [weak self] response in
                guard let self = self else { return }
                if response == .OK, let targetURL = savePanel.url {
                    do {
                        try content.write(to: targetURL, atomically: true, encoding: .utf8)
                        let alert = NSAlert()
                        alert.messageText = "🎙️ VStudio"
                        alert.informativeText = "設定ファイルをエクスポートしました:\n\(targetURL.lastPathComponent)"
                        alert.addButton(withTitle: "OK")
                        alert.beginSheetModal(for: self.window) { _ in }
                    } catch {
                        let alert = NSAlert()
                        alert.messageText = "エラー"
                        alert.informativeText = "ファイルの保存に失敗しました: \(error.localizedDescription)"
                        alert.addButton(withTitle: "OK")
                        alert.beginSheetModal(for: self.window) { _ in }
                    }
                }
            }
        }
    }

    // MARK: - WKNavigationDelegate
    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        hideLoadingUI()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        hideLoadingUI()
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        hideLoadingUI()
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
            if let url = URL(string: "http://localhost:8443/live2d.html") {
                self?.webView.load(URLRequest(url: url))
            }
            self?.hideLoadingUI()
        }
    }

    // MARK: - Window Delegate & App Termination
    func windowWillClose(_ notification: Notification) {
        NSApp.terminate(nil)
    }
    
    func applicationWillTerminate(_ notification: Notification) {
        checkTimer?.invalidate()
        fallbackTimer?.invalidate()
        if let proc = launcherProcess, proc.isRunning {
            proc.terminate()
        }
        let killTask = Process()
        killTask.executableURL = URL(fileURLWithPath: "/usr/bin/pkill")
        killTask.arguments = ["-f", "launcher.py"]
        try? killTask.run()
    }
    
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }
}

// Entry point
if #available(macOS 11.3, *) {
    let app = NSApplication.shared
    let delegate = AppDelegate()
    app.delegate = delegate
    app.run()
} else {
    exit(1)
}
