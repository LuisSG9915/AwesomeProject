// import 'react-native-url-polyfill/auto';
// import SyncService from './SyncService';

// const signalR = require('@microsoft/signalr');

// class SignalRService {
//   constructor() {
//     this.connection = null;
//     this.isConnected = false;
//   }

//   async conectar() {
//     console.log('Intentando conectar a SignalR con URL:', 'http://localhost:5083/hubs/clientesgrupos');
//     this.connection = new signalR.HubConnectionBuilder()
//       .withUrl('http://localhost:5083/hubs/clientesgrupos')
//       .withAutomaticReconnect()
//       .configureLogging(signalR.LogLevel.Information)
//       .build();

//     this.connection.on('RecibirCambio', async rawData => {
//       const notification = Array.isArray(rawData) ? rawData[0] : rawData;
//       console.log('📬 Notificación recibida:', notification);

//       try {
//         await SyncService.upsertClienteGrupoFromNotification(notification);
//         console.log('✅ ClienteGrupo actualizado/insertado en Realm');
//       } catch (error) {
//         console.error('❌ Error procesando notificación de ClienteGrupo:', error);
//       }
//     });

//     this.connection.on('SuscripcionConfirmada', (data) => {
//       console.log(' Suscripción confirmada:', data);
//     });

//     try {
//       await this.connection.start();
//       this.isConnected = true;
//       console.log(' Conectado a SignalR exitosamente');
//       await this.connection.invoke('SuscribirseACambiosConCliente', 'cliente_movil_001');
//     } catch (err) {
//       console.error('Error al conectar SignalR:', err);
//       if (err.message.includes('pathname')) {
//         console.error('Posible error de URL; verifica el endpoint.');
//       }
//       setTimeout(() => this.conectar(), 5000); // Retry after 5 seconds
//     }
//   }

//   desconectar() {
//     if (this.connection) {
//       this.connection.stop();
//       this.isConnected = false;
//       console.log('Desconectado de SignalR');
//     }
//   }

//   mantenerVivo() {
//     if (this.isConnected) {
//       console.log('Manteniendo vivo la conexión SignalR');
//       this.connection.invoke('MantenervAlive').catch(err => console.error('Error manteniendo vivo:', err));
//     }
//   }
// }

// export default new SignalRService();
