package com.repairsync.sms;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

final class NotificationHelper {
  static final String CHANNEL_MESSAGES = "messages";
  private static final int RC_POST_NOTIFICATIONS = 9134;

  private NotificationHelper() {}

  static void createMessageChannel(Context context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

    Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
    AudioAttributes audioAttributes = new AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_NOTIFICATION)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build();
    NotificationChannel channel = new NotificationChannel(
      CHANNEL_MESSAGES,
      "Messages",
      NotificationManager.IMPORTANCE_HIGH
    );
    channel.setDescription("Inbound message alerts");
    channel.enableVibration(true);
    channel.setSound(sound, audioAttributes);

    NotificationManager manager = context.getSystemService(NotificationManager.class);
    if (manager != null) {
      manager.createNotificationChannel(channel);
    }
  }

  static void requestPostNotifications(Activity activity) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return;
    if (
      ContextCompat.checkSelfPermission(activity, Manifest.permission.POST_NOTIFICATIONS)
        == PackageManager.PERMISSION_GRANTED
    ) {
      return;
    }
    ActivityCompat.requestPermissions(
      activity,
      new String[]{Manifest.permission.POST_NOTIFICATIONS},
      RC_POST_NOTIFICATIONS
    );
  }

  static boolean canPostNotifications(Context context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true;
    return ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
      == PackageManager.PERMISSION_GRANTED;
  }

  static void showMessageNotification(Context context, String title, String body) {
    createMessageChannel(context);
    if (!canPostNotifications(context)) return;

    Intent intent = new Intent(context, MainActivity.class)
      .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
    PendingIntent pendingIntent = PendingIntent.getActivity(
      context,
      0,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
    );

    NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_MESSAGES)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle(title == null || title.isEmpty() ? "New message" : title)
      .setContentText(body == null ? "" : body)
      .setStyle(new NotificationCompat.BigTextStyle().bigText(body == null ? "" : body))
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setCategory(NotificationCompat.CATEGORY_MESSAGE)
      .setAutoCancel(true)
      .setContentIntent(pendingIntent)
      .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION));

    NotificationManagerCompat.from(context).notify(
      (int) (System.currentTimeMillis() % Integer.MAX_VALUE),
      builder.build()
    );
  }
}
