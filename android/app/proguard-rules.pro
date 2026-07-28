# FF Community Arena - ProGuard Rules

# ── Capacitor ────────────────────────────────────────────────────────────────
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep class com.ffcommunityarena.app.** { *; }

# ── WebView bridge (must not be obfuscated) ──────────────────────────────────
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ── Firebase / Push Notifications ───────────────────────────────────────────
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# ── AndroidX ────────────────────────────────────────────────────────────────
-keep class androidx.** { *; }
-keep interface androidx.** { *; }
-dontwarn androidx.**

# ── Keep crash-reporting stack traces readable ───────────────────────────────
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ── JSON serialization ───────────────────────────────────────────────────────
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes EnclosingMethod

# ── General safety ───────────────────────────────────────────────────────────
-dontobfuscate
