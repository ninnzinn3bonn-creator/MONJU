import {
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Button } from "../components";
import { friendlyError } from "../errors";
import {
  formatDuration,
  MAX_RECORDING_DURATION_SECONDS,
  saveLocalRecording,
} from "../recordings";
import { colors } from "../theme";

const recordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  directory: "document" as const,
  numberOfChannels: 1,
  bitRate: 96_000,
};

export function RecordingScreen({
  groupId,
  groupName,
  onSaved,
  onFailed,
}: {
  groupId: string;
  groupName: string;
  onSaved: (recordingId: string) => void;
  onFailed: () => void;
}) {
  const recorder = useAudioRecorder(recordingOptions);
  const recorderState = useAudioRecorderState(recorder, 250);
  const [starting, setStarting] = useState(true);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasRecordedRef = useRef(false);
  const finalizingRef = useRef(false);
  const durationRef = useRef(0);

  durationRef.current = Math.max(durationRef.current, recorderState.durationMillis);

  const finalize = useCallback(
    async (stopNative: boolean) => {
      if (finalizingRef.current) return;
      finalizingRef.current = true;
      setStopping(true);
      try {
        if (stopNative && recorder.isRecording) await recorder.stop();
        const uri = recorder.uri ?? recorder.getStatus().url;
        if (!uri) throw new Error("録音ファイルを取得できませんでした。");
        const recording = await saveLocalRecording(uri, {
          groupId,
          groupName,
          durationMs: Math.min(
            durationRef.current,
            MAX_RECORDING_DURATION_SECONDS * 1000,
          ),
        });
        await setAudioModeAsync({ allowsRecording: false });
        onSaved(recording.id);
      } catch (saveError) {
        finalizingRef.current = false;
        setStopping(false);
        setError(friendlyError(saveError));
      }
    },
    [groupId, groupName, onSaved, recorder],
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await setAudioModeAsync({
          allowsRecording: true,
          allowsBackgroundRecording: true,
          playsInSilentMode: true,
        });
        await recorder.prepareToRecordAsync();
        recorder.record({ forDuration: MAX_RECORDING_DURATION_SECONDS });
        if (active) setStarting(false);
      } catch (startError) {
        if (active) {
          setStarting(false);
          setError(friendlyError(startError));
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [recorder]);

  useEffect(() => {
    if (recorderState.isRecording) {
      hasRecordedRef.current = true;
      return;
    }
    if (
      hasRecordedRef.current &&
      !finalizingRef.current &&
      durationRef.current >= (MAX_RECORDING_DURATION_SECONDS - 1) * 1000
    ) {
      void finalize(false);
    }
  }, [finalize, recorderState.isRecording]);

  if (error && !hasRecordedRef.current) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errorTitle}>録音を開始できませんでした</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="グループへ戻る" onPress={onFailed} variant="secondary" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <View style={styles.recordingLabel}>
          <View style={styles.redDot} />
          <Text style={styles.recordingText}>
            {starting ? "録音を準備中" : stopping ? "保存中" : "録音中"}
          </Text>
        </View>
        <Text accessibilityLabel={`録音時間 ${formatDuration(recorderState.durationMillis)}`} style={styles.timer}>
          {formatDuration(recorderState.durationMillis)}
        </Text>
        <Text style={styles.limit}>最大 1:00:00</Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {starting || stopping ? (
          <ActivityIndicator color={colors.primary} size="large" />
        ) : (
          <Button title="録音を停止" onPress={() => void finalize(true)} variant="danger" />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
    gap: 22,
  },
  recordingLabel: { flexDirection: "row", alignItems: "center", gap: 10 },
  redDot: { width: 13, height: 13, borderRadius: 7, backgroundColor: colors.danger },
  recordingText: { color: colors.ink, fontSize: 18, fontWeight: "700" },
  timer: {
    color: colors.ink,
    fontSize: 56,
    lineHeight: 66,
    fontWeight: "300",
    fontVariant: ["tabular-nums"],
  },
  limit: { color: colors.muted, fontSize: 13 },
  errorTitle: { color: colors.ink, fontSize: 21, fontWeight: "800", textAlign: "center" },
  errorText: { color: colors.danger, fontSize: 13, lineHeight: 20, textAlign: "center" },
});
