package com.repairsync.sms;

import android.accounts.Account;
import android.accounts.AccountManager;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.widget.TextView;

import androidx.coordinatorlayout.widget.CoordinatorLayout;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeWebViewClient;
import com.getcapacitor.BridgeActivity;
import com.google.android.gms.auth.GoogleAuthException;
import com.google.android.gms.auth.GoogleAuthUtil;
import com.google.android.gms.auth.UserRecoverableAuthException;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.AccountPicker;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;

import java.io.IOException;

import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
  private static final String TAG = "RepairSyncGoogle";
  private static final int RC_GOOGLE_SIGN_IN = 8721;
  private static final int RC_GOOGLE_ACCOUNT_PICKER = 8722;
  private static final int RC_GOOGLE_AUTH_RECOVERY = 8723;
  private static final String GOOGLE_OAUTH_SCOPE =
    "oauth2:profile email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email";
  private static final String DEFAULT_WEB_APP_HOST =
    "repairsync.ai.studio";
  private static final String HOSTED_APP_BASE_URL =
    "https://repairsync.ai.studio";
  private static final String APP_DEEP_LINK_SCHEME = "repairsync";
  private static final String LOGIN_LOGO_DATA_URI =
    "data:image/jpeg;base64,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";
  private GoogleSignInClient googleSignInClient;
  private Account selectedGoogleAccount;
  private int androidBottomInsetPx = 0;
  private int androidTopInsetPx = 0;
  private View androidBottomInsetBanner;
  private boolean hasCompletedInitialResume = false;
  private boolean googleSignInInProgress = false;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    NotificationHelper.createMessageChannel(this);
    NotificationHelper.requestPostNotifications(this);
    PushTokenRegistrar.setRegistrationUrl(this, resolvePushRegistrationUrl());
    PushTokenRegistrar.registerCurrentToken(this);
    configureGoogleSignIn();
    installAndroidBottomInsetSpacer();
    installNativeGoogleSignInBridge();
    handleDeepLinkIntent(getIntent());
  }

  @Override
  public void onResume() {
    super.onResume();
    if (bridge == null || bridge.getWebView() == null) return;
    if (!hasCompletedInitialResume) {
      hasCompletedInitialResume = true;
      return;
    }
    if (googleSignInInProgress) {
      Log.i(TAG, "Skipping WebView reload while native Google sign-in is in progress");
      return;
    }
    WebView webView = bridge.getWebView();
    webView.post(() -> {
      webView.reload();
    });
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    handleDeepLinkIntent(intent);
  }

  @Override
  protected void onActivityResult(int requestCode, int resultCode, Intent data) {
    if (requestCode == RC_GOOGLE_SIGN_IN) {
      handleGoogleSignInResult(GoogleSignIn.getSignedInAccountFromIntent(data));
      return;
    }
    if (requestCode == RC_GOOGLE_ACCOUNT_PICKER) {
      handleGoogleAccountPicked(resultCode, data);
      return;
    }
    if (requestCode == RC_GOOGLE_AUTH_RECOVERY) {
      if (selectedGoogleAccount != null) {
        fetchGoogleAccessToken(selectedGoogleAccount);
      }
      return;
    }

    super.onActivityResult(requestCode, resultCode, data);
  }

  private void configureGoogleSignIn() {
    GoogleSignInOptions options = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
      .requestIdToken(getString(R.string.default_web_client_id))
      .requestEmail()
      .build();
    googleSignInClient = GoogleSignIn.getClient(this, options);
  }

  private void installNativeGoogleSignInBridge() {
    if (bridge == null) return;
    bridge.getWebView().addJavascriptInterface(new NativeGoogleSignInBridge(), "RepairSyncAndroid");

    bridge.setWebViewClient(new BridgeWebViewClient(bridge) {
      @Override
      public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        Uri url = request.getUrl();
        if (isGoogleOAuthUrl(url)) {
          view.stopLoading();
          startNativeGoogleSignIn();
          return true;
        }
        return super.shouldOverrideUrlLoading(view, request);
      }

      @Override
      public void onPageFinished(WebView view, String url) {
        super.onPageFinished(view, url);
        if (isAppWebUrl(Uri.parse(url))) {
          view.evaluateJavascript(androidBottomInsetShim(), null);
          view.evaluateJavascript(nativeGoogleSignInShim(), null);
        }
      }
    });
  }

  private void installAndroidBottomInsetSpacer() {
    if (bridge == null || bridge.getWebView() == null) return;

    WebView webView = bridge.getWebView();
    installAndroidBottomInsetBanner(webView);

    ViewCompat.setOnApplyWindowInsetsListener(webView, (view, insets) -> {
      int topInset = Math.max(
        insets.getInsets(WindowInsetsCompat.Type.statusBars()).top,
        insets.getInsets(WindowInsetsCompat.Type.displayCutout()).top
      );
      int bottomInset = insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom;
      int bottomClearance = bottomInset;
      int topClearance = topInset;

      androidTopInsetPx = topClearance;
      androidBottomInsetPx = bottomClearance;
      view.setPadding(
        view.getPaddingLeft(),
        0,
        view.getPaddingRight(),
        0
      );
      webView.setClipToPadding(false);
      updateWebViewMargins(view, topClearance, bottomClearance);
      updateAndroidBottomInsetBanner(bottomClearance);

      webView.evaluateJavascript(androidBottomInsetShim(), null);
      Log.i(TAG, "Android top inset " + topInset + "px, web top clearance " + topClearance
        + "px, navigation inset " + bottomInset + "px, native bottom banner " + bottomClearance + "px");
      return insets;
    });
    ViewCompat.requestApplyInsets(webView);
  }

  private void updateWebViewMargins(View webView, int topClearance, int bottomClearance) {
    ViewGroup.LayoutParams params = webView.getLayoutParams();
    if (!(params instanceof ViewGroup.MarginLayoutParams)) return;

    ViewGroup.MarginLayoutParams marginParams = (ViewGroup.MarginLayoutParams) params;
    if (marginParams.topMargin == topClearance && marginParams.bottomMargin == bottomClearance) return;

    marginParams.topMargin = topClearance;
    marginParams.bottomMargin = bottomClearance;
    webView.setLayoutParams(marginParams);
  }

  private void installAndroidBottomInsetBanner(WebView webView) {
    if (androidBottomInsetBanner != null) return;
    if (!(webView.getParent() instanceof ViewGroup)) return;

    ViewGroup parent = (ViewGroup) webView.getParent();
    TextView banner = new TextView(this);
    banner.setText("RepairSync SMS");
    banner.setTextColor(Color.rgb(107, 114, 128));
    banner.setTextSize(10);
    banner.setGravity(Gravity.TOP | Gravity.CENTER_HORIZONTAL);
    banner.setPadding(0, 1, 0, 0);
    androidBottomInsetBanner = banner;
    androidBottomInsetBanner.setBackgroundColor(Color.WHITE);
    androidBottomInsetBanner.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
    androidBottomInsetBanner.setClickable(false);

    if (parent instanceof CoordinatorLayout) {
      CoordinatorLayout.LayoutParams params = new CoordinatorLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        0
      );
      params.gravity = Gravity.BOTTOM;
      parent.addView(androidBottomInsetBanner, params);
    } else {
      ViewGroup.LayoutParams params = new ViewGroup.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        0
      );
      parent.addView(androidBottomInsetBanner, params);
    }
  }

  private void updateAndroidBottomInsetBanner(int bottomInset) {
    if (androidBottomInsetBanner == null) return;

    ViewGroup.LayoutParams params = androidBottomInsetBanner.getLayoutParams();
    if (params == null) return;

    if (params.height != bottomInset) {
      params.height = bottomInset;
      androidBottomInsetBanner.setLayoutParams(params);
    }
    androidBottomInsetBanner.setVisibility(bottomInset > 0 ? View.VISIBLE : View.GONE);
  }

  private int dpToPx(int value) {
    return Math.round(value * getResources().getDisplayMetrics().density);
  }

  private String androidBottomInsetShim() {
    return "(function(){"
      + "var style=document.getElementById('repair-sync-android-bottom-spacer-style');"
      + "if(style)style.remove();"
      + "document.documentElement.style.removeProperty('--repair-sync-android-bottom-banner');"
      + "document.querySelectorAll('.repair-sync-android-native-bottom-bar').forEach(function(node){"
      + "node.classList.remove('repair-sync-android-native-bottom-bar');"
      + "});"
      + "})();";
  }

  private boolean isAppWebUrl(Uri url) {
    String scheme = url.getScheme();
    if (scheme == null) return false;
    if (scheme.equals("capacitor") || scheme.equals("ionic") || scheme.equals("file")) {
      return true;
    }
    String host = url.getHost();
    if (host == null) return false;
    String bridgeServerUrl = getBridge() == null ? null : getBridge().getServerUrl();
    String configuredHost = bridgeServerUrl == null ? null : Uri.parse(bridgeServerUrl).getHost();
    if (configuredHost != null && configuredHost.equals(host)) {
      return true;
    }
    return DEFAULT_WEB_APP_HOST.equals(host);
  }

  private boolean isGoogleOAuthUrl(Uri url) {
    String host = url.getHost();
    if (host == null) return false;
    return host.equals("accounts.google.com") || host.endsWith(".accounts.google.com");
  }

  private String nativeGoogleSignInShim() {
    return "(function(){"
      + "if(window.__repairSyncNativeGoogleShim)return;"
      + "window.__repairSyncNativeGoogleShim=true;"
      + "var repairSyncLogo=" + JSONObject.quote(LOGIN_LOGO_DATA_URI) + ";"
      + "var firebaseConfig={"
      + "apiKey:'AIzaSyAzzoL9F21l88FLG1MjojLtu4eRfeGKl3U',"
      + "authDomain:'gen-lang-client-0477801246.firebaseapp.com',"
      + "projectId:'gen-lang-client-0477801246',"
      + "storageBucket:'gen-lang-client-0477801246.firebasestorage.app',"
      + "messagingSenderId:'854444042755',"
      + "appId:'1:854444042755:web:9ff42c28d0c8dddee17c36'"
      + "};"
      + "function patchHostedLoginUi(){"
      + "try{"
      + "var heading=Array.from(document.querySelectorAll('h1,h2,div,p,span')).find(function(node){return (node.textContent||'').trim()==='RepairSync';});"
      + "var targetImage=null;"
      + "if(heading){var container=heading.parentElement;while(container&&!targetImage){targetImage=container.querySelector('img');container=container.parentElement;}}"
      + "if(!targetImage){targetImage=Array.from(document.querySelectorAll('img')).find(function(img){var rect=img.getBoundingClientRect();return rect.width>=48&&rect.height>=48;})||null;}"
      + "if(targetImage){if(targetImage.src!==repairSyncLogo){targetImage.src=repairSyncLogo;}targetImage.srcset='';targetImage.alt='RepairSync SMS';targetImage.style.objectFit='cover';targetImage.style.borderRadius='20px';}"
      + "Array.from(document.querySelectorAll('div,section,article,aside')).forEach(function(node){"
      + "var text=(node.innerText||node.textContent||'').replace(/\\s+/g,' ').trim();"
      + "var isWarning=text.indexOf('Mobile Login Issues?')!==-1||text.indexOf('Prevent Cross-Site Tracking')!==-1;"
      + "if(!isWarning)return;"
      + "var nestedWarning=Array.from(node.querySelectorAll('div,section,article,aside')).some(function(child){"
      + "var childText=(child.innerText||child.textContent||'').replace(/\\s+/g,' ').trim();"
      + "return childText.indexOf('Mobile Login Issues?')!==-1||childText.indexOf('Prevent Cross-Site Tracking')!==-1;"
      + "});"
      + "if(!nestedWarning){node.style.display='none';}"
      + "});"
      + "}catch(error){console.error('RepairSync hosted login patch failed',error);}"
      + "}"
      + "patchHostedLoginUi();"
      + "document.addEventListener('DOMContentLoaded',patchHostedLoginUi);"
      + "if(!window.__repairSyncHostedLoginObserver){"
      + "window.__repairSyncHostedLoginObserver=new MutationObserver(function(){patchHostedLoginUi();});"
      + "window.__repairSyncHostedLoginObserver.observe(document.documentElement,{childList:true,subtree:true});"
      + "window.setInterval(patchHostedLoginUi,1500);"
      + "}"
      + "async function signWebFirebase(idToken,accessToken){"
      + "console.info('RepairSync native Firebase sign-in starting',{hasIdToken:!!idToken,hasAccessToken:!!accessToken});"
      + "var appMod=await import('https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js');"
      + "var authMod=await import('https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js');"
      + "var app=appMod.getApps().length?appMod.getApps()[0]:appMod.initializeApp(firebaseConfig);"
      + "var auth=authMod.getAuth(app);"
      + "if(authMod.browserLocalPersistence&&authMod.setPersistence){"
      + "await authMod.setPersistence(auth,authMod.browserLocalPersistence);"
      + "}"
      + "var credential=authMod.GoogleAuthProvider.credential(idToken||null,accessToken||null);"
      + "var result=await authMod.signInWithCredential(auth,credential);"
      + "console.info('RepairSync native Firebase sign-in complete',result&&result.user&&result.user.email);"
      + "if(window.RepairSyncAndroid&&window.RepairSyncAndroid.onFirebaseSignInSuccess){window.RepairSyncAndroid.onFirebaseSignInSuccess();}"
      + "window.setTimeout(function(){window.location.reload();},300);"
      + "}"
      + "window.RepairSyncFinishNativeGoogleSignIn=function(idToken,accessToken){"
      + "signWebFirebase(idToken,accessToken).catch(function(error){"
      + "console.error('RepairSync web Firebase sign-in failed',error);"
      + "if(window.RepairSyncAndroid&&window.RepairSyncAndroid.onFirebaseSignInError){window.RepairSyncAndroid.onFirebaseSignInError((error&&error.code?error.code:'')+'|'+(error&&error.message?error.message:String(error)));}"
      + "alert('Firebase sign-in failed: '+(error&&error.code?error.code:error));"
      + "});"
      + "};"
      + "window.RepairSyncNativeGoogleSignIn=function(){"
      + "try{"
      + "if(!window.RepairSyncAndroid)throw new Error('Android sign-in bridge is unavailable.');"
      + "window.RepairSyncAndroid.signInWithGoogle();"
      + "}catch(error){console.error('RepairSync native Google sign-in failed',error);}"
      + "};"
      + "document.addEventListener('click',function(event){"
      + "var target=event.target&&event.target.closest&&event.target.closest('button,a,[role=button]');"
      + "if(!target)return;"
      + "var label=(target.innerText||target.textContent||target.getAttribute('aria-label')||'').toLowerCase();"
      + "if(label.indexOf('google')===-1)return;"
      + "event.preventDefault();"
      + "event.stopImmediatePropagation();"
      + "window.RepairSyncNativeGoogleSignIn();"
      + "},true);"
      + "})();";
  }

  private void startNativeGoogleSignIn() {
    runOnUiThread(() -> {
      if (googleSignInClient == null) {
        configureGoogleSignIn();
      }
      googleSignInInProgress = true;
      Log.i(TAG, "Starting native Google sign-in");
      Intent signInIntent = googleSignInClient.getSignInIntent();
      startActivityForResult(signInIntent, RC_GOOGLE_SIGN_IN);
    });
  }

  private void handleGoogleSignInResult(Task<GoogleSignInAccount> task) {
    try {
      GoogleSignInAccount account = task.getResult(ApiException.class);
      String idToken = account == null ? null : account.getIdToken();
      if (idToken == null || idToken.isEmpty()) {
        Log.w(TAG, "Google Sign-In returned no ID token; using access-token fallback");
        startGoogleAccessTokenFallback();
        return;
      }
      Log.i(TAG, "Google Sign-In returned ID token");
      finishWebFirebaseSignIn(idToken, null);
    } catch (ApiException exception) {
      googleSignInInProgress = false;
      if (exception.getStatusCode() == 10) {
        Log.w(TAG, "Google Sign-In status 10; using access-token fallback", exception);
        startGoogleAccessTokenFallback();
        return;
      }
      Log.e(TAG, "Google Sign-In failed", exception);
      showNativeSignInError("Google sign-in failed: " + exception.getStatusCode());
    }
  }

  private void finishWebFirebaseSignIn(String idToken, String accessToken) {
    if (bridge == null) return;
    String script = "window.RepairSyncFinishNativeGoogleSignIn && "
      + "window.RepairSyncFinishNativeGoogleSignIn("
      + JSONObject.quote(idToken)
      + ","
      + JSONObject.quote(accessToken)
      + ");";
    runOnUiThread(() -> bridge.getWebView().evaluateJavascript(script, null));
  }

  private void startGoogleAccessTokenFallback() {
    runOnUiThread(() -> {
      Intent intent = AccountPicker.newChooseAccountIntent(
        null,
        null,
        new String[]{"com.google"},
        false,
        null,
        null,
        null,
        null
      );
      startActivityForResult(intent, RC_GOOGLE_ACCOUNT_PICKER);
    });
  }

  private void handleGoogleAccountPicked(int resultCode, Intent data) {
    if (resultCode != RESULT_OK || data == null) {
      googleSignInInProgress = false;
      Log.w(TAG, "Google account picker cancelled");
      showNativeSignInError("Google sign-in was cancelled.");
      return;
    }

    String accountName = data.getStringExtra(AccountManager.KEY_ACCOUNT_NAME);
    if (accountName == null || accountName.isEmpty()) {
      showNativeSignInError("No Google account was selected.");
      return;
    }

    selectedGoogleAccount = new Account(accountName, "com.google");
    Log.i(TAG, "Google account selected for fallback");
    fetchGoogleAccessToken(selectedGoogleAccount);
  }

  private void fetchGoogleAccessToken(Account account) {
    new Thread(() -> {
      try {
        String token = GoogleAuthUtil.getToken(this, account, GOOGLE_OAUTH_SCOPE);
        if (token == null || token.isEmpty()) {
          googleSignInInProgress = false;
          Log.w(TAG, "GoogleAuthUtil returned an empty access token");
          showNativeSignInError("Google did not return an access token.");
          return;
        }
        Log.i(TAG, "GoogleAuthUtil returned access token");
        finishWebFirebaseSignIn(null, token);
      } catch (UserRecoverableAuthException exception) {
        Log.w(TAG, "GoogleAuthUtil requires recovery", exception);
        runOnUiThread(() -> startActivityForResult(exception.getIntent(), RC_GOOGLE_AUTH_RECOVERY));
      } catch (IOException | GoogleAuthException exception) {
        googleSignInInProgress = false;
        Log.e(TAG, "GoogleAuthUtil failed", exception);
        showNativeSignInError("Google access token failed: " + exception.getMessage());
      }
    }).start();
  }

  private void showNativeSignInError(String message) {
    if (bridge == null) return;
    googleSignInInProgress = false;
    String script = "console.error(" + JSONObject.quote(message) + ");"
      + "alert(" + JSONObject.quote(message) + ");";
    runOnUiThread(() -> bridge.getWebView().evaluateJavascript(script, null));
  }

  private String resolvePushRegistrationUrl() {
    if (getBridge() != null && getBridge().getServerUrl() != null) {
      Uri bridgeUrl = Uri.parse(getBridge().getServerUrl());
      String scheme = bridgeUrl.getScheme();
      String host = bridgeUrl.getHost();
      if (scheme != null && host != null && !scheme.equals("capacitor") && !scheme.equals("ionic")) {
        return getBridge().getServerUrl().replaceAll("/+$", "") + "/api/push/register";
      }
    }
    return "https://repairsync.ai.studio/api/push/register";
  }

  private class NativeGoogleSignInBridge {
    @JavascriptInterface
    public void signInWithGoogle() {
      startNativeGoogleSignIn();
    }

    @JavascriptInterface
    public void onFirebaseSignInSuccess() {
      googleSignInInProgress = false;
      Log.i(TAG, "WebView Firebase sign-in reported success");
    }

    @JavascriptInterface
    public void onFirebaseSignInError(String details) {
      googleSignInInProgress = false;
      Log.e(TAG, "WebView Firebase sign-in reported error: " + details);
    }

    @JavascriptInterface
    public void openExternalUrl(String url) {
      if (url == null || url.isEmpty()) return;
      Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
      startActivity(browserIntent);
    }
  }

  private void handleDeepLinkIntent(Intent intent) {
    if (intent == null || intent.getData() == null) return;
    Uri data = intent.getData();
    if (!APP_DEEP_LINK_SCHEME.equalsIgnoreCase(data.getScheme())) return;

    StringBuilder target = new StringBuilder(HOSTED_APP_BASE_URL);
    String host = data.getHost();
    if (host != null && !host.isEmpty()) {
      target.append("/").append(host);
    }
    String path = data.getPath();
    if (path != null && !path.isEmpty()) {
      target.append(path);
    }
    if (data.getQuery() != null && !data.getQuery().isEmpty()) {
      target.append("?").append(data.getQuery());
    }

    if (bridge != null && bridge.getWebView() != null) {
      bridge.getWebView().post(() -> bridge.getWebView().loadUrl(target.toString()));
    }
  }
}
