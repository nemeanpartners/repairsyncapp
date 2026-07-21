package com.repairsync.sms;

import android.util.Log;

import androidx.annotation.NonNull;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

public class RepairSyncMessagingService extends FirebaseMessagingService {
  private static final String TAG = "RepairSyncPush";

  @Override
  public void onNewToken(@NonNull String token) {
    super.onNewToken(token);
    Log.i(TAG, "New FCM token received");
    PushTokenRegistrar.registerToken(this, token);
  }

  @Override
  public void onMessageReceived(@NonNull RemoteMessage message) {
    super.onMessageReceived(message);

    RemoteMessage.Notification notification = message.getNotification();
    Map<String, String> data = message.getData();
    String title = notification == null ? null : notification.getTitle();
    String body = notification == null ? null : notification.getBody();

    if ((title == null || title.isEmpty()) && data != null) {
      title = data.get("title");
    }
    if ((body == null || body.isEmpty()) && data != null) {
      body = data.get("body");
    }

    Log.i(TAG, "FCM message received");
    NotificationHelper.showMessageNotification(this, title, body);
  }
}
