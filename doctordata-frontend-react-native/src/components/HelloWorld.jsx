import { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

export default function HelloWorld({ msg }) {
  const [count, setCount] = useState(0)

  return (
    <View>
      <Text style={styles.title}>{msg}</Text>

      <View style={styles.card}>
        <TouchableOpacity style={styles.button} onPress={() => setCount(c => c + 1)}>
          <Text style={styles.buttonText}>count is {count}</Text>
        </TouchableOpacity>
        <Text style={styles.hint}>
          Edit <Text style={styles.code}>components/HelloWorld.jsx</Text> to test HMR
        </Text>
      </View>

      <Text style={styles.readDocs}>Tap the DoctorData logo to learn more</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  title: {
    fontSize: 32,
    fontFamily: 'Quadon',
    fontWeight: '700',
    color: 'rgba(255,255,255,0.87)',
    marginBottom: 8,
    textAlign: 'center',
  },
  card: {
    padding: 32,
    alignItems: 'center',
  },
  button: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#1a1a1a',
    marginBottom: 12,
  },
  buttonText: {
    color: 'rgba(255,255,255,0.87)',
    fontSize: 16,
    fontFamily: 'Lato-Regular',
  },
  hint: {
    color: 'rgba(255,255,255,0.87)',
    fontFamily: 'Lato-Regular',
    textAlign: 'center',
  },
  code: {
    fontFamily: 'monospace',
  },
  readDocs: {
    color: '#888',
    fontFamily: 'Lato-Regular',
    textAlign: 'center',
  },
})
