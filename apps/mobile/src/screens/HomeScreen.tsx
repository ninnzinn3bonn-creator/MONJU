import {
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import { Avatar, BrandMark, Button, Card, StateBadge } from "../components";
import { colors } from "../theme";
import type { GroupSummary, Precision, User } from "../types";

const precisionLabel: Record<Precision, string> = {
  LOW: "省電力",
  MEDIUM: "標準",
  HIGH: "集合確認中",
};

export function HomeScreen({
  user,
  groups,
  refreshing,
  locationEnabled,
  precision,
  locationBusy,
  error,
  onRefresh,
  onToggleLocation,
  onSelectGroup,
  onCreate,
  onScan,
  recordingCount,
  onOpenRecordings,
  onSignOut,
  onDeleteAccount,
}: {
  user: User;
  groups: GroupSummary[];
  refreshing: boolean;
  locationEnabled: boolean;
  precision: Precision;
  locationBusy: boolean;
  error: string | null;
  onRefresh: () => void;
  onToggleLocation: (enabled: boolean) => void;
  onSelectGroup: (groupId: string) => void;
  onCreate: () => void;
  onScan: () => void;
  recordingCount: number;
  onOpenRecordings: () => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.topbar}>
          <BrandMark compact />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="ログアウト"
            onLongPress={onSignOut}
            onPress={onSignOut}
          >
            <Avatar user={user} size={38} />
          </Pressable>
        </View>

        <View style={styles.greeting}>
          <Text style={styles.eyebrow}>こんにちは</Text>
          <Text style={styles.title}>{user.displayName}さん</Text>
        </View>

        <Card style={styles.locationCard}>
          <View style={styles.locationCopy}>
            <View style={styles.labelRow}>
              <View
                style={[
                  styles.liveDot,
                  locationEnabled && styles.liveDotEnabled,
                ]}
              />
              <Text style={styles.cardTitle}>位置情報を共有</Text>
            </View>
            <Text style={styles.cardDescription}>
              {locationEnabled
                ? `${precisionLabel[precision]}モードで集合を確認しています`
                : "OFFの間は集合判定に含まれません"}
            </Text>
          </View>
          <Switch
            accessibilityLabel="位置情報の共有"
            disabled={locationBusy}
            onValueChange={onToggleLocation}
            trackColor={{ false: "#CBD1CC", true: "#8BCFC2" }}
            thumbColor={locationEnabled ? colors.primary : "#F8F8F8"}
            value={locationEnabled}
          />
        </Card>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>マイグループ</Text>
          <Text style={styles.count}>{groups.length} / 5</Text>
        </View>

        {groups.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>三</Text>
            <Text style={styles.emptyTitle}>まずはグループを作ろう</Text>
            <Text style={styles.emptyText}>
              仲間をQRコードで招待すると、集合を自動で判定できます。
            </Text>
          </Card>
        ) : (
          <View style={styles.groupList}>
            {groups.map((group) => (
              <Pressable
                accessibilityRole="button"
                key={group.id}
                onPress={() => onSelectGroup(group.id)}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Card style={styles.groupCard}>
                  <View style={styles.groupTop}>
                    <Text numberOfLines={1} style={styles.groupName}>
                      {group.name}
                    </Text>
                    <Text style={styles.chevron}>›</Text>
                  </View>
                  <View style={styles.groupMeta}>
                    <StateBadge state={group.state} />
                    <Text style={styles.memberCount}>
                      {group.memberCount}人 ・ {group.requiredMemberCount}人で集合
                    </Text>
                  </View>
                </Card>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.actions}>
          <Button
            disabled={groups.length >= 5}
            title="グループを作る"
            onPress={onCreate}
          />
          <Button title="QRコードで参加" onPress={onScan} variant="secondary" />
          <Button
            title={`録音を見る${recordingCount > 0 ? `（${recordingCount}件）` : ""}`}
            onPress={onOpenRecordings}
            variant="ghost"
          />
        </View>
        <View style={styles.accountActions}>
          <Pressable accessibilityRole="button" onPress={onSignOut}>
            <Text style={styles.accountAction}>ログアウト</Text>
          </Pressable>
          <Text style={styles.accountSeparator}>・</Text>
          <Pressable accessibilityRole="button" onPress={onDeleteAccount}>
            <Text style={[styles.accountAction, styles.deleteAction]}>アカウント削除</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 18, paddingBottom: 34 },
  topbar: {
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  greeting: { marginTop: 12, marginBottom: 22 },
  eyebrow: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  title: { color: colors.ink, fontSize: 28, fontWeight: "800", marginTop: 3 },
  locationCard: { flexDirection: "row", alignItems: "center", gap: 14 },
  locationCopy: { flex: 1, gap: 6 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#AEB5AF" },
  liveDotEnabled: { backgroundColor: colors.primary },
  cardTitle: { color: colors.ink, fontWeight: "700", fontSize: 16 },
  cardDescription: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  error: {
    marginTop: 12,
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    padding: 12,
    borderRadius: 12,
    lineHeight: 19,
  },
  sectionHeader: {
    marginTop: 30,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  count: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  emptyCard: { alignItems: "center", paddingVertical: 30, gap: 9 },
  emptyIcon: {
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    fontSize: 22,
    fontWeight: "900",
    width: 48,
    height: 48,
    lineHeight: 48,
    borderRadius: 16,
    textAlign: "center",
  },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 260,
  },
  groupList: { gap: 12 },
  groupCard: { gap: 13 },
  groupTop: { flexDirection: "row", alignItems: "center" },
  groupName: { flex: 1, color: colors.ink, fontSize: 18, fontWeight: "700" },
  chevron: { color: colors.muted, fontSize: 28, lineHeight: 28 },
  groupMeta: { flexDirection: "row", alignItems: "center", gap: 10 },
  memberCount: { color: colors.muted, fontSize: 12 },
  pressed: { opacity: 0.72 },
  actions: { marginTop: 22, gap: 10 },
  accountActions: {
    marginTop: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  accountAction: { color: colors.muted, fontSize: 12, padding: 8 },
  accountSeparator: { color: colors.line },
  deleteAction: { color: colors.danger },
});
