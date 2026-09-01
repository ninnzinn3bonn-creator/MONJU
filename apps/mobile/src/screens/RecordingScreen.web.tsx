import { useEffect, useState } from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";

import { Button } from "../components";
import { formatDuration, saveLocalRecording } from "../recordings";
import { colors } from "../theme";

export function RecordingScreen({
  groupId,
  groupName,
  onSaved,
}: {
  groupId: string;
  groupName: string;
  onSaved: (recordingId: string) => void;
  onFailed: () => void;
}) {
  const [durationMs, setDurationMs] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => setDurationMs((value) => value + 1000), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const stop = async () => {
    setSaving(true);
    const recording = await saveLocalRecording("monju-preview://new", {
      groupId,
      groupName,
      durationMs,
    });
    window.setTimeout(() => onSaved(recording.id), 350);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <View style={styles.recordingLabel}>
          <View style={styles.redDot} />
          <Text style={styles.recordingText}>{saving ? "保存中" : "録音中"}</Text>
        </View>
        <Text style={styles.timer}>{formatDuration(durationMs)}</Text>
        <Text style={styles.limit}>最大 1:00:00</Text>
        <Text style={styles.previewNote}>Web確認版では操作時間をデモ録音として保存します。</Text>
        <Button
          disabled={saving}
          title={saving ? "保存中…" : "録音を停止"}
          onPress={() => void stop()}
          variant="danger"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 30, gap: 22 },
  recordingLabel: { flexDirection: "row", alignItems: "center", gap: 10 },
  redDot: { width: 13, height: 13, borderRadius: 7, backgroundColor: colors.danger },
  recordingText: { color: colors.ink, fontSize: 18, fontWeight: "700" },
  timer: { color: colors.ink, fontSize: 56, lineHeight: 66, fontWeight: "300", fontVariant: ["tabular-nums"] },
  limit: { color: colors.muted, fontSize: 13 },
  previewNote: { color: colors.muted, fontSize: 12, lineHeight: 19, textAlign: "center" },
});
