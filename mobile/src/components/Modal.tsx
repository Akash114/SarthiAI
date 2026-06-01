import React from 'react';
import { Modal as RNModal, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

interface ModalProps {
  visible: boolean;
  onDismiss: () => void;
  title?: string;
  children: React.ReactNode;
}

export function Modal({ visible, onDismiss, title, children }: ModalProps) {
  const { colors, spacing, radii } = useTheme();

  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable
          style={[
            styles.sheet,
            { backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing.lg },
          ]}
          onPress={() => {}}
        >
          {title ? <Text style={[styles.title, { color: colors.text }]}>{title}</Text> : null}
          {children}
        </Pressable>
      </Pressable>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  sheet: { width: '85%', maxWidth: 360 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
});
