/**
 * SyncStatusPanel
 *
 * Panel informativo que muestra el estado de la sincronización automática.
 * Se actualiza en tiempo real y muestra:
 * - Estado actual (sincronizando, exitoso, error)
 * - Última sincronización
 * - Próxima sincronización
 * - Progreso actual
 * - Contador de sincronizaciones
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Icon } from 'react-native-elements';
import BackgroundSyncService, {
  BackgroundSyncState,
} from '../services/BackgroundSyncService';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../theme/theme';

interface SyncStatusPanelProps {
  compact?: boolean; // Modo compacto para mostrar en header
}

export default function SyncStatusPanel({
  compact = false,
}: SyncStatusPanelProps) {
  const [state, setState] = useState<BackgroundSyncState>(
    BackgroundSyncService.getState(),
  );
  const [timeUntilNext, setTimeUntilNext] = useState<string | null>(null);

  useEffect(() => {
    // Suscribirse a cambios de estado
    const unsubscribe = BackgroundSyncService.subscribe(newState => {
      setState(newState);
    });

    // Actualizar contador cada segundo
    const intervalId = setInterval(() => {
      setTimeUntilNext(BackgroundSyncService.getTimeUntilNextSync());
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(intervalId);
    };
  }, []);

  const getStatusIcon = () => {
    switch (state.status) {
      case 'syncing':
        return <ActivityIndicator size="small" color={COLORS.primary} />;
      case 'success':
        return (
          <Icon
            name="check-circle"
            type="material"
            color={COLORS.success}
            size={20}
          />
        );
      case 'error':
        return (
          <Icon name="error" type="material" color={COLORS.error} size={20} />
        );
      default:
        return (
          <Icon name="sync" type="material" color={COLORS.muted} size={20} />
        );
    }
  };

  const getStatusColor = () => {
    switch (state.status) {
      case 'syncing':
        return COLORS.primary;
      case 'success':
        return COLORS.success;
      case 'error':
        return COLORS.error;
      default:
        return COLORS.muted;
    }
  };

  const getStatusText = () => {
    switch (state.status) {
      case 'syncing':
        return 'Sincronizando...';
      case 'success':
        return 'Sincronizado';
      case 'error':
        return 'Error';
      default:
        return 'Inactivo';
    }
  };

  const formatTime = (date: Date | null) => {
    if (!date) return 'N/A';
    return date.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleManualSync = () => {
    BackgroundSyncService.syncNow();
  };

  if (compact) {
    // Modo compacto para header
    return (
      <TouchableOpacity
        style={styles.compactContainer}
        onPress={handleManualSync}
        disabled={state.status === 'syncing'}
      >
        {getStatusIcon()}
        <Text style={[styles.compactText, { color: getStatusColor() }]}>
          {getStatusText()}
        </Text>
      </TouchableOpacity>
    );
  }

  // Modo completo
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {getStatusIcon()}
          <Text style={styles.title}>Sincronización Automática</Text>
        </View>
        <TouchableOpacity
          style={[
            styles.syncButton,
            state.status === 'syncing' && styles.syncButtonDisabled,
          ]}
          onPress={handleManualSync}
          disabled={state.status === 'syncing'}
        >
          <Icon
            name="sync"
            type="material"
            color={state.status === 'syncing' ? COLORS.muted : COLORS.primary}
            size={18}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* Estado actual */}
        <View style={styles.row}>
          <Text style={styles.label}>Estado:</Text>
          <Text style={[styles.value, { color: getStatusColor() }]}>
            {getStatusText()}
          </Text>
        </View>

        {/* Progreso actual */}
        {state.status === 'syncing' && state.currentProgress && (
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>
              {state.currentProgress.entity} ({state.currentProgress.current}/
              {state.currentProgress.total})
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${
                      (state.currentProgress.current /
                        state.currentProgress.total) *
                      100
                    }%`,
                  },
                ]}
              />
            </View>
          </View>
        )}

        {/* Última sincronización */}
        {state.lastSyncTime && (
          <View style={styles.row}>
            <Text style={styles.label}>Última sync:</Text>
            <Text style={styles.value}>{formatTime(state.lastSyncTime)}</Text>
          </View>
        )}

        {/* Próxima sincronización */}
        {state.nextSyncTime && (
          <View style={styles.row}>
            <Text style={styles.label}>Próxima sync:</Text>
            <Text style={styles.value}>
              {timeUntilNext || formatTime(state.nextSyncTime)}
            </Text>
          </View>
        )}

        {/* Contador de sincronizaciones */}
        <View style={styles.row}>
          <Text style={styles.label}>Total sync:</Text>
          <Text style={styles.value}>{state.syncCount}</Text>
        </View>

        {/* Mensaje de error */}
        {state.status === 'error' && state.errorMessage && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{state.errorMessage}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.m,
    padding: SPACING.m,
    marginBottom: SPACING.m,
    ...SHADOWS.small,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.s,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  syncButton: {
    padding: SPACING.s,
    borderRadius: BORDER_RADIUS.s,
    backgroundColor: COLORS.background,
  },
  syncButtonDisabled: {
    opacity: 0.5,
  },
  content: {
    gap: SPACING.s,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  progressContainer: {
    gap: 4,
  },
  progressText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  progressBar: {
    height: 4,
    backgroundColor: COLORS.background,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    padding: SPACING.s,
    borderRadius: BORDER_RADIUS.s,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.error,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.error,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.s,
    paddingVertical: 4,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.s,
  },
  compactText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
