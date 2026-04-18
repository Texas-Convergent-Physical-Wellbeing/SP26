import { Redirect } from 'expo-router';

/** Profile tab redirect — navigates to the profile screen (outside the tab group). */
export default function UserTab() {
  return <Redirect href="/profile" />;
}
