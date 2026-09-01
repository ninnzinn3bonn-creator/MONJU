import type { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { colors, shadow } from "./theme";
import type { GatheringState, User } from "./types";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <View style={styles.brandRow}>
      <View style={[styles.brandGlyph, compact && styles.brandGlyphCompact]}>
        <Text style={[styles.brandGlyphText, compact && styles.brandGlyphTextCompact]}>
          文
        </Text>
      </View>
      <Text style={[styles.brandText, compact && styles.brandTextCompact]}>MONJU</Text>
    </View>
  );
}

export function Card({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  title,
  onPress,
  disabled = false,
  variant = "primary",
  compact = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  compact?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[`button_${variant}`],
        compact && styles.buttonCompact,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.buttonText, styles[`buttonText_${variant}`]]}>
        {title}
      </Text>
    </Pressable>
  );
}

export function PageHeader({
  title,
  onBack,
  action,
}: {
  title: string;
  onBack?: () => void;
  action?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerSide}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="戻る"
            hitSlop={12}
            onPress={onBack}
          >
            <Text style={styles.back}>‹</Text>
          </Pressable>
        ) : null}
      </View>
      <Text numberOfLines={1} style={styles.headerTitle}>
        {title}
      </Text>
      <View style={[styles.headerSide, styles.headerSideRight]}>{action}</View>
    </View>
  );
}

export function Avatar({
  user,
  size = 42,
}: {
  user: Pick<User, "displayName" | "profileImageUrl">;
  size?: number;
}) {
  const imageStyle = { width: size, height: size, borderRadius: size / 2 };
  if (user.profileImageUrl) {
    return <Image source={{ uri: user.profileImageUrl }} style={imageStyle} />;
  }
  return (
    <View style={[styles.avatarFallback, imageStyle]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>
        {user.displayName.slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}

const statePresentation: Record<
  GatheringState,
  { label: string; color: string; background: string }
> = {
  NOT_GATHERED: {
    label: "未集合",
    color: colors.muted,
    background: "#EAEEEA",
  },
  CANDIDATE: {
    label: "集合判定中",
    color: colors.warning,
    background: colors.warningSoft,
  },
  GATHERED: {
    label: "集合しました",
    color: colors.primaryDark,
    background: colors.primarySoft,
  },
  LEAVING: {
    label: "解散判定中",
    color: colors.warning,
    background: colors.warningSoft,
  },
};

export function StateBadge({ state }: { state: GatheringState }) {
  const presentation = statePresentation[state];
  return (
    <View style={[styles.badge, { backgroundColor: presentation.background }]}>
      <View style={[styles.badgeDot, { backgroundColor: presentation.color }]} />
      <Text style={[styles.badgeText, { color: presentation.color }]}>
        {presentation.label}
      </Text>
    </View>
  );
}

export function LoadingView({ label = "読み込み中…" }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  brandGlyph: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  brandGlyphCompact: { width: 34, height: 34, borderRadius: 11 },
  brandGlyphText: { color: "white", fontSize: 25, fontWeight: "800" },
  brandGlyphTextCompact: { fontSize: 16 },
  brandText: {
    color: colors.ink,
    fontSize: 31,
    fontWeight: "800",
    letterSpacing: 3,
  },
  brandTextCompact: { fontSize: 21, letterSpacing: 2 },
  card: {
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: 18,
    ...shadow,
  },
  button: {
    minHeight: 52,
    paddingHorizontal: 20,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  buttonCompact: { minHeight: 40, paddingHorizontal: 14, borderRadius: 12 },
  button_primary: { backgroundColor: colors.primary, borderColor: colors.primary },
  button_secondary: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
  button_danger: { backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft },
  button_ghost: { backgroundColor: "transparent", borderColor: colors.line },
  buttonText: { fontSize: 16, fontWeight: "700" },
  buttonText_primary: { color: "white" },
  buttonText_secondary: { color: colors.primaryDark },
  buttonText_danger: { color: colors.danger },
  buttonText_ghost: { color: colors.ink },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.45 },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
  },
  headerSide: { width: 62, alignItems: "flex-start" },
  headerSideRight: { alignItems: "flex-end" },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: colors.ink,
    fontSize: 17,
    fontWeight: "700",
  },
  back: { color: colors.ink, fontSize: 40, lineHeight: 42, fontWeight: "300" },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  avatarText: { color: colors.primaryDark, fontWeight: "800" },
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeDot: { width: 7, height: 7, borderRadius: 4 },
  badgeText: { fontSize: 12, fontWeight: "700" },
  loading: { flex: 1, justifyContent: "center", alignItems: "center", gap: 14 },
  loadingText: { color: colors.muted, fontSize: 14 },
});
