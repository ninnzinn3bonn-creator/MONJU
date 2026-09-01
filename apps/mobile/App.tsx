import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  SafeAreaView,
  StyleSheet,
} from "react-native";

import {
  ApiError,
  claimRecording,
  deleteMe,
  getGroup,
  getMe,
  listGroups,
} from "./src/api";
import { LoadingView } from "./src/components";
import { friendlyError } from "./src/errors";
import { signInWithGoogle, signOutFromGoogle } from "./src/google-auth";
import {
  disableLocationSharing,
  enableLocationSharing,
  isLocationSharingEnabled,
  reconcileLocationTracking,
} from "./src/location";
import {
  configureNotifications,
  getGroupIdFromNotification,
  registerPushNotifications,
  START_RECORDING_ACTION,
} from "./src/notifications";
import { ensureMicrophonePermission } from "./src/recording-permissions";
import { listLocalRecordings } from "./src/recordings";
import { GroupFormScreen } from "./src/screens/GroupFormScreen";
import { GroupScreen } from "./src/screens/GroupScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { InviteScannerScreen } from "./src/screens/InviteScannerScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { RecordingDetailScreen } from "./src/screens/RecordingDetailScreen";
import { RecordingScreen } from "./src/screens/RecordingScreen";
import { RecordingsScreen } from "./src/screens/RecordingsScreen";
import { TranscriptionScreen } from "./src/screens/TranscriptionScreen";
import { clearSession, loadStoredSession, saveSession } from "./src/storage";
import { colors } from "./src/theme";
import type { GroupSummary, Precision, Screen, Session } from "./src/types";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [homeError, setHomeError] = useState<string | null>(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [precision, setPrecision] = useState<Precision>("LOW");
  const recordingClaimRef = useRef(false);

  const refreshGroups = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      setGroups(await listGroups());
      setHomeError(null);
    } catch (error) {
      setHomeError(friendlyError(error));
      if (error instanceof ApiError && error.status === 401) {
        await clearSession();
        setSession(null);
      }
    } finally {
      if (!quiet) setRefreshing(false);
    }
  }, []);

  const beginRecording = useCallback(
    async (groupId: string, knownGroupName?: string) => {
      if (recordingClaimRef.current) return;
      recordingClaimRef.current = true;
      try {
        const permissionGranted = await ensureMicrophonePermission();
        if (!permissionGranted) {
          Alert.alert(
            "マイクを使用できません",
            "録音を開始するには、設定からMONJUのマイク利用を許可してください。",
          );
          setScreen({ name: "group", groupId });
          return;
        }

        const groupName = knownGroupName ?? (await getGroup(groupId)).name;
        await claimRecording(groupId);
        setScreen({ name: "recording", groupId, groupName });
      } catch (error) {
        Alert.alert("録音を開始できませんでした", friendlyError(error));
        setScreen({ name: "group", groupId });
      } finally {
        recordingClaimRef.current = false;
      }
    },
    [],
  );

  useEffect(() => {
    void (async () => {
      try {
        const stored = await loadStoredSession();
        if (!stored) return;
        const user = await getMe(stored.token);
        await saveSession(stored.token, user);
        setSession({ sessionToken: stored.token, user });
      } catch {
        await clearSession();
      } finally {
        setRestoring(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!session) return;
    void refreshGroups();
    void (async () => {
      try {
        await configureNotifications();
        await registerPushNotifications();
      } catch (error) {
        console.warn("MONJU push registration failed", friendlyError(error));
      }
      try {
        setLocationEnabled(await isLocationSharingEnabled());
        setPrecision(await reconcileLocationTracking());
      } catch (error) {
        console.warn("MONJU location reconciliation failed", friendlyError(error));
      }
    })();
  }, [refreshGroups, session]);

  useEffect(() => {
    if (!session) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      void (async () => {
        setLocationEnabled(await isLocationSharingEnabled());
        setPrecision(await reconcileLocationTracking());
        if (screen.name === "home") await refreshGroups(true);
      })();
    });
    return () => subscription.remove();
  }, [refreshGroups, screen.name, session]);

  useEffect(() => {
    if (!session) return;
    const handleResponse = (response: Notifications.NotificationResponse) => {
      const groupId = getGroupIdFromNotification(response);
      if (!groupId) return;
      if (screen.name === "recording" || screen.name === "transcribing") return;
      if (response.actionIdentifier === START_RECORDING_ACTION) {
        void beginRecording(groupId);
      } else {
        setScreen({ name: "group", groupId });
      }
    };
    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse) {
      handleResponse(lastResponse);
      Notifications.clearLastNotificationResponse();
    }
    const subscription =
      Notifications.addNotificationResponseReceivedListener(handleResponse);
    return () => subscription.remove();
  }, [beginRecording, screen.name, session]);

  const handleSignIn = async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      const nextSession = await signInWithGoogle();
      if (nextSession) setSession(nextSession);
    } catch (error) {
      setAuthError(friendlyError(error));
    } finally {
      setAuthBusy(false);
    }
  };

  const performSignOut = async () => {
    await disableLocationSharing();
    await Promise.all([clearSession(), signOutFromGoogle()]);
    setLocationEnabled(false);
    setGroups([]);
    setScreen({ name: "home" });
    setSession(null);
  };

  const confirmSignOut = () => {
    Alert.alert("ログアウトしますか？", "位置情報の共有も停止します。", [
      { text: "キャンセル", style: "cancel" },
      { text: "ログアウト", onPress: () => void performSignOut() },
    ]);
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      "アカウントを削除しますか？",
      "作成したグループを含むMONJUのデータが削除されます。この操作は取り消せません。",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "削除",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await deleteMe();
                await performSignOut();
              } catch (error) {
                setHomeError(friendlyError(error));
              }
            })();
          },
        },
      ],
    );
  };

  const toggleLocation = async (enabled: boolean) => {
    setLocationBusy(true);
    setHomeError(null);
    try {
      if (enabled) {
        setPrecision(await enableLocationSharing());
        setLocationEnabled(true);
      } else {
        await disableLocationSharing();
        setLocationEnabled(false);
        setPrecision("LOW");
      }
      await refreshGroups(true);
    } catch (error) {
      setLocationEnabled(await isLocationSharingEnabled());
      setHomeError(friendlyError(error));
    } finally {
      setLocationBusy(false);
    }
  };

  if (restoring) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingView label="MONJUを準備しています…" />
        <StatusBar style="dark" />
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <>
        <LoginScreen busy={authBusy} error={authError} onSignIn={() => void handleSignIn()} />
        <StatusBar style="dark" />
      </>
    );
  }

  let content;
  if (screen.name === "createGroup") {
    content = (
      <GroupFormScreen
        onBack={() => setScreen({ name: "home" })}
        onSaved={(groupId) => {
          void refreshGroups(true);
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
          void refreshGroups(true);
          setScreen({ name: "group", groupId });
        }}
      />
    );
  } else if (screen.name === "scanInvite") {
    content = (
      <InviteScannerScreen
        onBack={() => setScreen({ name: "home" })}
        onJoined={(groupId) => {
          void refreshGroups(true);
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
          void refreshGroups(true);
          setScreen({ name: "home" });
        }}
        onEdit={(group) => setScreen({ name: "editGroup", group })}
        onStartRecording={(groupName) =>
          void beginRecording(screen.groupId, groupName)
        }
        onRemoved={() => {
          void refreshGroups(true);
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
        onTranscribe={() =>
          setScreen({ name: "transcribing", recordingId: screen.recordingId })
        }
      />
    );
  } else {
    content = (
      <HomeScreen
        error={homeError}
        groups={groups}
        locationBusy={locationBusy}
        locationEnabled={locationEnabled}
        onCreate={() => setScreen({ name: "createGroup" })}
        onDeleteAccount={confirmDeleteAccount}
        onRefresh={() => void refreshGroups()}
        onOpenRecordings={() => setScreen({ name: "recordings" })}
        onScan={() => setScreen({ name: "scanInvite" })}
        onSelectGroup={(groupId) => setScreen({ name: "group", groupId })}
        onSignOut={confirmSignOut}
        onToggleLocation={(enabled) => void toggleLocation(enabled)}
        precision={precision}
        recordingCount={listLocalRecordings().length}
        refreshing={refreshing}
        user={session.user}
      />
    );
  }

  return (
    <>
      {content}
      <StatusBar style="dark" />
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
});
