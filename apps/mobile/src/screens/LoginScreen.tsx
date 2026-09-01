import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from "react-native";

import { BrandMark, Button } from "../components";
import { colors } from "../theme";

export function LoginScreen({
  busy,
  error,
  onSignIn,
}: {
  busy: boolean;
  error: string | null;
  onSignIn: () => void;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <BrandMark />
          <Text style={styles.headline}>集まった瞬間を、{`\n`}会話の始まりに。</Text>
          <Text style={styles.description}>
            グループの仲間が近くに集まったことを、位置情報からそっとお知らせします。
          </Text>
        </View>
        <View style={styles.signInArea}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {busy ? (
            <View style={styles.busy}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.busyText}>Googleに接続中…</Text>
            </View>
          ) : (
            <Button title="Googleでログイン" onPress={onSignIn} />
          )}
          <Text style={styles.note}>
            ログイン後、位置情報と通知はそれぞれ許可を選べます。
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, paddingHorizontal: 28, paddingBottom: 24 },
  hero: { flex: 1, justifyContent: "center", gap: 24 },
  headline: {
    color: colors.ink,
    fontSize: 31,
    lineHeight: 43,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  description: { color: colors.muted, fontSize: 16, lineHeight: 27 },
  signInArea: { gap: 14 },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: 12,
    padding: 12,
    lineHeight: 20,
  },
  busy: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  busyText: { color: colors.muted, fontWeight: "600" },
  note: { color: colors.muted, textAlign: "center", fontSize: 12, lineHeight: 18 },
});
