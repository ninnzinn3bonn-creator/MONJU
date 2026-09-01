export interface GatheringPushJob {
  groupId: string;
  gatheredMemberCount: number;
  deviceTokens: string[];
}

export interface RecordingStartedPushJob {
  groupId: string;
  deviceTokens: string[];
}

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound: "default";
  categoryId?: "gathering";
  data: {
    action: "START_RECORDING" | "OPEN_GROUP";
    groupId: string;
  };
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

export async function sendGatheringPush(
  env: Env,
  job: GatheringPushJob,
): Promise<void> {
  await sendPushMessages(env, job.groupId, createGatheringPushMessages(job));
}

export function createGatheringPushMessages(
  job: GatheringPushJob,
): ExpoPushMessage[] {
  return job.deviceTokens.map((to) => ({
    to,
    title: "MONJU",
    body: `${job.gatheredMemberCount}人集まりました。録音しますか？`,
    sound: "default",
    categoryId: "gathering",
    data: { action: "START_RECORDING", groupId: job.groupId },
  }));
}

export function createRecordingStartedPushMessages(
  job: RecordingStartedPushJob,
): ExpoPushMessage[] {
  return job.deviceTokens.map((to) => ({
    to,
    title: "MONJU",
    body: "グループのメンバーが録音を開始しました。",
    sound: "default",
    data: { action: "OPEN_GROUP", groupId: job.groupId },
  }));
}

export async function sendRecordingStartedPush(
  env: Env,
  job: RecordingStartedPushJob,
): Promise<void> {
  await sendPushMessages(
    env,
    job.groupId,
    createRecordingStartedPushMessages(job),
  );
}

async function sendPushMessages(
  env: Env,
  groupId: string,
  messages: ExpoPushMessage[],
): Promise<void> {
  for (const batch of chunk(messages, 100)) {
    const response = await fetch(env.EXPO_PUSH_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(batch),
    });

    if (!response.ok) {
      console.error(
        JSON.stringify({
          message: "expo push request failed",
          groupId,
          status: response.status,
        }),
      );
    }
  }
}
