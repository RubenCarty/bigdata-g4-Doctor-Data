import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'

export default function SelectModal({ visible, title, options, value, onSelect, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} onPress={onClose} activeOpacity={1}>
        <View onStartShouldSetResponder={() => true} style={s.box}>
          {title ? <Text style={s.title}>{title}</Text> : null}
          <ScrollView keyboardShouldPersistTaps="handled">
            {options.map((opt) => (
              <TouchableOpacity
                key={String(opt.value)}
                style={[s.option, opt.value === value && s.optionSelected]}
                onPress={() => { onSelect(opt.value); onClose() }}
                activeOpacity={0.7}
              >
                <Text style={[s.optionText, opt.value === value && s.optionTextSelected]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', paddingHorizontal: 24,
  },
  box: {
    backgroundColor: 'white', borderRadius: 12,
    overflow: 'hidden', maxHeight: 420,
  },
  title: {
    fontSize: 15, fontWeight: '600', color: '#111827',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  option: {
    paddingVertical: 14, paddingHorizontal: 18,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  optionSelected: { backgroundColor: '#f0fdf4' },
  optionText: { fontSize: 15, color: '#374151' },
  optionTextSelected: { color: '#16a34a', fontWeight: '600' },
})
