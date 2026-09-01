import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";

import {
  createInvite,
  deleteGroup,
  getGathering,
  getGroup,
  leaveGroup,
  removeMember,
} from "../api";
import {
  Avatar,
  Button,
  Card,
  LoadingView,
  PageHeader,
  StateBadge,
} from "../components";
import { friendlyError } from "../errors";
import { colors } from "../theme";
import type { GatheringSnapshot, GroupDetail, Invite, User } from "../types";

function stateDescription(group: GroupDetail): string {
  if (group.state === "CANDIDATE") {
    return `${group.gatheringDurationSec}秒間、近くにいる状態が続くと集合です。`;
  }
  if (group.state === "GATHERED") {
    return "集合を検知しました。全員に通知しています。";
  }
  if (group.state === "LEAVING") {
    return `${Math.round(group.leavingDurationSec / 60)}分離れた状態が続くと解散します。`;
  }
  return `${group.requiredMemberCount}人が半径${group.gatheringRadiusM}m以内に集まるのを待っています。`;
}

export function GroupScreen({
  groupId,
  currentUser,
  onBack,
  onEdit,
  onRemoved,
  onStartRecording,
}: {
  groupId: string;
  currentUser: User;
  onBack: () => void;
  onEdit: (group: GroupDetail) => void;
  onRemoved: () => void;
  onStartRecording: (groupName: string) => void;
}) {
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [gathering, setGathering] = useState<GatheringSnapshot | null>(null);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyInvite, setBusyInvite] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const [nextGroup, nextGathering] = await Promise.all([
        getGroup(groupId),
        getGathering(groupId),
      ]);
      setGroup(nextGroup);
      setGathering(nextGathering);
      setError(null);
    } catch (loadError) {
      setError(friendlyError(loadError));
    } finally {
      if (!quiet) setRefreshing(false);
    }
  }, [groupId]);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(true), 15_000);
    return () => clearInterval(interval);
  }, [load]);

  const showInvite = async () => {
    setBusyInvite(true);
    setError(null);
    try {
      setInvite(await createInvite(groupId));
    } catch (inviteError) {
      setError(friendlyError(inviteError));
    } finally {
      setBusyInvite(false);
    }
  };

  const confirmRemoveMember = (userId: string, name: string) => {
    Alert.alert("メンバーを外しますか？", `${name}さんをグループから外します。`, [
      { text: "キャンセル", style: "cancel" },
      {
        text: "外す",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await removeMember(groupId, userId);
              await load();
            } catch (removeError) {
              setError(friendlyError(removeError));
            }
          })();
        },
      },
    ]);
  };

  const confirmExit = () => {
    if (!group) return;
    const leader = group.leaderUserId === currentUser.id;
    Alert.alert(
      leader ? "グループを削除しますか？" : "グループを抜けますか？",
      leader
        ? "メンバーと招待、集合状態がすべて削除されます。"
        : "再参加には新しい招待が必要です。",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: leader ? "削除" : "抜ける",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                if (leader) await deleteGroup(groupId);
                else await leaveGroup(groupId);
                onRemoved();
              } catch (exitError) {
                setError(friendlyError(exitError));
              }
            })();
          },
        },
      ],
    );
  };

  if (!group && refreshing) {
    return (
      <SafeAreaView style={styles.safe}>
        <PageHeader title="グループ" onBack={onBack} />
        <LoadingView />
      </SafeAreaView>
    );
  }

  if (!group) {
    return (
      <SafeAreaView style={styles.safe}>
        <PageHeader title="グループ" onBack={onBack} />
        <View style={styles.fatal}>
          <Text style={styles.error}>{error ?? "グループを読み込めませんでした。"}</Text>
          <Button title="もう一度試す" onPress={() => void load()} />
        </View>
      </SafeAreaView>
    );
  }

  const isLeader = group.leaderUserId === currentUser.id;
  return (
    <SafeAreaView style={styles.safe}>
      <PageHeader
        title={group.name}
        onBack={onBack}
        action={
          isLeader ? (
            <Pressable accessibilityRole="button" onPress={() => onEdit(group)}>
              <Text style={styles.edit}>設定</Text>
            </Pressable>
          ) : null
        }
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void load()} />
        }
      >
        <Card style={styles.stateCard}>
          <StateBadge state={group.state} />
          <Text style={styles.stateTitle}>{stateDescription(group)}</Text>
          <View style={styles.ruleRow}>
            <View style={styles.ruleItem}>
              <Text style={styles.ruleValue}>{group.requiredMemberCount}人</Text>
              <Text style={styles.ruleLabel}>集合人数</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.ruleItem}>
              <Text style={styles.ruleValue}>{group.gatheringRadiusM}m</Text>
              <Text style={styles.ruleLabel}>集合半径</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.ruleItem}>
              <Text style={styles.ruleValue}>{group.gatheringDurationSec}秒</Text>
              <Text style={styles.ruleLabel}>継続時間</Text>
            </View>
          </View>
        </Card>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {gathering?.recorderUserId || group.state === "GATHERED" ? (
          <Card style={styles.recordingCard}>
            {gathering?.recorderUserId ? (
              <>
                <Text style={styles.recordingTitle}>録音が始まっています</Text>
                <Text style={styles.recordingDescription}>
                  グループのメンバーがこの集合の録音を開始しました。
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.recordingTitle}>会話を記録しますか？</Text>
                <Text style={styles.recordingDescription}>
                  最初に開始した1名の端末だけに音声と文字起こしを保存します。
                </Text>
                <Button title="録音開始" onPress={() => onStartRecording(group.name)} />
              </>
            )}
          </Card>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>メンバー</Text>
          <Text style={styles.count}>{group.members.length} / 5</Text>
        </View>
        <Card style={styles.memberCard}>
          {group.members.map((member, index) => (
            <View
              key={member.id}
              style={[styles.memberRow, index > 0 && styles.memberBorder]}
            >
              <Avatar user={member} />
              <View style={styles.memberCopy}>
                <View style={styles.memberNameRow}>
                  <Text style={styles.memberName}>{member.displayName}</Text>
                  {member.isLeader ? <Text style={styles.leader}>リーダー</Text> : null}
                </View>
                <View style={styles.sharingRow}>
                  <View
                    style={[
                      styles.sharingDot,
                      member.isLocationSharing && styles.sharingDotOn,
                    ]}
                  />
                  <Text style={styles.sharingText}>
                    位置共有 {member.isLocationSharing ? "ON" : "OFF"}
                  </Text>
                </View>
              </View>
              {isLeader && !member.isLeader ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${member.displayName}さんを外す`}
                  hitSlop={10}
                  onPress={() => confirmRemoveMember(member.id, member.displayName)}
                >
                  <Text style={styles.remove}>外す</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </Card>

        <View style={styles.actions}>
          <Button
            disabled={busyInvite || group.members.length >= 5}
            title={busyInvite ? "招待を作成中…" : "招待QRコードを表示"}
            onPress={() => void showInvite()}
          />
          <Button
            title={isLeader ? "グループを削除" : "グループを抜ける"}
            variant="danger"
            onPress={confirmExit}
          />
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={() => setInvite(null)}
        transparent
        visible={invite !== null}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>仲間を招待</Text>
            <Text style={styles.modalText}>
              MONJUの「QRコードで参加」から読み取ってください。
            </Text>
            {invite ? (
              <View style={styles.qrWrap}>
                <QRCode
                  backgroundColor="white"
                  color={colors.ink}
                  size={220}
                  value={invite.deepLink}
                />
              </View>
            ) : null}
            <Text style={styles.expiry}>10分間・1回だけ有効です</Text>
            <Button title="閉じる" variant="secondary" onPress={() => setInvite(null)} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 18, paddingBottom: 38 },
  edit: { color: colors.primary, fontSize: 14, fontWeight: "700" },
  stateCard: { gap: 14 },
  stateTitle: { color: colors.ink, fontSize: 16, lineHeight: 24, fontWeight: "700" },
  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderRadius: 15,
    paddingVertical: 12,
  },
  ruleItem: { flex: 1, alignItems: "center", gap: 3 },
  ruleValue: { color: colors.ink, fontWeight: "800", fontSize: 15 },
  ruleLabel: { color: colors.muted, fontSize: 10 },
  divider: { width: StyleSheet.hairlineWidth, height: 27, backgroundColor: colors.line },
  error: {
    marginTop: 12,
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    padding: 12,
    borderRadius: 12,
    lineHeight: 19,
  },
  recordingCard: { marginTop: 12, gap: 12 },
  recordingTitle: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  recordingDescription: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  sectionHeader: {
    marginTop: 26,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  count: { color: colors.muted, fontSize: 13 },
  memberCard: { paddingVertical: 4 },
  memberRow: { flexDirection: "row", alignItems: "center", minHeight: 70, gap: 12 },
  memberBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  memberCopy: { flex: 1, gap: 5 },
  memberNameRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  memberName: { color: colors.ink, fontWeight: "700", fontSize: 15 },
  leader: {
    color: colors.primaryDark,
    backgroundColor: colors.primarySoft,
    fontSize: 9,
    fontWeight: "700",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sharingRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  sharingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#B9BFBA" },
  sharingDotOn: { backgroundColor: colors.primary },
  sharingText: { color: colors.muted, fontSize: 11 },
  remove: { color: colors.danger, fontSize: 12, fontWeight: "600" },
  actions: { marginTop: 24, gap: 10 },
  fatal: { flex: 1, justifyContent: "center", padding: 22, gap: 14 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(12, 20, 25, 0.48)",
    justifyContent: "center",
    padding: 22,
  },
  modalCard: {
    backgroundColor: "white",
    borderRadius: 26,
    padding: 22,
    alignItems: "stretch",
    gap: 13,
  },
  modalTitle: { color: colors.ink, fontSize: 22, fontWeight: "800", textAlign: "center" },
  modalText: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: "center" },
  qrWrap: { alignSelf: "center", backgroundColor: "white", padding: 12, borderRadius: 14 },
  expiry: { color: colors.warning, fontSize: 12, fontWeight: "600", textAlign: "center" },
});
