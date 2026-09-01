import { useEffect, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Card, PageHeader } from "../components";
import { formatDuration, listLocalRecordings } from "../recordings";
import { colors } from "../theme";
import type { LocalRecording } from "../types";

function dateLabel(value: string): string {
  return new Date(value).toLocaleString("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const statusLabel = {
  PENDING: "文字起こし待ち",
  FAILED: "文字起こしを再試行できます",
  COMPLETED: "文字起こし済み",
} as const;

export function RecordingsScreen({
  onBack,
  onSelect,
}: {
  onBack: () => void;
  onSelect: (recordingId: string) => void;
}) {
  const [recordings, setRecordings] = useState<LocalRecording[]>([]);

  useEffect(() => {
    setRecordings(listLocalRecordings());
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <PageHeader title="録音" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content}>
        {recordings.length === 0 ? (
          <Card style={styles.empty}>
            <Text style={styles.emptyTitle}>録音はまだありません</Text>
            <Text style={styles.emptyText}>
              集合後に「録音開始」を押すと、音声と文字起こしがこの端末に保存されます。
            </Text>
          </Card>
        ) : (
          <View style={styles.list}>
            {recordings.map((recording) => (
              <Pressable
                accessibilityRole="button"
                key={recording.id}
                onPress={() => onSelect(recording.id)}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Card style={styles.card}>
                  <View style={styles.row}>
                    <Text numberOfLines={1} style={styles.groupName}>
                      {recording.groupName}
                    </Text>
                    <Text style={styles.duration}>{formatDuration(recording.durationMs)}</Text>
                  </View>
                  <Text style={styles.date}>{dateLabel(recording.createdAt)}</Text>
                  <Text
                    style={[
                      styles.status,
                      recording.transcriptionStatus === "FAILED" && styles.failed,
                    ]}
                  >
                    {statusLabel[recording.transcriptionStatus]}
                  </Text>
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 18, paddingBottom: 38 },
  list: { gap: 12 },
  card: { gap: 9 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  groupName: { flex: 1, color: colors.ink, fontSize: 17, fontWeight: "700" },
  duration: { color: colors.ink, fontSize: 14, fontVariant: ["tabular-nums"] },
  date: { color: colors.muted, fontSize: 12 },
  status: { color: colors.primaryDark, fontSize: 12, fontWeight: "600" },
  failed: { color: colors.warning },
  empty: { alignItems: "center", gap: 10, paddingVertical: 30 },
  emptyTitle: { color: colors.ink, fontSize: 17, fontWeight: "700" },
  emptyText: { color: colors.muted, fontSize: 13, lineHeight: 21, textAlign: "center" },
  pressed: { opacity: 0.72 },
});
