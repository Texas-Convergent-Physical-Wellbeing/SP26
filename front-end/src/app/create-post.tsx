import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
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
  const params = useLocalSearchParams<{
    prefillTitle?: string;
    prefillDescription?: string;
    prefillIngredients?: string;
    prefillSteps?: string;
    prefillImage?: string;
  }>();

  const [recipeName, setRecipeName] = useState(() => String(params.prefillTitle ?? ''));
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [description, setDescription] = useState(() => {
    const desc = String(params.prefillDescription ?? '');
    const steps = String(params.prefillSteps ?? '');
    return steps ? (desc ? `${desc}\n\n${steps}` : steps) : desc;
  });
  const [ingredients, setIngredients] = useState(() => String(params.prefillIngredients ?? ''));
  const [imageUri, setImageUri] = useState<string | null>(() => {
    const img = String(params.prefillImage ?? '');
    return img ? img : null;
  });
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = recipeName.trim().length > 0;

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow photo library access to upload an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setImageUri(result.assets[0].uri);
    }
  };

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

        {/* Image */}
        <ThemedText style={styles.label}>Photo</ThemedText>
        {imageUri ? (
          <View style={styles.imageWrap}>
            <Image source={{ uri: imageUri }} style={styles.image} contentFit="cover" />
            <View style={styles.imageActions}>
              <TouchableOpacity style={styles.imageActionPill} onPress={pickImage} activeOpacity={0.85}>
                <Ionicons name="image-outline" size={14} color="#111" />
                <ThemedText style={styles.imageActionText}>Replace</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.imageActionPill}
                onPress={() => setImageUri(null)}
                activeOpacity={0.85}>
                <Ionicons name="trash-outline" size={14} color="#111" />
                <ThemedText style={styles.imageActionText}>Remove</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.uploadCard} onPress={pickImage} activeOpacity={0.85}>
            <View style={styles.uploadIcon}>
              <Ionicons name="cloud-upload-outline" size={22} color="#111" />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.uploadTitle}>Add a photo</ThemedText>
              <ThemedText style={styles.uploadSub}>Optional — upload an image of your dish</ThemedText>
            </View>
          </TouchableOpacity>
        )}

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
  imageWrap: {
    marginTop: 4,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: BORDER,
  },
  image: { width: '100%', height: 200, backgroundColor: '#fff' },
  imageActions: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    gap: 8,
  },
  imageActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  imageActionText: { fontSize: 12, fontWeight: '700', color: '#111' },
  uploadCard: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(0,0,0,0.18)',
  },
  uploadIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff4db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTitle: { fontSize: 14, fontWeight: '800', color: '#111' },
  uploadSub: { fontSize: 12, color: '#555', marginTop: 2 },
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
