import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useMemo } from "react";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

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
  const player = useAudioPlayer(recording?.audioUri ?? null);
  const status = useAudioPlayerStatus(player);

  if (!recording) {
    return (
      <SafeAreaView style={styles.safe}>
        <PageHeader title="録音" onBack={onBack} />
        <View style={styles.missing}>
          <Text style={styles.title}>録音が見つかりません</Text>
        </View>
      </SafeAreaView>
    );
  }

  const confirmDelete = () => {
    Alert.alert("録音を削除しますか？", "音声と文字起こしをこの端末から削除します。", [
      { text: "キャンセル", style: "cancel" },
      {
        text: "削除",
        style: "destructive",
        onPress: () => {
          player.pause();
          deleteLocalRecording(recordingId);
          onDeleted();
        },
      },
    ]);
  };

  const togglePlayback = async () => {
    if (status.playing) {
      player.pause();
      return;
    }
    if (status.didJustFinish) await player.seekTo(0);
    player.play();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <PageHeader title="録音" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{recording.groupName}</Text>
        <Text style={styles.date}>
          {new Date(recording.createdAt).toLocaleString("ja-JP")}
        </Text>

        <Card style={styles.playerCard}>
          <Text style={styles.time}>
            {formatDuration(status.currentTime * 1000)} / {formatDuration(recording.durationMs)}
          </Text>
          <Button
            disabled={!status.isLoaded}
            title={status.playing ? "一時停止" : "再生"}
            onPress={() => void togglePlayback()}
          />
        </Card>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>文字起こし</Text>
          {recording.transcript ? (
            <Card>
              <Text selectable style={styles.transcript}>{recording.transcript}</Text>
            </Card>
          ) : (
            <Card style={styles.retryCard}>
              <Text style={styles.retryText}>
                {recording.transcriptionStatus === "FAILED"
                  ? "文字起こしを完了できませんでした。音声は保存されています。"
                  : "文字起こしはまだありません。"}
              </Text>
              <Button title="文字起こしを実行" onPress={onTranscribe} variant="secondary" />
            </Card>
          )}
        </View>

        <Button title="録音を削除" onPress={confirmDelete} variant="danger" />
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
