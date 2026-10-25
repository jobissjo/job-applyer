import type { PropsWithChildren } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { router, type Href } from "expo-router";
export { localDate, scheduleISO } from "@/services/scheduling";

export const colors = {
  bg: "#f7f8fa",
  card: "#fff",
  text: "#24323d",
  muted: "#657582",
  primary: "#177c70",
  pale: "#eaf4f0",
  border: "#e5e9ed",
  danger: "#a93648",
};
export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: 20,
    gap: 18,
    paddingBottom: 40,
    width: "100%",
    maxWidth: 800,
    alignSelf: "center",
  },
  brand: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -1,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontSize: 29,
    fontWeight: "700",
    letterSpacing: -1,
  },
  h2: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  text: { color: colors.text, fontSize: 15, lineHeight: 23 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 21 },
  card: {
    padding: 19,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    gap: 13,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  button: {
    minHeight: 46,
    paddingHorizontal: 17,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
  },
  buttonText: { fontWeight: "700", color: "white", fontSize: 14 },
  secondary: {
    backgroundColor: "#fff",
    borderColor: colors.border,
    borderWidth: 1,
  },
  label: { fontSize: 13, fontWeight: "600", color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: "#dce3e7",
    borderRadius: 9,
    color: colors.text,
    backgroundColor: "#fff",
    padding: 13,
    minHeight: 48,
    fontSize: 15,
  },
  badge: {
    backgroundColor: colors.pale,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    alignSelf: "flex-start",
  },
  badgeText: { color: colors.primary, fontSize: 11, fontWeight: "700" },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    backgroundColor: "#fff",
    minHeight: 40,
    justifyContent: "center",
  },
  notice: {
    backgroundColor: "#eef5f8",
    padding: 14,
    borderRadius: 10,
    gap: 10,
  },
  error: { backgroundColor: "#fdf0f2" },
  separator: { height: 1, backgroundColor: colors.border },
  metric: { fontSize: 32, fontWeight: "700", color: colors.text },
});
export function Page({
  title,
  subtitle,
  children,
  loading = false,
  error = "",
  refresh,
  back = false,
}: PropsWithChildren<{
  title: string;
  subtitle?: string;
  loading?: boolean;
  error?: string;
  refresh?: () => void;
  back?: boolean;
}>) {
  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        refreshControl={
          refresh ? (
            <RefreshControl
              refreshing={loading}
              onRefresh={refresh}
              tintColor={colors.primary}
            />
          ) : undefined
        }
      >
        {back && (
          <Button
            label="‹ Back"
            secondary
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/")
            }
          />
        )}
        <View style={{ gap: 8 }}>
          <Text style={styles.eyebrow}>Your next chapter</Text>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          {!!(subtitle) && <Text style={styles.muted}>{subtitle}</Text>}
        </View>
        {loading && (
          <ActivityIndicator
            accessibilityLabel="Loading"
            color={colors.primary}
          />
        )}
        {error ? <Notice error text={error} retry={refresh} /> : null}
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
export function Card({
  title,
  children,
}: PropsWithChildren<{ title?: string }>) {
  return (
    <View style={styles.card}>
      {!!(title) && (
        <Text accessibilityRole="header" style={styles.h2}>
          {title}
        </Text>
      )}
      {children}
    </View>
  );
}
export function Button({
  label,
  onPress,
  disabled,
  secondary,
  danger,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        danger && { backgroundColor: "#fdf0f2" },
        { opacity: disabled ? 0.45 : pressed ? 0.7 : 1 },
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          secondary && { color: colors.primary },
          danger && { color: colors.danger },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Nav({ label, href }: { label: string; href: Href }) {
  return <Button secondary label={label} onPress={() => router.push(href)} />;
}
export function Field({
  label,
  multiline,
  ...props
}: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#8a969e"
        autoCapitalize="none"
        {...props}
        multiline={multiline}
        style={[
          styles.input,
          multiline && { minHeight: 130, textAlignVertical: "top" },
          props.style,
        ]}
      />
    </View>
  );
}
export function Toggle({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.between}>
      <Text style={[styles.text, { flex: 1 }]}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        disabled={disabled}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.primary }}
      />
    </View>
  );
}
export function Choice<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ gap: 9 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {options.map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: value === option.value, disabled }}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            style={[
              styles.chip,
              value === option.value && {
                backgroundColor: colors.pale,
                borderColor: colors.primary,
              },
            ]}
          >
            <Text
              style={{
                color: value === option.value ? colors.primary : colors.muted,
                fontSize: 13,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export const labels: Record<string, string> = {
  hr_contact_required: "Contact needed",
  applied_externally: "Applied elsewhere",
  in_progress: "In progress",
  on_hold: "On hold",
};
export function Badge({ value }: { value: string }) {
  return (
    <View
      style={[
        styles.badge,
        value === "failed" && { backgroundColor: "#fdf0f2" },
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          value === "failed" && { color: colors.danger },
        ]}
      >
        {labels[value] ||
          value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())}
      </Text>
    </View>
  );
}
export function Notice({
  text,
  error,
  retry,
}: {
  text: string;
  error?: boolean;
  retry?: () => void;
}) {
  return (
    <View
      accessibilityRole={error ? "alert" : undefined}
      accessibilityLiveRegion="polite"
      style={[styles.notice, error && styles.error]}
    >
      <Text
        style={[
          styles.text,
          { fontSize: 13 },
          error && { color: colors.danger },
        ]}
      >
        {text}
      </Text>
      {retry && <Button label="Try again" secondary onPress={retry} />}
    </View>
  );
}
export function Feedback({
  busy,
  error,
  message,
}: {
  busy: boolean;
  error: string;
  message: string;
}) {
  return (
    <>
      {busy && <ActivityIndicator color={colors.primary} />}
      {!!(error) && <Notice text={error} error />}
      {!!(message) && <Notice text={message} />}
    </>
  );
}
export function Empty({ text }: { text: string }) {
  return (
    <Card>
      <Text style={styles.muted}>{text}</Text>
    </Card>
  );
}
export async function confirm(
  title: string,
  message: string,
): Promise<boolean> {
  if (Platform.OS === "web") return window.confirm(`${title}\n\n${message}`);
  return new Promise((resolve) =>
    Alert.alert(
      title,
      message,
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: "Confirm", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}
export async function openLink(url: string) {
  if (!/^https?:\/\//i.test(url))
    throw new Error("Only HTTP and HTTPS links are supported.");
  await Linking.openURL(url);
}
export function ScheduleField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <>
      <Field
        label="Schedule send (optional)"
        placeholder="YYYY-MM-DD HH:mm"
        value={value}
        onChangeText={onChange}
      />
      <Text style={styles.muted}>
        Local timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}.
        Leave empty to send now.
      </Text>
    </>
  );
}
