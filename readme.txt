
npx react-native run-android

cd android
./gradlew assembleRelease
cd ..

DETENER CACHE
cd android && ./gradlew --stop

adb logcat | findstr "SyncAlarmReceiver ExactAlarmSync"