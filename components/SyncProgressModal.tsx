import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SyncProgress } from '../services/FullSyncService';
import { COLORS } from '../theme/theme';

interface SyncProgressModalProps {
  visible: boolean;
  progress: SyncProgress[];
}

const SyncProgressModal: React.FC<SyncProgressModalProps> = ({
  visible,
  progress,
}) => {
  const currentProgress = progress[progress.length - 1];
  const total = currentProgress?.total || 0;
  const current = currentProgress?.current || 0;
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Sincronizando datos</Text>

          <View style={styles.progressSection}>
            <Text style={styles.progressText}>
              {current} de {total} completados
            </Text>

            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { width: `${percentage}%` }]} />
            </View>

            <Text style={styles.percentageText}>{percentage}%</Text>
          </View>

          <ScrollView
            style={styles.logContainer}
            contentContainerStyle={styles.logContent}
          >
            {progress.map((item, index) => (
              <View key={index} style={styles.logItem}>
                <View
                  style={[
                    styles.statusIndicator,
                    item.status === 'completed' && styles.statusCompleted,
                    item.status === 'error' && styles.statusError,
                    item.status === 'syncing' && styles.statusSyncing,
                  ]}
                />
                <View style={styles.logTextContainer}>
                  <Text style={styles.logEntity}>{item.entity}</Text>
                  <Text style={styles.logMessage}>{item.message}</Text>
                </View>
                {item.status === 'syncing' && (
                  <ActivityIndicator size="small" color="#1976D2" />
                )}
              </View>
            ))}
          </ScrollView>

          {currentProgress?.status === 'completed' && current === total && (
            <View style={styles.completedContainer}>
              <Text style={styles.completedText}>
                ✅ Sincronización completa
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 20,
  },
  progressSection: {
    marginBottom: 20,
  },
  progressText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '600',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  percentageText: {
    fontSize: 14,
    color: COLORS.primary,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  logContainer: {
    maxHeight: 300,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
  },
  logContent: {
    paddingBottom: 8,
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    marginRight: 12,
    backgroundColor: COLORS.muted,
  },
  statusCompleted: {
    backgroundColor: COLORS.success,
  },
  statusError: {
    backgroundColor: COLORS.error,
  },
  statusSyncing: {
    backgroundColor: COLORS.warning,
  },
  logTextContainer: {
    flex: 1,
  },
  logEntity: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  logMessage: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  completedContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  completedText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.success,
    textAlign: 'center',
  },
});

export default SyncProgressModal;
