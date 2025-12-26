package com.awesomeproject

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.ReactPackage

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
          add(ExactAlarmSyncPackage())
          val netInfoPackageClassName = "com.reactnativecommunity.netinfo.NetInfoPackage"
          val hasNetInfoPackage = any { it.javaClass.name == netInfoPackageClassName }
          if (!hasNetInfoPackage) {
            try {
              val netInfoPackage =
                Class.forName(netInfoPackageClassName)
                  .getDeclaredConstructor()
                  .newInstance() as ReactPackage
              add(netInfoPackage)
            } catch (_: Throwable) {
            }
          }
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
