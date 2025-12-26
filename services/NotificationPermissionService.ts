import {
  Platform,
  PermissionsAndroid,
  Alert,
  Linking,
  NativeModules,
} from 'react-native';

class NotificationPermissionService {
  private static instance: NotificationPermissionService;
  private permissionGranted: boolean | null = null;

  private constructor() {}

  static getInstance(): NotificationPermissionService {
    if (!NotificationPermissionService.instance) {
      NotificationPermissionService.instance =
        new NotificationPermissionService();
    }
    return NotificationPermissionService.instance;
  }

  /**
   * Solicita permiso de notificaciones en Android 13+ (API 33+)
   * En versiones anteriores, retorna true automáticamente
   */
  async requestNotificationPermission(
    showAlert: boolean = true,
  ): Promise<boolean> {
    console.log('[NotificationPermission] 🔔 Solicitando permisos...');

    if (Platform.OS !== 'android') {
      console.log('[NotificationPermission] ℹ️ iOS - permisos no necesarios');
      this.permissionGranted = true;
      return true;
    }

    try {
      // Android 13+ (API 33+) requiere permiso explícito
      if (Platform.Version >= 33) {
        console.log(
          '[NotificationPermission] 📱 Android 13+ detectado, solicitando POST_NOTIFICATIONS...',
        );

        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          {
            title: 'Permiso de Notificaciones',
            message:
              'La app necesita mostrar notificaciones para sincronizar datos en segundo plano con la pantalla apagada.',
            buttonNeutral: 'Preguntar Después',
            buttonNegative: 'Cancelar',
            buttonPositive: 'Permitir',
          },
        );

        const isGranted = granted === PermissionsAndroid.RESULTS.GRANTED;

        if (isGranted) {
          console.log('[NotificationPermission] ✅ Permiso concedido');
          this.permissionGranted = true;
        } else {
          console.warn(
            '[NotificationPermission] ❌ Permiso denegado:',
            granted,
          );
          this.permissionGranted = false;

          if (showAlert) {
            Alert.alert(
              'Permiso de Notificaciones Requerido',
              'Para que la sincronización funcione con pantalla apagada, la app necesita mostrar notificaciones.\n\nPuedes habilitar este permiso en:\nConfiguraciones → Apps → AwesomeProject → Notificaciones',
              [{ text: 'Entendido' }],
            );
          }
        }

        return isGranted;
      } else {
        // Android < 13 - permisos de notificaciones concedidos por defecto
        console.log(
          '[NotificationPermission] ℹ️ Android < 13 - permisos automáticos',
        );
        this.permissionGranted = true;
        return true;
      }
    } catch (error: any) {
      console.error(
        '[NotificationPermission] ❌ Error solicitando permisos:',
        error,
      );
      console.error('[NotificationPermission] Error detalle:', error?.message);
      this.permissionGranted = false;
      return false;
    }
  }

  /**
   * Verifica si el permiso ya fue concedido (sin solicitar nuevamente)
   */
  async checkNotificationPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return true;
    }

    try {
      if (Platform.Version >= 33) {
        const result = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
        console.log('[NotificationPermission] 🔍 Check resultado:', result);
        this.permissionGranted = result;
        return result;
      } else {
        this.permissionGranted = true;
        return true;
      }
    } catch (error: any) {
      console.error(
        '[NotificationPermission] ❌ Error verificando permisos:',
        error,
      );
      return false;
    }
  }

  /**
   * Retorna el estado cacheado del permiso (null = no verificado aún)
   */
  getPermissionStatus(): boolean | null {
    return this.permissionGranted;
  }

  /**
   * Limpia el cache de permisos (útil para re-verificar)
   */
  clearCache(): void {
    this.permissionGranted = null;
  }

  /**
   * Solicita al usuario que excluya la app de la optimización de batería.
   * Esto es CRÍTICO para que la sincronización funcione cuando la app está en background.
   *
   * NOTA: Abre la configuración del sistema para que el usuario lo haga manualmente.
   */
  async requestBatteryOptimizationExclusion(): Promise<void> {
    console.log(
      '[NotificationPermission] 🔋 Solicitando exclusión de optimización de batería...',
    );

    if (Platform.OS !== 'android') {
      console.log('[NotificationPermission] ℹ️ iOS - no aplica');
      return;
    }

    try {
      // Mostrar alerta explicativa y abrir configuración
      Alert.alert(
        '⚡ Optimización de Batería',
        'Para que la sincronización funcione cuando cambies de app, necesitas:\n\n' +
          '1. Buscar "AwesomeProject" en la lista\n' +
          '2. Seleccionar "Sin restricciones" o "No optimizar"\n\n' +
          'Esto permitirá que la app sincronice datos en segundo plano.',
        [
          {
            text: 'Cancelar',
            style: 'cancel',
          },
          {
            text: 'Abrir Configuración',
            onPress: async () => {
              try {
                // Intentar abrir directamente la configuración de batería para esta app
                await Linking.openSettings();
              } catch (error) {
                console.error(
                  '[NotificationPermission] Error abriendo configuración:',
                  error,
                );
              }
            },
          },
        ],
      );
    } catch (error: any) {
      console.error('[NotificationPermission] ❌ Error:', error);
    }
  }

  /**
   * Muestra instrucciones detalladas para configurar la app correctamente
   * para sincronización en background
   */
  showBackgroundSyncInstructions(): void {
    Alert.alert(
      '📱 Configuración para Sincronización',
      'Para que la sincronización funcione al cambiar de app:\n\n' +
        '1. **Optimización de batería:**\n' +
        '   Configuración → Batería → Optimización → AwesomeProject → "Sin restricciones"\n\n' +
        '2. **Notificaciones:**\n' +
        '   Asegúrate que las notificaciones estén habilitadas\n\n' +
        '3. **Modo ahorro:**\n' +
        '   Desactiva el modo de ahorro de batería si está activo\n\n' +
        'Nota: Los pasos exactos varían según el fabricante (Samsung, Xiaomi, etc.)',
      [{ text: 'Entendido' }],
    );
  }
}

export default NotificationPermissionService.getInstance();
