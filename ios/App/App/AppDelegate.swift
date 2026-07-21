import UIKit
import Capacitor
import FirebaseCore
import FirebaseAuth
import GoogleSignIn
import UserNotifications
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, WKScriptMessageHandler, UNUserNotificationCenterDelegate {

    var window: UIWindow?
    private weak var webView: WKWebView?
    private var didInstallGoogleSignInBridge = false
    private var hasCompletedInitialActivation = false
    private var googleSignInInProgress = false
    private let googleSignInMessageHandler = "RepairSyncIOSGoogleSignIn"
    private let externalBrowserMessageHandler = "RepairSyncExternalBrowser"
    private let iosWrapperClassName = "repairsync-ios-wrapper"
    private let appDeepLinkScheme = "repairsync"
    private let hostedAppBaseURL = "https://repairsync-sms-854444042755.us-west1.run.app"
    private var pendingAppNavigationURL: URL?
    private let hostedLoginLogoDataURI = "data:image/jpeg;base64,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"

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        if FirebaseApp.app() == nil {
            FirebaseApp.configure()
        }
        UNUserNotificationCenter.current().delegate = self
        configureGoogleSignIn()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
            self.installGoogleSignInBridge(retryCount: 8)
        }
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        guard webView != nil else {
            return
        }
        if !hasCompletedInitialActivation {
            hasCompletedInitialActivation = true
            return
        }
        if googleSignInInProgress {
            NSLog("RepairSync iOS: skipping WebView refresh while Google Sign-In is in progress")
            return
        }
        DispatchQueue.main.async {
            self.refreshActiveWebView()
        }
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        if url.scheme?.lowercased() == appDeepLinkScheme {
            handleRepairSyncDeepLink(url)
            return true
        }
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        if GIDSignIn.sharedInstance.handle(url) {
            return true
        }
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        NotificationCenter.default.post(name: Notification.Name("didReceiveRemoteNotification"), object: completionHandler, userInfo: userInfo)
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .list, .sound])
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        completionHandler()
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == googleSignInMessageHandler {
            startNativeGoogleSignIn()
            return
        }

        if message.name == externalBrowserMessageHandler,
           let body = message.body as? [String: Any],
           let urlString = body["url"] as? String,
           let url = URL(string: urlString) {
            DispatchQueue.main.async {
                UIApplication.shared.open(url, options: [:]) { success in
                    NSLog("RepairSync iOS: external browser open %@ for %@", success ? "succeeded" : "failed", urlString)
                }
            }
        }
    }

    private func configureGoogleSignIn() {
        guard let clientID = FirebaseApp.app()?.options.clientID else {
            NSLog("RepairSync Google Sign-In: missing Firebase client ID")
            return
        }
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)
    }

    private func installGoogleSignInBridge(retryCount: Int) {
        guard !didInstallGoogleSignInBridge else {
            return
        }
        guard let bridgeViewController = findBridgeViewController(), let webView = bridgeViewController.webView else {
            if retryCount > 0 {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                    self.installGoogleSignInBridge(retryCount: retryCount - 1)
                }
            } else {
                NSLog("RepairSync Google Sign-In: unable to find Capacitor WKWebView")
            }
            return
        }

        self.webView = webView
        let userContentController = webView.configuration.userContentController
        userContentController.addUserScript(
            WKUserScript(
                source: nativeIOSLayoutShim(),
                injectionTime: .atDocumentStart,
                forMainFrameOnly: false
            )
        )
        userContentController.addUserScript(
            WKUserScript(
                source: nativeGoogleSignInShim(),
                injectionTime: .atDocumentEnd,
                forMainFrameOnly: false
            )
        )
        userContentController.add(self, name: googleSignInMessageHandler)
        userContentController.add(self, name: externalBrowserMessageHandler)
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.scrollIndicatorInsets = .zero
        webView.scrollView.verticalScrollIndicatorInsets = .zero
        webView.evaluateJavaScript(externalBrowserShim(), completionHandler: nil)
        webView.evaluateJavaScript(nativeIOSLayoutShim(), completionHandler: nil)
        webView.evaluateJavaScript(nativeGoogleSignInShim(), completionHandler: nil)
        didInstallGoogleSignInBridge = true
        applyPendingNavigationIfNeeded()
        NSLog("RepairSync Google Sign-In: native bridge installed")
    }

    private func findBridgeViewController() -> CAPBridgeViewController? {
        guard let rootViewController = window?.rootViewController else {
            return nil
        }

        if let bridgeViewController = rootViewController as? CAPBridgeViewController {
            return bridgeViewController
        }

        if let navigationController = rootViewController as? UINavigationController {
            return navigationController.viewControllers.compactMap { $0 as? CAPBridgeViewController }.first
        }

        return findBridgeViewController(in: rootViewController.children)
    }

    private func findBridgeViewController(in viewControllers: [UIViewController]) -> CAPBridgeViewController? {
        for viewController in viewControllers {
            if let bridgeViewController = viewController as? CAPBridgeViewController {
                return bridgeViewController
            }
            if let bridgeViewController = findBridgeViewController(in: viewController.children) {
                return bridgeViewController
            }
        }
        return nil
    }

    private func startNativeGoogleSignIn() {
        guard let rootViewController = window?.rootViewController else {
            notifyWebGoogleSignInFailed("Unable to start Google Sign-In.")
            return
        }

        googleSignInInProgress = true
        GIDSignIn.sharedInstance.signIn(withPresenting: rootViewController) { [weak self] result, error in
            guard let self else {
                return
            }

            if let error {
                self.googleSignInInProgress = false
                self.notifyWebGoogleSignInFailed(error.localizedDescription)
                return
            }

            guard let user = result?.user,
                  let idToken = user.idToken?.tokenString else {
                self.googleSignInInProgress = false
                self.notifyWebGoogleSignInFailed("Google did not return an ID token.")
                return
            }

            let accessToken = user.accessToken.tokenString
            let credential = GoogleAuthProvider.credential(withIDToken: idToken, accessToken: accessToken)
            Auth.auth().signIn(with: credential) { _, authError in
                if let authError {
                    self.googleSignInInProgress = false
                    self.notifyWebGoogleSignInFailed(authError.localizedDescription)
                    return
                }

                self.finishWebGoogleSignIn(idToken: idToken, accessToken: accessToken)
            }
        }
    }

    private func finishWebGoogleSignIn(idToken: String, accessToken: String) {
        let script = """
        (function() {
          if (typeof window.RepairSyncFinishNativeGoogleSignIn !== 'function') {
            \(nativeGoogleSignInShim())
          }
          window.RepairSyncFinishNativeGoogleSignIn(\(javascriptString(idToken)), \(javascriptString(accessToken)));
        })();
        """
        DispatchQueue.main.async {
            self.webView?.evaluateJavaScript(script) { _, error in
                self.googleSignInInProgress = false
                if let error {
                    NSLog("RepairSync Google Sign-In: web credential handoff failed: \(error.localizedDescription)")
                }
            }
        }
    }

    private func notifyWebGoogleSignInFailed(_ message: String) {
        let script = """
        window.dispatchEvent(new CustomEvent('RepairSyncNativeGoogleSignInFailed', {
          detail: { message: \(javascriptString(message)) }
        }));
        console.error('RepairSync native Google Sign-In failed:', \(javascriptString(message)));
        """
        DispatchQueue.main.async {
            self.webView?.evaluateJavaScript(script, completionHandler: nil)
        }
    }

    private func javascriptString(_ value: String) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: [value], options: []),
              let json = String(data: data, encoding: .utf8),
              json.count >= 2 else {
            return "null"
        }
        return String(json.dropFirst().dropLast())
    }

    private func nativeIOSLayoutShim() -> String {
        """
        (function() {
          if (window.__repairSyncIOSLayoutShimInstalled) {
            return;
          }
          window.__repairSyncIOSLayoutShimInstalled = true;

          var wrapperClass = \(javascriptString(iosWrapperClassName));
          var styleId = 'repairsync-ios-wrapper-layout';

          function ensureDocumentClass() {
            if (document.documentElement) {
              document.documentElement.classList.add(wrapperClass);
            }
          }

          function ensureStyle() {
            if (!document.head || document.getElementById(styleId)) {
              return;
            }
            var style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
              html.\(iosWrapperClassName) {
                background: #ffffff;
              }

              html.\(iosWrapperClassName) {
                --repair-sync-ios-safe-top: calc(env(safe-area-inset-top, 0px) + 12px);
                --repair-sync-ios-safe-bottom: env(safe-area-inset-bottom, 0px);
              }

              html.\(iosWrapperClassName) main > header:first-of-type {
                padding-top: var(--repair-sync-ios-safe-top) !important;
                height: calc(4rem + var(--repair-sync-ios-safe-top)) !important;
              }

              html.\(iosWrapperClassName) header.fixed.top-0 {
                top: 0 !important;
                padding-top: var(--repair-sync-ios-safe-top) !important;
                min-height: calc(4rem + var(--repair-sync-ios-safe-top)) !important;
              }

              html.\(iosWrapperClassName) .fixed.top-16 {
                top: calc(4rem + var(--repair-sync-ios-safe-top)) !important;
              }

              html.\(iosWrapperClassName) section.relative.pt-32,
              html.\(iosWrapperClassName) section.relative.pt-\\[calc\\(8rem\\+env\\(safe-area-inset-top\\)\\)\\] {
                padding-top: calc(8rem + var(--repair-sync-ios-safe-top)) !important;
              }

              html.\(iosWrapperClassName) .fixed.bottom-0 {
                padding-bottom: calc(var(--repair-sync-ios-safe-bottom) + 0.75rem) !important;
              }
            `;
            document.head.appendChild(style);
          }

          function install() {
            ensureDocumentClass();
            ensureStyle();
          }

          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', install, { once: true });
          }
          install();
        })();
        """
    }

    private func refreshActiveWebView() {
        guard let webView else {
            return
        }

        guard let targetURL = webView.url else {
            webView.reload()
            return
        }

        if targetURL.scheme == "capacitor" || targetURL.scheme == "ionic" || targetURL.isFileURL {
            webView.reload()
            return
        }

        var request = URLRequest(url: targetURL, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30)
        request.setValue("no-cache", forHTTPHeaderField: "Cache-Control")
        request.setValue("no-cache", forHTTPHeaderField: "Pragma")
        webView.load(request)
    }

    private func externalBrowserShim() -> String {
        """
        (function() {
          if (window.__repairSyncIOSExternalBrowserShimInstalled) {
            return;
          }
          window.__repairSyncIOSExternalBrowserShimInstalled = true;
          window.RepairSyncNativeOpenExternalUrl = function(url) {
            if (!url || !window.webkit || !window.webkit.messageHandlers || !window.webkit.messageHandlers.\(externalBrowserMessageHandler)) {
              return false;
            }
            window.webkit.messageHandlers.\(externalBrowserMessageHandler).postMessage({ url: url });
            return true;
          };
        })();
        """
    }

    private func handleRepairSyncDeepLink(_ url: URL) {
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        var targetPath = "/" + (components?.host ?? "")
        if let path = components?.path, !path.isEmpty {
            targetPath += path
        }

        var finalURLString = currentAppBaseURL() + targetPath
        if let query = components?.query, !query.isEmpty {
            finalURLString += "?" + query
        }

        guard let finalURL = URL(string: finalURLString) else {
            return
        }

        pendingAppNavigationURL = finalURL
        applyPendingNavigationIfNeeded()
    }

    private func applyPendingNavigationIfNeeded() {
        guard let targetURL = pendingAppNavigationURL, let webView else {
            return
        }
        pendingAppNavigationURL = nil
        DispatchQueue.main.async {
            webView.load(URLRequest(url: targetURL))
        }
    }

    private func currentAppBaseURL() -> String {
        if let currentURL = webView?.url,
           let scheme = currentURL.scheme,
           let host = currentURL.host {
            let port = currentURL.port.map { ":\($0)" } ?? ""
            return "\(scheme)://\(host)\(port)"
        }

        return hostedAppBaseURL
    }

    private func nativeGoogleSignInShim() -> String {
        return """
        (function() {
          if (window.__repairSyncIOSNativeGoogleShim) return;
          window.__repairSyncIOSNativeGoogleShim = true;
          var repairSyncLogo = \(javascriptString(hostedLoginLogoDataURI));

          var firebaseConfig = {
            apiKey: "AIzaSyAzzoL9F21l88FLG1MjojLtu4eRfeGKl3U",
            authDomain: "gen-lang-client-0477801246.firebaseapp.com",
            projectId: "gen-lang-client-0477801246",
            storageBucket: "gen-lang-client-0477801246.firebasestorage.app",
            messagingSenderId: "854444042755",
            appId: "1:854444042755:web:9ff42c28d0c8dddee17c36"
          };

          function patchHostedLoginUi() {
            try {
              var heading = Array.from(document.querySelectorAll("h1,h2,div,p,span")).find(function(node) {
                return (node.textContent || "").trim() === "RepairSync";
              });

              var targetImage = null;
              if (heading) {
                var container = heading.parentElement;
                while (container && !targetImage) {
                  targetImage = container.querySelector("img");
                  container = container.parentElement;
                }
              }

              if (!targetImage) {
                targetImage = Array.from(document.querySelectorAll("img")).find(function(img) {
                  var rect = img.getBoundingClientRect();
                  return rect.width >= 48 && rect.height >= 48;
                }) || null;
              }

              if (targetImage) {
                if (targetImage.src !== repairSyncLogo) {
                  targetImage.src = repairSyncLogo;
                }
                targetImage.srcset = "";
                targetImage.alt = "RepairSync SMS";
                targetImage.style.objectFit = "cover";
                targetImage.style.borderRadius = "20px";
              }

              Array.from(document.querySelectorAll("div,section,article,aside")).forEach(function(node) {
                var text = (node.innerText || node.textContent || "").replace(/\\s+/g, " ").trim();
                var isWarning =
                  text.indexOf("Mobile Login Issues?") !== -1 ||
                  text.indexOf("Prevent Cross-Site Tracking") !== -1;
                if (!isWarning) return;
                var nestedWarning = Array.from(node.querySelectorAll("div,section,article,aside")).some(function(child) {
                  var childText = (child.innerText || child.textContent || "").replace(/\\s+/g, " ").trim();
                  return (
                    childText.indexOf("Mobile Login Issues?") !== -1 ||
                    childText.indexOf("Prevent Cross-Site Tracking") !== -1
                  );
                });
                if (!nestedWarning) {
                  node.style.display = "none";
                }
              });
            } catch (error) {
              console.error("RepairSync hosted login patch failed:", error);
            }
          }

          patchHostedLoginUi();
          document.addEventListener("DOMContentLoaded", patchHostedLoginUi);
          if (!window.__repairSyncHostedLoginObserver) {
            window.__repairSyncHostedLoginObserver = new MutationObserver(function() {
              patchHostedLoginUi();
            });
            window.__repairSyncHostedLoginObserver.observe(document.documentElement, {
              childList: true,
              subtree: true
            });
            window.setInterval(patchHostedLoginUi, 1500);
          }

          async function loadFirebaseConfig() {
            if (window.__repairSyncFirebaseConfig) {
              return window.__repairSyncFirebaseConfig;
            }
            try {
              var response = await fetch("/firebase-applet-config.json", { cache: "no-store" });
              if (response.ok) {
                window.__repairSyncFirebaseConfig = await response.json();
                console.info("RepairSync loaded live Firebase config");
                return window.__repairSyncFirebaseConfig;
              }
            } catch (error) {
              console.warn("RepairSync failed to load live Firebase config", error);
            }
            window.__repairSyncFirebaseConfig = firebaseConfig;
            return window.__repairSyncFirebaseConfig;
          }

          async function signWebFirebase(idToken, accessToken) {
            var appModule = await import("https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js");
            var authModule = await import("https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js");
            var resolvedFirebaseConfig = await loadFirebaseConfig();
            var app = appModule.getApps().length ? appModule.getApp() : appModule.initializeApp(resolvedFirebaseConfig);
            var auth = authModule.getAuth(app);
            var credential = authModule.GoogleAuthProvider.credential(idToken || null, accessToken || null);
            await authModule.signInWithCredential(auth, credential);
            window.location.reload();
          }

          window.RepairSyncFinishNativeGoogleSignIn = function(idToken, accessToken) {
            signWebFirebase(idToken, accessToken).catch(function(error) {
              console.error("RepairSync web Firebase sign-in failed:", error);
              window.dispatchEvent(new CustomEvent("RepairSyncNativeGoogleSignInFailed", {
                detail: { message: error && error.message ? error.message : String(error) }
              }));
            });
          };

          window.RepairSyncNativeGoogleSignIn = function() {
            if (!window.webkit || !window.webkit.messageHandlers || !window.webkit.messageHandlers.RepairSyncIOSGoogleSignIn) {
              return false;
            }
            window.webkit.messageHandlers.RepairSyncIOSGoogleSignIn.postMessage({ type: "googleSignIn" });
            return true;
          };

          document.addEventListener("click", function(event) {
            var target = event.target && event.target.closest ? event.target.closest("button,a,[role='button'],input[type='button'],input[type='submit']") : null;
            if (!target) return;
            var label = [
              target.innerText,
              target.textContent,
              target.value,
              target.getAttribute && target.getAttribute("aria-label"),
              target.getAttribute && target.getAttribute("title")
            ].filter(Boolean).join(" ").toLowerCase();
            if (label.indexOf("google") === -1) return;
            if (!window.RepairSyncNativeGoogleSignIn()) return;
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
          }, true);
        })();
        """
    }

}
