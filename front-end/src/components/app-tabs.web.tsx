import {
  TabList,
  TabSlot,
  TabTrigger,
  TabTriggerSlotProps,
  Tabs,
} from 'expo-router/ui';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

const TAB_BG = '#ffb259';
const ACTIVE_TEXT = '#ffffff';
const INACTIVE_TEXT = 'rgba(255,255,255,0.7)';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <WebTabBar>
          <TabTrigger name="index" href="/" asChild>
            <WebTabButton label="Home" />
          </TabTrigger>
          <TabTrigger name="chat" href="/chat" asChild>
            <WebTabButton label="Chat" />
          </TabTrigger>
          <TabTrigger name="bookmarks" href="/bookmarks" asChild>
            <WebTabButton label="Saved" />
          </TabTrigger>
          <TabTrigger name="user" href="/user" asChild>
            <WebTabButton label="Profile" />
          </TabTrigger>
        </WebTabBar>
      </TabList>
    </Tabs>
  );
}

function WebTabButton({
  children: _children,
  label,
  isFocused,
  ...props
}: TabTriggerSlotProps & { label: string }) {
  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView style={[styles.tabBtn, isFocused && styles.tabBtnActive]}>
        <ThemedText style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
          {label}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

function WebTabBar(props: React.ComponentProps<typeof View>) {
  return (
    <View style={styles.barOuter}>
      <View {...props} style={styles.barInner} />
    </View>
  );
}

const styles = StyleSheet.create({
  barOuter: {
    backgroundColor: TAB_BG,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  barInner: {
    flexDirection: 'row',
    maxWidth: MaxContentWidth,
    width: '100%',
    gap: Spacing.two,
    justifyContent: 'center',
  },
  tabBtn: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    backgroundColor: 'transparent',
  },
  tabBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  tabLabel: {
    color: INACTIVE_TEXT,
    fontSize: 14,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: ACTIVE_TEXT,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
});
