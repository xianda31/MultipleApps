# Add project specific ProGuard rules here.

# Keep Capacitor bridge and plugins
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }

# Keep Stripe Terminal SDK
-keep class com.stripe.** { *; }
-dontwarn com.stripe.**

# Keep WebView JS interface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Preserve stack traces
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
