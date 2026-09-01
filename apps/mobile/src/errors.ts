import { ApiError } from "./api";

const messages: Record<string, string> = {
  GROUP_LIMIT_REACHED: "参加できるグループは5つまでです。",
  GROUP_FULL: "このグループは5人に達しています。",
  INVITE_EXPIRED: "この招待は期限切れ、または使用済みです。",
  GROUP_NOT_FOUND: "グループが見つかりませんでした。",
  LEADER_REQUIRED: "この操作はリーダーだけが行えます。",
  RECORDER_ALREADY_CLAIMED: "別のメンバーがすでに録音担当になりました。",
  NOT_GATHERED: "現在は集合状態ではありません。",
  NETWORK_ERROR: "サーバーに接続できません。通信環境とAPI URLを確認してください。",
  TIMEOUT: "通信がタイムアウトしました。もう一度お試しください。",
  RATE_LIMITED: "短時間に操作が集中しました。少し待ってからお試しください。",
};

export function friendlyError(error: unknown): string {
  if (error instanceof ApiError) {
    return messages[error.code] ?? error.message;
  }
  if (error instanceof Error) return error.message;
  return "予期しないエラーが発生しました。";
}
