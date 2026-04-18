import React from 'react';
import { Image, Modal, Pressable, StyleSheet, TouchableOpacity } from 'react-native';

import { ThemedText } from '@/components/themed-text';

const CREAM = '#fff4db';
const ACCENT = '#e46d3a'; // deeper orange from Figma

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

export function ProModal({ visible, onDismiss }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      {/* Tap the dim overlay to dismiss */}
      <Pressable style={styles.overlay} onPress={onDismiss}>
        {/* Inner Pressable stops taps on the card from bubbling to the overlay */}
        <Pressable onPress={() => {}} style={styles.card}>
          <ThemedText style={styles.message}>
            To unlock{'\n'}community access, become a NuTradish Pro member today!
          </ThemedText>

          <TouchableOpacity style={styles.btn} activeOpacity={0.85} onPress={onDismiss}>
            <Image
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              source={require('../../assets/images/crown.png')}
              style={styles.crownIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: CREAM,
    borderRadius: 50,
    width: 288,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 28,
    alignItems: 'center',
    gap: 28,
  },
  message: {
    fontSize: 22,
    fontWeight: '700',
    color: ACCENT,
    textAlign: 'center',
    lineHeight: 30,
  },
  btn: {
    width: 255,
    height: 54,
    borderRadius: 100,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crownIcon: {
    width: 32,
    height: 32,
    tintColor: '#fff',
  },
});
