import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { Modal, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Recipe } from '@/data/recipes';

const CREAM = '#fff4db';
const GREEN_TAG = '#c7e890';
const ORANGE = '#ffb259';

interface Props {
  recipe: Recipe | null;
  onClose: () => void;
}

export function RecipeModal({ recipe, onClose }: Props) {
  return (
    <Modal visible={!!recipe} transparent animationType="fade" onRequestClose={onClose}>
      {/* Dark overlay — tap anywhere outside the card to close */}
      <Pressable style={styles.overlay} onPress={onClose}>
        {/* Stop propagation so tapping the card doesn't close the modal */}
        <Pressable onPress={() => {}} style={styles.wrapper}>
          {/* Close button overlaps the top-left corner of the card */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>

          {/* Card */}
          <View style={styles.card}>
            <Image
              source={{ uri: recipe?.imageUrl }}
              style={styles.image}
              contentFit="cover"
              transition={200}
            />
            <View style={styles.cardFooter}>
              {recipe?.tag && (
                <View style={styles.tag}>
                  <ThemedText style={styles.tagText}>{recipe.tag}</ThemedText>
                </View>
              )}
              <ThemedText style={styles.recipeName}>{recipe?.name}</ThemedText>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Relative container so the close button can overlap the card corner */
  wrapper: {
    paddingTop: 22,
    paddingLeft: 12,
  },
  closeBtn: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 43,
    height: 43,
    borderRadius: 22,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  card: {
    backgroundColor: CREAM,
    borderRadius: 50,
    overflow: 'hidden',
    width: 288,
    padding: 16,
  },
  image: {
    width: '100%',
    aspectRatio: 1.05,
    borderRadius: 38,
  },
  cardFooter: {
    paddingTop: 14,
    paddingBottom: 4,
    paddingHorizontal: 4,
    gap: 6,
  },
  tag: {
    alignSelf: 'flex-start',
    backgroundColor: GREEN_TAG,
    borderRadius: 35,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 13,
    color: '#000',
    fontWeight: '400',
  },
  recipeName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
});
