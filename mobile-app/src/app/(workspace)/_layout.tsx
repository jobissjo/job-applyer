import { Stack, router, usePathname, type Href } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { colors, styles } from "@/components/ui";
const tabs: { label: string; icon: string; href: Href; prefix: string }[] = [
  { label: "Overview", icon: "◈", href: "/", prefix: "/" },
  { label: "Jobs", icon: "⌕", href: "/jobs", prefix: "/jobs" },
  {
    label: "Applications",
    icon: "▤",
    href: "/applications",
    prefix: "/applications",
  },
  { label: "Learning", icon: "◇", href: "/learning", prefix: "/learning" },
  { label: "More", icon: "☰", href: "/more", prefix: "/more" },
];
export default function Workspace() {
  const pathname = usePathname();
  return (
    <View style={{ flex: 1 }}>
      <View
        style={[
          styles.between,
          {
            paddingHorizontal: 22,
            paddingVertical: 13,
            backgroundColor: "#fff",
            borderBottomWidth: 1,
            borderColor: colors.border,
          },
        ]}
      >
        <Text style={styles.brand}>
          ApplyPilot<Text style={{ color: colors.primary }}>.</Text>
        </Text>
        <Text style={styles.muted}>Your job workspace</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }} />
      </View>
      <View
        style={{
          flexDirection: "row",
          backgroundColor: "#fff",
          borderTopWidth: 1,
          borderColor: colors.border,
        }}
      >
        {tabs.map((tab) => {
          const active =
            tab.prefix === "/"
              ? pathname === "/"
              : pathname.startsWith(tab.prefix);
          return (
            <Pressable
              key={tab.label}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => router.navigate(tab.href)}
              style={{
                flex: 1,
                minHeight: 64,
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
              }}
            >
              <Text
                style={{
                  color: active ? colors.primary : colors.muted,
                  fontSize: 22,
                }}
              >
                {tab.icon}
              </Text>
              <Text
                style={{
                  color: active ? colors.primary : colors.muted,
                  fontSize: 10,
                  fontWeight: active ? "700" : "400",
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
