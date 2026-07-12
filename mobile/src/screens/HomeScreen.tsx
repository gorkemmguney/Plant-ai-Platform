import { signOut } from 'firebase/auth';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { firebaseAuth } from '../firebase/firebaseConfig';

export default function HomeScreen() {
  const { firebaseUser, roles } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hoş geldin!</Text>
      <Text>Email: {firebaseUser?.email}</Text>
      <Text>Roller: {roles.join(', ') || 'yükleniyor...'}</Text>
      <TouchableOpacity style={styles.button} onPress={() => signOut(firebaseAuth)}>
        <Text style={styles.buttonText}>Çıkış Yap</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 16 },
  button: { backgroundColor: '#c62828', padding: 14, borderRadius: 8, marginTop: 24 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
