import { useState } from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";

import { joinInvite } from "../api";
import { BrandMark, Button, Card, PageHeader } from "../components";
import { colors } from "../theme";

export function InviteScannerScreen({
  onBack,
  onJoined,
}: {
  onBack: () => void;
  onJoined: (groupId: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  const scanPreviewInvite = async () => {
    setBusy(true);
    onJoined(await joinInvite("MONJU_LOCAL_PREVIEW_INVITE_12345678"));
  };

  return (
    <SafeAreaView style={styles.safe}>
      <PageHeader title="QRコードで参加" onBack={onBack} />
      <View style={styles.content}>
        <Card style={styles.card}>
          <BrandMark compact />
          <Text style={styles.title}>招待QRの読み取り</Text>
          <Text style={styles.message}>
            Web確認版ではカメラの代わりに、デモ用の招待コードで参加操作を確認できます。
          </Text>
          <Button
            disabled={busy}
            title={busy ? "参加しています…" : "デモ用QRを読み取る"}
            onPress={() => void scanPreviewInvite()}
          />
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, justifyContent: "center", padding: 22 },
  card: { alignItems: "center", gap: 18, paddingVertical: 30 },
  title: { color: colors.ink, fontSize: 21, fontWeight: "800" },
  message: { color: colors.muted, fontSize: 14, lineHeight: 22, textAlign: "center" },
});
