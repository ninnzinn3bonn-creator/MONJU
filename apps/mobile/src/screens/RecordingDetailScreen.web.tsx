import { useEffect, useMemo, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

import { Button, Card, PageHeader } from "../components";
import { deleteLocalRecording, formatDuration, getLocalRecording } from "../recordings";
import { colors } from "../theme";

export function RecordingDetailScreen({
  recordingId,
  onBack,
  onDeleted,
  onTranscribe,
}: {
  recordingId: string;
  onBack: () => void;
  onDeleted: () => void;
  onTranscribe: () => void;
}) {
  const recording = useMemo(() => getLocalRecording(recordingId), [recordingId]);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!playing || !recording) return;
    const interval = window.setInterval(() => {
      setElapsed((value) => {
        const next = value + 1000;
        if (next >= recording.durationMs) {
          setPlaying(false);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [playing, recording]);

  if (!recording) {
    return (
      <SafeAreaView style={styles.safe}>
        <PageHeader title="録音" onBack={onBack} />
        <View style={styles.missing}><Text style={styles.title}>録音が見つかりません</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <PageHeader title="録音" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{recording.groupName}</Text>
        <Text style={styles.date}>{new Date(recording.createdAt).toLocaleString("ja-JP")}</Text>
        <Card style={styles.playerCard}>
          <Text style={styles.time}>{formatDuration(elapsed)} / {formatDuration(recording.durationMs)}</Text>
          <Button title={playing ? "一時停止" : "再生"} onPress={() => setPlaying((value) => !value)} />
        </Card>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>文字起こし</Text>
          {recording.transcript ? (
            <Card><Text selectable style={styles.transcript}>{recording.transcript}</Text></Card>
          ) : (
            <Card style={styles.retryCard}>
              <Text style={styles.retryText}>文字起こしはまだありません。</Text>
              <Button title="文字起こしを実行" onPress={onTranscribe} variant="secondary" />
            </Card>
          )}
        </View>
        <Button
          title="録音を削除"
          variant="danger"
          onPress={() => {
            deleteLocalRecording(recordingId);
            onDeleted();
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 18, paddingBottom: 38, gap: 12 },
  title: { color: colors.ink, fontSize: 24, fontWeight: "800" },
  date: { color: colors.muted, fontSize: 13 },
  playerCard: { marginTop: 8, gap: 14 },
  time: { color: colors.ink, textAlign: "center", fontSize: 18, fontVariant: ["tabular-nums"] },
  section: { marginVertical: 10, gap: 10 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  transcript: { color: colors.ink, fontSize: 15, lineHeight: 25 },
  retryCard: { gap: 14 },
  retryText: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  missing: { flex: 1, alignItems: "center", justifyContent: "center" },
});
