import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';

const TAB_BG = '#ffb259';
const ACTIVE = '#ffffff';
const INACTIVE = 'rgba(255,255,255,0.55)';

export default function AppTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: TAB_BG,
          borderTopWidth: 1,
          borderTopColor: 'rgba(217,217,217,0.75)',
          height: 64,
          paddingTop: 8,
        },
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarShowLabel: false,
      }}>
      {/* Chat bubble (1st) → Chat screen */}
      <Tabs.Screen
        name="chat"
        options={{ tabBarIcon: ({ color }) => <Ionicons name="chatbubble" size={28} color={color} /> }}
      />
      {/* Community/people icon (2nd) → Let's Get Cooking! home */}
      <Tabs.Screen
        name="index"
        options={{ tabBarIcon: ({ color }) => <Ionicons name="people" size={28} color={color} /> }}
      />
      {/* Bookmark (3rd) → Saved recipes */}
      <Tabs.Screen
        name="bookmarks"
        options={{ tabBarIcon: ({ color }) => <Ionicons name="bookmark" size={26} color={color} /> }}
      />
      {/* Settings/gear icon (right) → Profile via user.tsx redirect */}
      <Tabs.Screen
        name="user"
        options={{ tabBarIcon: ({ color }) => <Ionicons name="settings" size={28} color={color} /> }}
      />
      {/* Legacy screens — hidden from tab bar */}
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}
