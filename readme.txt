npx react-native run-android

cd android
./gradlew assembleRelease
cd ..

DETENER CACHE
cd android && ./gradlew --stop

adb logcat | findstr "TaskerSync TaskerBroadcast TaskerHeadless Heartbeat BitacoraService"

VER LOGS DE TASKER WAKE-UP (ESTRATEGIA NUCLEAR):
adb logcat -s TaskerWakeUp:* TaskerWakeUpModule:*

VER SOLO LOGS JAVA DEL MÓDULO NATIVO:
adb logcat TaskerWakeUpModule:D *:S

VER TODO (TASKER + BLUETOOTH + SINCRONIZACIÓN):
adb logcat | findstr "TaskerWakeUp TaskerSync TaskerBroadcast BluetoothPrinter Heartbeat"

LIMPIAR LOGS Y VER EN TIEMPO REAL:
adb logcat -c && adb logcat -s TaskerWakeUpModule:D


