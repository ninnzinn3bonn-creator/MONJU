import { useEffect, useState } from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from "react-native";

import { saveTranscript } from "../recordings";
import { colors } from "../theme";

const previewTranscript =
  "今日の会話では、Android版の実機確認と通知の動作について話しました。\n次は録音と文字起こしの流れを端末で確認します。";

export function TranscriptionScreen({
  recordingId,
  onCompleted,
}: {
  recordingId: string;
  onCompleted: () => void;
}) {
  const [preview, setPreview] = useState("音声を解析しています…");

  useEffect(() => {
    const first = window.setTimeout(() => setPreview(previewTranscript.split("\n")[0] ?? ""), 700);
    const second = window.setTimeout(() => {
      setPreview(previewTranscript);
      saveTranscript(recordingId, previewTranscript);
    }, 1400);
    const done = window.setTimeout(onCompleted, 2300);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
      window.clearTimeout(done);
    };
  }, [onCompleted, recordingId]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.title}>文字起こし中…</Text>
        <Text style={styles.description}>
          オンライン音声認識で録音を処理しています。
        </Text>
        <Text style={styles.preview}>{preview}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 26, gap: 18 },
  title: { color: colors.ink, fontSize: 22, fontWeight: "800", textAlign: "center" },
  description: { color: colors.muted, fontSize: 14, lineHeight: 22, textAlign: "center" },
  preview: { alignSelf: "stretch", color: colors.ink, fontSize: 15, lineHeight: 24, backgroundColor: colors.surface, borderRadius: 18, padding: 18 },
});
