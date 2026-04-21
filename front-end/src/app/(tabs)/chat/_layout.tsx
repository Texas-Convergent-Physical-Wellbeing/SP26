import { Stack } from 'expo-router';
import React from 'react';

export default function ChatLayout() {
  // Nested stack so chat subroutes don't become extra tab bar items.
  return <Stack screenOptions={{ headerShown: false }} />;
}

