import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { SessionProvider, useSession } from "@/providers/session";
import { Button, Notice, Page, colors } from "@/components/ui";
function Routes() {
  const { user, loading, error, restore, signOut } = useSession();
  if (loading || error)
    return (
      <Page title="ApplyPilot" loading={loading}>
        {!!(error) && (
          <>
            <Notice text={error} error />
            <Button
              label="Reconnect"
              onPress={() => {
                void restore();
              }}
            />
            <Button
              label="Return to sign in"
              secondary
              onPress={() => {
                void signOut()
                  .then(restore)
                  .catch(() => {});
              }}
            />
          </>
        )}
      </Page>
    );
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(workspace)" />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}
export default function Layout() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <StatusBar style="dark" />
        <SessionProvider>
          <Routes />
        </SessionProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
