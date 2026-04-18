import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';

const CREAM = '#fff4db';
const ORANGE = '#ffb259';
const GREEN_TAG = '#c7e890';
const BORDER = 'rgba(0,0,0,0.12)';

const TAGS = ['Vegetarian', 'Vegan', 'Mexican', 'High-Protein', 'Gluten-Free', 'Low-Carb', 'Diabetes'];

export default function CreatePostScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [recipeName, setRecipeName] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = recipeName.trim().length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <View style={[styles.root, styles.successRoot]}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark" size={48} color="#fff" />
        </View>
        <ThemedText style={styles.successTitle}>Recipe Posted!</ThemedText>
        <ThemedText style={styles.successSub}>
          Your recipe has been added to the explore page.
        </ThemedText>
        <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()}>
          <ThemedText style={styles.doneBtnText}>Back to Explore</ThemedText>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="close" size={26} color="#000" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>New Recipe</ThemedText>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* Recipe name */}
        <ThemedText style={styles.label}>Recipe Name *</ThemedText>
        <TextInput
          style={styles.input}
          placeholder="e.g. Spicy Mango Salad"
          placeholderTextColor="rgba(0,0,0,0.35)"
          value={recipeName}
          onChangeText={setRecipeName}
          returnKeyType="next"
        />

        {/* Tag */}
        <ThemedText style={styles.label}>Category</ThemedText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tagRow}>
          {TAGS.map(tag => (
            <TouchableOpacity
              key={tag}
              style={[styles.tagChip, selectedTag === tag && styles.tagChipActive]}
              onPress={() => setSelectedTag(prev => (prev === tag ? null : tag))}
              activeOpacity={0.75}>
              <ThemedText
                style={[styles.tagChipText, selectedTag === tag && styles.tagChipTextActive]}>
                {tag}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Ingredients */}
        <ThemedText style={styles.label}>Ingredients</ThemedText>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="List your ingredients here…"
          placeholderTextColor="rgba(0,0,0,0.35)"
          value={ingredients}
          onChangeText={setIngredients}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {/* Description / instructions */}
        <ThemedText style={styles.label}>Instructions</ThemedText>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Share how to make this dish…"
          placeholderTextColor="rgba(0,0,0,0.35)"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          activeOpacity={canSubmit ? 0.8 : 1}>
          <ThemedText style={styles.submitBtnText}>Post Recipe</ThemedText>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CREAM },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  backBtn: { width: 36 },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  form: {
    paddingHorizontal: 18,
    paddingTop: 24,
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#000',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  tagRow: {
    gap: 8,
    paddingVertical: 4,
  },
  tagChip: {
    backgroundColor: '#fff',
    borderRadius: 35,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  tagChipActive: {
    backgroundColor: GREEN_TAG,
    borderColor: GREEN_TAG,
  },
  tagChipText: {
    fontSize: 14,
    color: '#555',
  },
  tagChipTextActive: {
    color: '#000',
    fontWeight: '600',
  },
  submitBtn: {
    marginTop: 28,
    backgroundColor: ORANGE,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.45,
  },
  submitBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  // Success state
  successRoot: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 40,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#000',
  },
  successSub: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    lineHeight: 22,
  },
  doneBtn: {
    marginTop: 16,
    backgroundColor: ORANGE,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  doneBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
