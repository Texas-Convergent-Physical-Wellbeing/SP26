import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_BG = '#ffb259';
const ICON_ACTIVE = '#ffffff';
const ICON_INACTIVE = 'rgba(255,255,255,0.55)';

/** Which tab is currently visible.
 *  - 'home'      → person icon (left)
 *  - 'chat'      → chat bubble (2nd)
 *  - 'bookmarks' → bookmark icon (3rd)
 *  - 'profile'   → settings/gear icon (right) — links to profile page
 */
export type ActiveTab = 'home' | 'chat' | 'bookmarks' | 'profile';

export interface BottomTabBarProps {
  activeTab: ActiveTab;
  onHomePress: () => void;
  onChatPress: () => void;
  onBookmarksPress: () => void;
  onProfilePress: () => void;
}

export function BottomTabBar({
  activeTab,
  onHomePress,
  onChatPress,
  onBookmarksPress,
  onProfilePress,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {/* Person icon → home/cooking page */}
      <TouchableOpacity style={styles.tab} onPress={onHomePress} activeOpacity={0.75}>
        <Ionicons
          name="people"
          size={28}
          color={activeTab === 'home' ? ICON_ACTIVE : ICON_INACTIVE}
        />
      </TouchableOpacity>
      {/* Chat bubble icon → chat screen */}
      <TouchableOpacity style={styles.tab} onPress={onChatPress} activeOpacity={0.75}>
        <Ionicons
          name="chatbubble"
          size={28}
          color={activeTab === 'chat' ? ICON_ACTIVE : ICON_INACTIVE}
        />
      </TouchableOpacity>
      {/* Bookmark icon → saved recipes */}
      <TouchableOpacity style={styles.tab} onPress={onBookmarksPress} activeOpacity={0.75}>
        <Ionicons
          name="bookmark"
          size={26}
          color={activeTab === 'bookmarks' ? ICON_ACTIVE : ICON_INACTIVE}
        />
      </TouchableOpacity>
      {/* Settings/gear icon → profile page */}
      <TouchableOpacity style={styles.tab} onPress={onProfilePress} activeOpacity={0.75}>
        <Ionicons
          name="settings"
          size={28}
          color={activeTab === 'profile' ? ICON_ACTIVE : ICON_INACTIVE}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: TAB_BG,
    paddingTop: 12,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(217,217,217,0.75)',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
  },
});
