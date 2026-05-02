# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# Keep all attributes needed for proper reflection
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes Exceptions
-keepattributes EnclosingMethod
-keepattributes InnerClasses

# Reduce release APK size by not keeping debug line/source metadata.

# Sentry ProGuard rules
-keep class io.sentry.** { *; }
-dontwarn io.sentry.**

# Firebase Cloud Messaging (FCM) ProGuard rules - CRITICAL for release builds
-keep class com.google.firebase.messaging.** { *; }
-keep class com.google.android.gms.** { *; }
-keep class com.google.firebase.** { *; }
-keep class com.google.firebase.iid.** { *; }
-keep class com.google.firebase.installations.** { *; }
-dontwarn com.google.firebase.messaging.**
-dontwarn com.google.android.gms.**
-dontwarn com.google.firebase.**

# Keep Firebase Messaging Service
-keep class * extends com.google.firebase.messaging.FirebaseMessagingService {
    *;
}

# Notifee ProGuard rules - CRITICAL for notifications
-keep class app.notifee.** { *; }
-keep class com.notifee.** { *; }
-dontwarn app.notifee.**
-dontwarn com.notifee.**

# React Native Firebase ProGuard rules
-keep class io.invertase.firebase.** { *; }
-keep class io.invertase.firebase.messaging.** { *; }
-dontwarn io.invertase.firebase.**
-dontwarn io.invertase.firebase.messaging.**

# Keep React Native classes that might be used by notifications
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }

# Keep notification-related classes
-keep class android.app.Notification { *; }
-keep class android.app.NotificationChannel { *; }
-keep class android.app.NotificationManager { *; }

# Suppress R8 missing-class failure for PDF box JPX/JP2 decoding
-dontwarn com.gemalto.jp2.JP2Decoder
