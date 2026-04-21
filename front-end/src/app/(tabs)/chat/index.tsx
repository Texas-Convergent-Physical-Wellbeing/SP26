import { Redirect } from 'expo-router';
import React from 'react';

// The chat tab now lands directly on the unified Meal Mate screen, which shows
// suggestion tiles when empty and the conversation once a prompt has been sent.
export default function MealMateEntryScreen() {
  return <Redirect href="/(tabs)/chat/conversation" />;
}
