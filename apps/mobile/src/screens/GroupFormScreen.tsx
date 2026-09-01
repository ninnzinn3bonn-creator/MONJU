import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { createGroup, updateGroup } from "../api";
import { Button, Card, PageHeader } from "../components";
import { friendlyError } from "../errors";
import { colors } from "../theme";
import type { GroupDetail } from "../types";

function NumberField({
  label,
  value,
  suffix,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  suffix: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.numberRow}>
        <TextInput
          accessibilityLabel={label}
          keyboardType="number-pad"
          onChangeText={onChange}
          style={[styles.input, styles.numberInput]}
          value={value}
        />
        <Text style={styles.suffix}>{suffix}</Text>
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function GroupFormScreen({
  initial,
  onBack,
  onSaved,
}: {
  initial?: GroupDetail;
  onBack: () => void;
  onSaved: (groupId: string) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [required, setRequired] = useState(
    String(initial?.requiredMemberCount ?? 2),
  );
  const [radius, setRadius] = useState(String(initial?.gatheringRadiusM ?? 50));
  const [duration, setDuration] = useState(
    String(initial?.gatheringDurationSec ?? 60),
  );
  const [leaving, setLeaving] = useState(
    String(initial?.leavingDurationSec ?? 600),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const memberCount = Number(required);
    const radiusM = Number(radius);
    const durationSec = Number(duration);
    const leavingSec = Number(leaving);
    if (!name.trim()) {
      setError("グループ名を入力してください。");
      return;
    }
    if (!Number.isInteger(memberCount) || memberCount < 2 || memberCount > 5) {
      setError("集合人数は2〜5人で入力してください。");
      return;
    }
    if (
      initial &&
      (!Number.isInteger(radiusM) ||
        radiusM < 10 ||
        radiusM > 500 ||
        !Number.isInteger(durationSec) ||
        durationSec < 10 ||
        durationSec > 3600 ||
        !Number.isInteger(leavingSec) ||
        leavingSec < 60 ||
        leavingSec > 86400)
    ) {
      setError("設定値の範囲を確認してください。");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (initial) {
        await updateGroup(initial.id, {
          name: name.trim(),
          requiredMemberCount: memberCount,
          gatheringRadiusM: radiusM,
          gatheringDurationSec: durationSec,
          leavingDurationSec: leavingSec,
        });
        onSaved(initial.id);
      } else {
        onSaved(await createGroup(name.trim(), memberCount));
      }
    } catch (submitError) {
      setError(friendlyError(submitError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <PageHeader
        title={initial ? "グループ設定" : "グループを作る"}
        onBack={onBack}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Card style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>グループ名</Text>
              <TextInput
                accessibilityLabel="グループ名"
                autoCapitalize="none"
                maxLength={80}
                onChangeText={setName}
                placeholder="例：プロダクトチーム"
                placeholderTextColor="#9AA19B"
                style={styles.input}
                value={name}
              />
            </View>
            <NumberField
              label="集合とみなす人数"
              value={required}
              suffix="人"
              onChange={setRequired}
              hint="2〜5人"
            />
            {initial ? (
              <>
                <NumberField
                  label="集合半径"
                  value={radius}
                  suffix="m"
                  onChange={setRadius}
                  hint="中心点から10〜500m"
                />
                <NumberField
                  label="集合の継続時間"
                  value={duration}
                  suffix="秒"
                  onChange={setDuration}
                  hint="10〜3,600秒"
                />
                <NumberField
                  label="解散までの時間"
                  value={leaving}
                  suffix="秒"
                  onChange={setLeaving}
                  hint="60〜86,400秒"
                />
              </>
            ) : null}
          </Card>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            disabled={busy}
            title={busy ? "保存中…" : initial ? "設定を保存" : "作成する"}
            onPress={() => void submit()}
          />
          {!initial ? (
            <Text style={styles.note}>
              半径50m・60秒継続・10分で解散を初期値として作成します。
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: 18, gap: 14, paddingBottom: 36 },
  form: { gap: 22 },
  field: { gap: 8 },
  label: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    color: colors.ink,
    backgroundColor: "#FBFCFA",
    fontSize: 16,
  },
  numberRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  numberInput: { width: 130 },
  suffix: { color: colors.ink, fontSize: 15, fontWeight: "600" },
  hint: { color: colors.muted, fontSize: 12 },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: 12,
    padding: 12,
  },
  note: { color: colors.muted, fontSize: 12, lineHeight: 19, textAlign: "center" },
});
