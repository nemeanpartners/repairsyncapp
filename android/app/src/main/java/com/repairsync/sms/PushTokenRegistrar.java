package com.repairsync.sms;

import android.content.Context;
import android.util.Log;

import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.firebase.messaging.FirebaseMessaging;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

final class PushTokenRegistrar {
  private static final String TAG = "RepairSyncPush";
  private static final String DEFAULT_PUSH_REGISTER_URL =
    "https://repairsync.ai.studio/api/push/register";
  private static final String PREFS_NAME = "repairsync_mobile";
  private static final String KEY_PUSH_REGISTER_URL = "push_register_url";

  private PushTokenRegistrar() {}

  static void registerCurrentToken(Context context) {
    FirebaseMessaging.getInstance().getToken()
      .addOnSuccessListener(token -> registerToken(context, token))
      .addOnFailureListener(error -> Log.e(TAG, "Failed to get FCM token", error));
  }

  static void setRegistrationUrl(Context context, String url) {
    if (url == null || url.isEmpty()) return;
    context
      .getApplicationContext()
      .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY_PUSH_REGISTER_URL, url)
      .apply();
  }

  static void registerToken(Context context, String token) {
    if (token == null || token.isEmpty()) return;

    Context appContext = context.getApplicationContext();
    GoogleSignInAccount account = GoogleSignIn.getLastSignedInAccount(appContext);
    String email = account == null ? null : account.getEmail();

    new Thread(() -> {
      try {
        String json = "{"
          + "\"token\":\"" + escapeJson(token) + "\","
          + "\"platform\":\"android\","
          + "\"email\":" + jsonNullable(email)
          + "}";
        byte[] body = json.getBytes(StandardCharsets.UTF_8);

        HttpURLConnection connection =
          (HttpURLConnection) new URL(resolveRegistrationUrl(appContext)).openConnection();
        connection.setConnectTimeout(10000);
        connection.setReadTimeout(10000);
        connection.setRequestMethod("POST");
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", "application/json");
        connection.setRequestProperty("Accept", "application/json");

        try (OutputStream stream = connection.getOutputStream()) {
          stream.write(body);
        }

        int responseCode = connection.getResponseCode();
        if (responseCode < 200 || responseCode >= 300) {
          Log.w(TAG, "Push token registration failed with HTTP " + responseCode);
          return;
        }
        Log.i(TAG, "Push token registered");
      } catch (Exception error) {
        Log.e(TAG, "Push token registration error", error);
      }
    }).start();
  }

  private static String resolveRegistrationUrl(Context context) {
    String configuredUrl = context
      .getApplicationContext()
      .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .getString(KEY_PUSH_REGISTER_URL, null);
    if (configuredUrl != null && !configuredUrl.isEmpty()) {
      return configuredUrl;
    }
    return DEFAULT_PUSH_REGISTER_URL;
  }

  private static String jsonNullable(String value) {
    return value == null || value.isEmpty() ? "null" : "\"" + escapeJson(value) + "\"";
  }

  private static String escapeJson(String value) {
    return value
      .replace("\\", "\\\\")
      .replace("\"", "\\\"")
      .replace("\n", "\\n")
      .replace("\r", "\\r");
  }
}
