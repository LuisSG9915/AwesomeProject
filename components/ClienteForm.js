import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  ScrollView
} from 'react-native';
import { Button, Card } from 'react-native-elements';
import ClienteService from '../services/ClienteService';
import TrazabilidadService from '../services/TrazabilidadService';

const ClienteForm = ({ onClienteCreado }) => {
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    telefono: '',
    domicilio: '',
    ciudad: '',
    rfc: ''
  });
  const [loading, setLoading] = useState(false);

  const handleInputChange = (field, value) => {
    setFormData({
      ...formData,
      [field]: value
    });
  };

  const handleSubmit = TrazabilidadService.wrapOnClick(
    async () => {
    // Validar campos requeridos
    if (!formData.nombre.trim()) {
      Alert.alert('Error', 'El nombre del cliente es requerido');
      return;
    }

    setLoading(true);
    
    try {
      const nuevoCliente = await ClienteService.crearCliente(formData);
      
      Alert.alert(
        'Éxito',
        `Cliente "${nuevoCliente.nombre}" creado correctamente. Webhook enviado.`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Limpiar formulario
              setFormData({
                nombre: '',
                email: '',
                telefono: '',
                domicilio: '',
                ciudad: '',
                rfc: ''
              });
              
              // Notificar al componente padre
              if (onClienteCreado) {
                onClienteCreado(nuevoCliente);
              }
            }
          }
        ]
      );
      
    } catch (error) {
      Alert.alert('Error', 'No se pudo crear el cliente. Intente nuevamente.');
    } finally {
      setLoading(false);
    }
  },
  'ClienteForm',
  'guardar_cliente',
  'button',
  'Guardar Cliente'
);

  return (
    <ScrollView style={styles.container}>
      <Card containerStyle={styles.card}>
        <Text style={styles.title}>📝 Nuevo Cliente</Text>
        <Text style={styles.subtitle}>
          Los datos se enviarán por webhook a todos los suscriptores
        </Text>
        
        <View style={styles.formContainer}>
          <TextInput
            style={styles.input}
            placeholder="Nombre del cliente *"
            value={formData.nombre}
            onChangeText={(value) => handleInputChange('nombre', value)}
            autoCapitalize="words"
          />
          
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={formData.email}
            onChangeText={(value) => handleInputChange('email', value)}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          
          <TextInput
            style={styles.input}
            placeholder="Teléfono"
            value={formData.telefono}
            onChangeText={(value) => handleInputChange('telefono', value)}
            keyboardType="phone-pad"
          />
          
          <TextInput
            style={styles.input}
            placeholder="Domicilio"
            value={formData.domicilio}
            onChangeText={(value) => handleInputChange('domicilio', value)}
            autoCapitalize="words"
          />
          
          <TextInput
            style={styles.input}
            placeholder="Ciudad"
            value={formData.ciudad}
            onChangeText={(value) => handleInputChange('ciudad', value)}
            autoCapitalize="words"
          />
          
          <TextInput
            style={styles.input}
            placeholder="RFC"
            value={formData.rfc}
            onChangeText={(value) => handleInputChange('rfc', value)}
            autoCapitalize="characters"
          />
        </View>
        
        <Button
          title="🚀 Crear Cliente y Enviar Webhook"
          onPress={handleSubmit}
          loading={loading}
          buttonStyle={styles.submitButton}
          disabled={loading}
        />
        
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            📡 Al crear el cliente, se enviará automáticamente un webhook 
            a todos los endpoints suscritos con la siguiente estructura:
          </Text>
          <Text style={styles.codeBlock}>
            {'{'}\n
            {'  '}tipo: 'cliente_creado',\n
            {'  '}mensaje: 'Nuevo cliente creado: [nombre]',\n
            {'  '}timestamp: '[fecha]',\n
            {'  '}datos: {'{'}\n
            {'    '}clienteId: [id],\n
            {'    '}nombre: '[nombre]',\n
            {'    '}email: '[email]',\n
            {'    '}telefono: '[telefono]',\n
            {'    '}fechaAlta: '[fecha]',\n
            {'    '}usuarioEjecuta: 1,\n
            {'    '}ip: 'Mobile App',\n
            {'    '}dispositivo: 'React Native'\n
            {'  }'}\n
            {'}'}
          </Text>
        </View>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  card: {
    margin: 15,
    padding: 20
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
    color: '#333'
  },
  subtitle: {
    fontSize: 12,
    textAlign: 'center',
    color: '#666',
    marginBottom: 20,
    fontStyle: 'italic'
  },
  formContainer: {
    marginBottom: 20
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 15,
    borderRadius: 8,
    marginBottom: 20
  },
  infoContainer: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3'
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 10,
    lineHeight: 18
  },
  codeBlock: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#333',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0'
  }
});

export default ClienteForm;
