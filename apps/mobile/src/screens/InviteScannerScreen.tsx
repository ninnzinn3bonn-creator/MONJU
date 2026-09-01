import { CameraView, useCameraPermissions } from "expo-camera";
import { useState } from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";

import { joinInvite } from "../api";
import { Button, PageHeader } from "../components";
import { friendlyError } from "../errors";
import { colors } from "../theme";

const INVITE_PATTERN = /^monju:\/\/invite\/([A-Za-z0-9_-]{32,128})$/;

export function InviteScannerScreen({
  onBack,
  onJoined,
}: {
  onBack: () => void;
  onJoined: (groupId: string) => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const scan = async (data: string) => {
    if (!scanning) return;
    const match = INVITE_PATTERN.exec(data.trim());
    if (!match?.[1]) {
      setScanning(false);
      setError("MONJUの招待QRコードではありません。");
      return;
    }

    setScanning(false);
    setError(null);
    try {
      onJoined(await joinInvite(match[1]));
    } catch (joinError) {
      setError(friendlyError(joinError));
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <PageHeader title="QRコードで参加" onBack={onBack} />
      <View style={styles.content}>
        {!permission ? (
          <Text style={styles.message}>カメラの状態を確認しています…</Text>
        ) : !permission.granted ? (
          <View style={styles.permission}>
            <Text style={styles.permissionTitle}>カメラの許可が必要です</Text>
            <Text style={styles.message}>
              招待QRコードを読み取るためだけにカメラを使用します。
            </Text>
            <Button title="カメラを許可" onPress={() => void requestPermission()} />
          </View>
        ) : (
          <>
            <View style={styles.cameraShell}>
              <CameraView
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={
                  scanning ? ({ data }) => void scan(data) : undefined
                }
                style={StyleSheet.absoluteFill}
              />
              <View pointerEvents="none" style={styles.target}>
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
              </View>
            </View>
            <Text style={styles.message}>
              仲間の画面に表示されたQRコードを枠内に入れてください。
            </Text>
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.error}>{error}</Text>
                <Button
                  compact
                  title="もう一度読み取る"
                  variant="secondary"
                  onPress={() => {
                    setError(null);
                    setScanning(true);
                  }}
                />
              </View>
            ) : !scanning ? (
              <Text style={styles.joining}>グループに参加しています…</Text>
            ) : null}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, padding: 18, alignItems: "center", gap: 20 },
  cameraShell: {
    width: "100%",
    aspectRatio: 1,
    maxHeight: 450,
    overflow: "hidden",
    borderRadius: 26,
    backgroundColor: colors.ink,
  },
  target: {
    position: "absolute",
    left: "17%",
    right: "17%",
    top: "17%",
    bottom: "17%",
  },
  corner: {
    position: "absolute",
    width: 42,
    height: 42,
    borderColor: "white",
  },
  topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 },
  topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },
  permission: { flex: 1, justifyContent: "center", width: "100%", gap: 18 },
  permissionTitle: { color: colors.ink, textAlign: "center", fontSize: 20, fontWeight: "800" },
  message: { color: colors.muted, textAlign: "center", fontSize: 14, lineHeight: 22 },
  errorBox: { width: "100%", gap: 12 },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    padding: 12,
    borderRadius: 12,
    textAlign: "center",
  },
  joining: { color: colors.primary, fontWeight: "700" },
});
