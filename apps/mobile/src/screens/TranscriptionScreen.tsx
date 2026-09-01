import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
} from "react-native";

import { Button } from "../components";
import {
  getLocalRecording,
  markTranscriptionFailed,
  saveTranscript,
} from "../recordings";
import { colors } from "../theme";

export function TranscriptionScreen({
  recordingId,
  onCompleted,
}: {
  recordingId: string;
  onCompleted: () => void;
}) {
  const recording = useMemo(() => getLocalRecording(recordingId), [recordingId]);
  const [running, setRunning] = useState(recording !== null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [recognitionMode, setRecognitionMode] = useState<"端末内" | "オンライン">(
    Platform.OS === "android" ? "オンライン" : "端末内",
  );
  const finalPartsRef = useRef<string[]>([]);
  const failedRef = useRef(false);
  const startedRef = useRef(false);
  const activeRecognitionRef = useRef(false);

  useSpeechRecognitionEvent("result", (event) => {
    const next = event.results[0]?.transcript.trim() ?? "";
    if (!next) return;
    if (event.isFinal) {
      const last = finalPartsRef.current.at(-1);
      if (last !== next) finalPartsRef.current.push(next);
      setPreview(finalPartsRef.current.join("\n"));
    } else {
      setPreview([...finalPartsRef.current, next].join("\n"));
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    if (event.error === "aborted") return;
    activeRecognitionRef.current = false;
    failedRef.current = true;
    setRunning(false);
    markTranscriptionFailed(recordingId);
    setError(event.message || "文字起こしに失敗しました。");
  });

  useSpeechRecognitionEvent("end", () => {
    activeRecognitionRef.current = false;
    setRunning(false);
    if (failedRef.current) return;
    const transcript = finalPartsRef.current.join("\n").trim();
    if (!transcript) {
      failedRef.current = true;
      markTranscriptionFailed(recordingId);
      setError("音声を認識できませんでした。再試行できます。");
      return;
    }
    saveTranscript(recordingId, transcript);
    onCompleted();
  });

  const start = useCallback(
    async (onDevice: boolean) => {
      if (!recording) return;
      setError(null);
      setPreview("");
      finalPartsRef.current = [];
      failedRef.current = false;
      setRecognitionMode(onDevice ? "端末内" : "オンライン");
      setRunning(true);
      try {
        if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
          throw new Error("この端末では音声認識を利用できません。");
        }
        if (
          Platform.OS === "android" &&
          !ExpoSpeechRecognitionModule.supportsRecording()
        ) {
          throw new Error(
            "録音ファイルの文字起こしにはAndroid 13以上が必要です。",
          );
        }

        if (!onDevice && Platform.OS === "ios") {
          const permission =
            await ExpoSpeechRecognitionModule.requestSpeechRecognizerPermissionsAsync();
          if (!permission.granted) {
            throw new Error("オンライン音声認識の権限が必要です。");
          }
        }

        activeRecognitionRef.current = true;
        ExpoSpeechRecognitionModule.start({
          lang: "ja-JP",
          interimResults: true,
          requiresOnDeviceRecognition: onDevice,
          addsPunctuation: true,
          audioSource: { uri: recording.audioUri },
        });
      } catch (startError) {
        activeRecognitionRef.current = false;
        failedRef.current = true;
        setRunning(false);
        markTranscriptionFailed(recordingId);
        setError(
          startError instanceof Error
            ? startError.message
            : "文字起こしを開始できませんでした。",
        );
      }
    },
    [recording, recordingId],
  );

  useEffect(() => {
    if (startedRef.current || !recording) return;
    startedRef.current = true;
    const onDevice =
      Platform.OS === "ios" &&
      ExpoSpeechRecognitionModule.supportsOnDeviceRecognition();
    void start(onDevice);
    return () => {
      if (activeRecognitionRef.current) ExpoSpeechRecognitionModule.abort();
    };
  }, [recording, start]);

  if (!recording) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.title}>録音が見つかりません</Text>
          <Button title="録音一覧へ" onPress={onCompleted} variant="secondary" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.center}>
        {running ? <ActivityIndicator color={colors.primary} size="large" /> : null}
        <Text style={styles.title}>{running ? "文字起こし中…" : "文字起こしを完了できませんでした"}</Text>
        <Text style={styles.description}>
          {running
            ? `${recognitionMode}音声認識で録音を処理しています。アプリを開いたままお待ちください。`
            : error}
        </Text>
        {preview ? <Text style={styles.preview}>{preview}</Text> : null}
        {!running ? (
          <View style={styles.actions}>
            {ExpoSpeechRecognitionModule.supportsOnDeviceRecognition() ? (
              <Button title="端末内で再試行" onPress={() => void start(true)} />
            ) : null}
            <Button
              title="オンライン認識で再試行"
              onPress={() => void start(false)}
              variant="secondary"
            />
            <Button title="あとで行う" onPress={onCompleted} variant="ghost" />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 26,
    gap: 18,
  },
  title: { color: colors.ink, fontSize: 22, fontWeight: "800", textAlign: "center" },
  description: { color: colors.muted, fontSize: 14, lineHeight: 22, textAlign: "center" },
  preview: {
    alignSelf: "stretch",
    color: colors.ink,
    fontSize: 15,
    lineHeight: 24,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 18,
  },
  actions: { alignSelf: "stretch", gap: 10 },
});
