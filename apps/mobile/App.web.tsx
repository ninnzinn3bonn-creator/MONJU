import { useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";

import { claimRecording, deleteMe, getGroup, listGroups } from "./src/api";
import { LoginScreen } from "./src/screens/LoginScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { GroupFormScreen } from "./src/screens/GroupFormScreen";
import { GroupScreen } from "./src/screens/GroupScreen";
import { InviteScannerScreen } from "./src/screens/InviteScannerScreen";
import { RecordingScreen } from "./src/screens/RecordingScreen";
import { TranscriptionScreen } from "./src/screens/TranscriptionScreen";
import { RecordingsScreen } from "./src/screens/RecordingsScreen";
import { RecordingDetailScreen } from "./src/screens/RecordingDetailScreen";
import { listLocalRecordings } from "./src/recordings";
import { colors } from "./src/theme";
import type { GroupSummary, Precision, Screen, Session } from "./src/types";

const previewSession: Session = {
  sessionToken: "monju-local-preview",
  user: {
    id: "user-me",
    displayName: "山田 太郎",
    profileImageUrl: null,
    createdAt: "2026-08-01T09:00:00.000Z",
    updatedAt: "2026-08-30T09:00:00.000Z",
  },
};

export default function App() {
  const [session, setSession] = useState<Session | null>(previewSession);
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [precision, setPrecision] = useState<Precision>("MEDIUM");
  const [authBusy, setAuthBusy] = useState(false);

  const refreshGroups = async () => setGroups(await listGroups());

  useEffect(() => {
    void refreshGroups();
  }, []);

  const beginRecording = async (groupId: string, knownGroupName?: string) => {
    await claimRecording(groupId);
    const groupName = knownGroupName ?? (await getGroup(groupId)).name;
    setScreen({ name: "recording", groupId, groupName });
  };

  const signIn = () => {
    setAuthBusy(true);
    window.setTimeout(() => {
      setSession(previewSession);
      setAuthBusy(false);
    }, 450);
  };

  const signOut = () => {
    setScreen({ name: "home" });
    setSession(null);
  };

  let content;
  if (!session) {
    content = (
      <LoginScreen busy={authBusy} error={null} onSignIn={signIn} />
    );
  } else if (screen.name === "createGroup") {
    content = (
      <GroupFormScreen
        onBack={() => setScreen({ name: "home" })}
        onSaved={(groupId) => {
          void refreshGroups();
          setScreen({ name: "group", groupId });
        }}
      />
    );
  } else if (screen.name === "editGroup") {
    content = (
      <GroupFormScreen
        initial={screen.group}
        onBack={() => setScreen({ name: "group", groupId: screen.group.id })}
        onSaved={(groupId) => {
          void refreshGroups();
          setScreen({ name: "group", groupId });
        }}
      />
    );
  } else if (screen.name === "scanInvite") {
    content = (
      <InviteScannerScreen
        onBack={() => setScreen({ name: "home" })}
        onJoined={(groupId) => {
          void refreshGroups();
          setScreen({ name: "group", groupId });
        }}
      />
    );
  } else if (screen.name === "group") {
    content = (
      <GroupScreen
        currentUser={session.user}
        groupId={screen.groupId}
        onBack={() => {
          void refreshGroups();
          setScreen({ name: "home" });
        }}
        onEdit={(group) => setScreen({ name: "editGroup", group })}
        onStartRecording={(groupName) =>
          void beginRecording(screen.groupId, groupName)
        }
        onRemoved={() => {
          void refreshGroups();
          setScreen({ name: "home" });
        }}
      />
    );
  } else if (screen.name === "recording") {
    content = (
      <RecordingScreen
        groupId={screen.groupId}
        groupName={screen.groupName}
        onFailed={() => setScreen({ name: "group", groupId: screen.groupId })}
        onSaved={(recordingId) => setScreen({ name: "transcribing", recordingId })}
      />
    );
  } else if (screen.name === "transcribing") {
    content = (
      <TranscriptionScreen
        recordingId={screen.recordingId}
        onCompleted={() =>
          setScreen({ name: "recordingDetail", recordingId: screen.recordingId })
        }
      />
    );
  } else if (screen.name === "recordings") {
    content = (
      <RecordingsScreen
        onBack={() => setScreen({ name: "home" })}
        onSelect={(recordingId) => setScreen({ name: "recordingDetail", recordingId })}
      />
    );
  } else if (screen.name === "recordingDetail") {
    content = (
      <RecordingDetailScreen
        recordingId={screen.recordingId}
        onBack={() => setScreen({ name: "recordings" })}
        onDeleted={() => setScreen({ name: "recordings" })}
        onTranscribe={() => setScreen({ name: "transcribing", recordingId: screen.recordingId })}
      />
    );
  } else {
    content = (
      <HomeScreen
        error={null}
        groups={groups}
        locationBusy={false}
        locationEnabled={locationEnabled}
        onCreate={() => setScreen({ name: "createGroup" })}
        onDeleteAccount={() => {
          void deleteMe().then(signOut);
        }}
        onRefresh={() => void refreshGroups()}
        onOpenRecordings={() => setScreen({ name: "recordings" })}
        onScan={() => setScreen({ name: "scanInvite" })}
        onSelectGroup={(groupId) => setScreen({ name: "group", groupId })}
        onSignOut={() => {
          Alert.alert("ログアウトしますか？", "位置情報の共有も停止します。", [
            { text: "キャンセル", style: "cancel" },
            { text: "ログアウト", onPress: signOut },
          ]);
        }}
        onToggleLocation={(enabled) => {
          setLocationEnabled(enabled);
          setPrecision(enabled ? "MEDIUM" : "LOW");
        }}
        precision={precision}
        recordingCount={listLocalRecordings().length}
        refreshing={false}
        user={session.user}
      />
    );
  }

  return (
    <View style={styles.canvas}>
      <View style={styles.phone}>{content}</View>
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    backgroundColor: "#E3E8E4",
    alignItems: "center",
  },
  phone: {
    flex: 1,
    width: "100%",
    maxWidth: 430,
    backgroundColor: colors.background,
    shadowColor: "#10251F",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
  },
});
