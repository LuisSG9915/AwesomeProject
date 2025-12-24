import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import SyncService from '../services/SyncService';
import TrazabilidadService from '../services/TrazabilidadService';
import { COLORS } from '../theme/theme';

type ClienteGrupo = {
  idGrupo: number;
  nombre: string;
  descripcion: string;
  activo: boolean;
  syncedAt?: Date | null;
};

export default function ClienteGruposScreen() {
  const [grupos, setGrupos] = useState<ClienteGrupo[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadGrupos = useCallback(async () => {
    setLoading(true);
    try {
      await SyncService.initialize();
      const rawResults = SyncService.getClienteGrupos(200) ?? [];
      console.log('Raw groups data:', rawResults);
      const iterable = Array.isArray(rawResults)
        ? rawResults
        : Array.from(rawResults as any[]);
      const mapped = iterable.map((grupo: any) => {
        const parsed = JSON.parse(grupo.rawJson || '{}');
        return {
          idGrupo: grupo.idGrupo,
          nombre: parsed.nombreGrupo || `Grupo ${grupo.idGrupo}`,
          descripcion: parsed.descripcion || '',
          activo: parsed.activo ?? true,
          syncedAt: grupo.syncedAt ?? null,
        };
      });
      console.log('Mapped groups:', mapped);
      setGrupos(mapped);
    } catch (error) {
      console.error('Error cargando grupos de clientes:', error);
      Alert.alert('Error', 'No fue posible cargar los grupos de clientes');
    } finally {
      setLoading(false);
    }
  }, []);

  const syncGrupos = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const result = await SyncService.syncClienteGrupos();
      console.log('Sync result:', result);
      if (result?.success) {
        await loadGrupos();
        Alert.alert(
          '✅ Sincronización completada',
          'Sincronización exitosa. Recarga los grupos para ver cambios.',
        );
      } else {
        const message =
          result?.error || 'No fue posible sincronizar los grupos de clientes';
        Alert.alert('❌ Error', message);
      }
    } catch (error: any) {
      Alert.alert(
        '❌ Error inesperado',
        error?.message || 'Revisa tu conexión e intenta de nuevo',
      );
    } finally {
      setRefreshing(false);
    }
  }, [loadGrupos, refreshing]);

  useEffect(() => {
    loadGrupos();
    const unsubscribe = SyncService.onClienteGrupoChange(() => {
      console.log(
        '🔂 Evento de cambio en ClienteGrupo recibido, recargando datos',
      );
      loadGrupos();
    });

    return () => {
      unsubscribe?.();
    };
  }, [loadGrupos]);

  const totalActivos = useMemo(
    () => grupos.filter(g => g.activo).length,
    [grupos],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Grupos de Clientes</Text>
        <Text style={styles.subtitle}>
          Sincroniza y consulta tus grupos desde Realm
        </Text>
      </View>

      <View style={styles.statsCard}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Total</Text>
          <Text style={styles.statValue}>{grupos.length}</Text>
        </View>
        <View style={[styles.statDivider, { marginHorizontal: 12 }]} />
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Activos</Text>
          <Text style={styles.statValue}>{totalActivos}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.syncButton}
        onPress={() => {
          TrazabilidadService.registrarAccionCompleta(
            {
              pantalla: 'ClienteGruposScreen',
              accion: 'sincronizar_grupos',
              tipoElemento: 'button',
              etiqueta: 'Sincronizar Grupos',
            },
            { exitoso: true },
          );
          syncGrupos();
        }}
        disabled={refreshing}
      >
        {refreshing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.syncText}>🔄 Sincronizar Grupos</Text>
        )}
      </TouchableOpacity>

      <View style={styles.tableHeader}>
        <Text style={[styles.th, { flex: 1 }]}>ID</Text>
        <Text style={[styles.th, { flex: 2 }]}>Nombre</Text>
        <Text style={[styles.th, { flex: 3 }]}>Descripción</Text>
        <Text style={[styles.th, { flex: 1 }]}>Estado</Text>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#1976D2" />
        </View>
      ) : (
        <FlatList
          data={grupos}
          keyExtractor={item => String(item.idGrupo)}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={syncGrupos} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Sin datos</Text>
              <Text style={styles.emptySubtitle}>
                Presiona "Sincronizar Grupos" para obtener la información más
                reciente.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={[styles.td, { flex: 1 }]}>{item.idGrupo}</Text>
              <Text style={[styles.td, { flex: 2 }]}>{item.nombre}</Text>
              <Text style={[styles.td, { flex: 3 }]} numberOfLines={2}>
                {item.descripcion || '—'}
              </Text>
              <View
                style={[styles.badge, !item.activo && styles.badgeInactive]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    !item.activo && styles.badgeTextInactive,
                  ]}
                >
                  {item.activo ? 'Activo' : 'Inactivo'}
                </Text>
              </View>
            </View>
          )}
          contentContainerStyle={
            grupos.length === 0 ? styles.listEmptyContent : undefined
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primaryDark,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.primaryDark,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: '80%',
    backgroundColor: COLORS.border,
  },
  syncButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  syncText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.primaryLight,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#BBDEFB',
  },
  th: {
    color: COLORS.primaryDark,
    fontWeight: '700',
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ECEFF1',
  },
  td: {
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  badge: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: '#C8E6C9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeInactive: {
    backgroundColor: '#FFCDD2',
  },
  badgeText: {
    color: '#1B5E20',
    fontWeight: '600',
    fontSize: 12,
  },
  badgeTextInactive: {
    color: '#B71C1C',
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#455A64',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#90A4AE',
    textAlign: 'center',
  },
  listEmptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
});
