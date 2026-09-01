# MONJU

> Mac/iOS担当者へ: 最初に [Mac・iOS開発引き継ぎ手順](./docs/MAC_IOS_HANDOFF.md) と [現在の実装状況](./docs/IMPLEMENTATION_STATUS.md) を読んでください。

「集まった瞬間を、会話の始まりに。」を実現するAndroid先行のMVPです。グループのメンバーが一定範囲に一定時間集まったことをサーバーで判定し、全員へ通知します。最初に応答した1名が会話を録音し、停止後に自動で文字起こしします。地図表示と移動履歴の保存は行いません。iOS設定も将来対応用に維持しています。

現在はAndroid/Web側で共通機能を先行実装し、iOS 17向けのネイティブビルド・署名・実機検証をMac担当者へ引き継ぐ段階です。公開用資格情報や本番インフラはまだ設定していません。

## 実装済み

- Googleログインと30日セッション（Android Keystore／iOS Keychainを利用するSecureStoreへ保存）
- グループ作成・編集・削除・退出、最大5グループ／最大5メンバー
- 10分・1回限りの招待QRコード
- 位置共有ON/OFF、バックグラウンド取得、精度の3段階切り替え
- PostgreSQLにはユーザーごとの最新位置1件だけを保存
- 集合候補、集合、解散判定中、未集合の状態遷移
- 位置精度・5分の鮮度・必要人数・中心点からの半径による集合判定
- 60秒継続、5秒の瞬断猶予、10分で解散（初期値）
- Expo Push通知と「録音開始」アクション
- 通知アクション／グループ画面からの先着1名だけの録音claim
- 通知アクションから確認画面なしで録音開始
- M4A/AACの端末内録音、手動停止、最大1時間で自動停止
- 停止直後の自動文字起こし（Androidではオンライン認識、iOSでは端末内認識を優先）
- 音声・文字起こしの端末内保存、再生、再試行、削除
- 録音開始をグループ全員へ通知し、集合画面に録音状態を表示
- Cloudflare Workersのユーザー単位レート制限、入力検証、構造化ログ

AI要約、話者分離、音声・文字起こしのクラウド保存はMVP対象外です。端末内音声認識を利用できない場合は、録音詳細からオンライン音声認識を明示的に再試行できます。MONJU独自の文字起こしAPIや従量課金APIは使用しません。

## 構成

```text
apps/mobile       Expo SDK 57 / React Native / TypeScript
apps/api          Cloudflare Workers / Hyperdrive / PostgreSQL
packages/domain   集合判定・距離計算・状態遷移（純粋TypeScript）
```

## 必要環境

- Node.js 22.13以上
- PostgreSQL 15以上（外部からTLS接続できるもの）
- Cloudflareアカウント
- Google CloudのOAuth 2.0クライアント
- Expo/EASアカウント
- 実機確認用のAndroid端末（録音ファイルの文字起こしを含む確認はAndroid 13以上）
- ローカルビルドではAndroid Studio、Android SDK、JDK 17、ADB
- EAS Buildを使う場合はExpo/EASアカウント

## 1. 依存関係と検証

```powershell
npm install
npm run check
```

`npm run check`は全ワークスペースの型チェックと、Worker／Pushメッセージ／集合判定のテストを実行します。AndroidバンドルとExpo設定は次でも確認できます。

```powershell
cd apps/mobile
npx expo-doctor
npx expo export --platform android --output-dir dist-expo
```

## 2. PostgreSQLとWorker

データベースへ初期スキーマを適用します。

```powershell
psql $env:DATABASE_URL -f ".\apps\api\migrations\001_initial.sql"
```

Cloudflareへログインし、Hyperdriveを作成します。

```powershell
cd apps/api
npx wrangler login
npx wrangler hyperdrive create monju-db --connection-string="postgres://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require"
```

返されたIDを [wrangler.jsonc](./apps/api/wrangler.jsonc) の `HYPERDRIVE.id` に設定し、`GOOGLE_WEB_CLIENT_ID`も実値へ変更します。`namespace_id`の `1001` と `1002` は、このCloudflareアカウント内で他のRate Limiting bindingと重複しない正の整数へ変更してください。

ローカル起動では資格情報を設定ファイルへ書かず、環境変数を使用します。

```powershell
Copy-Item .dev.vars.example .dev.vars
$env:CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="postgres://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require"
npm run dev -- --ip 0.0.0.0
```

`.dev.vars` の `AUTH_SECRET` は十分に長いランダム値へ置き換えてください。本番では次でsecretを登録してデプロイします。

```powershell
npx wrangler secret put AUTH_SECRET
npm run deploy
```

## 3. Google OAuth

Google Cloud Consoleで次の2つを作成します。

1. Web applicationクライアント。Client IDをWorkerの `GOOGLE_WEB_CLIENT_ID` とモバイルの `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` の両方に設定します。
2. Androidクライアント。Package nameは初期値 `jp.monju.app`、または `EXPO_PUBLIC_ANDROID_PACKAGE` と一致させ、APK署名証明書のSHA-1を登録します。

Web Client IDをモバイル環境変数へ設定します。Android Client ID自体はアプリコードへ設定せず、Google Cloud側のPackage nameとSHA-1の組み合わせで使用されます。iOS用の環境変数は将来対応用です。

```powershell
cd ..\mobile
Copy-Item .env.example .env
```

[.env.example](./apps/mobile/.env.example) の全プレースホルダーを置き換えてください。`EXPO_PUBLIC_API_BASE_URL` は末尾スラッシュなしで指定します。実機からローカルWorkerへ接続する場合、`127.0.0.1`ではなく開発PCのLAN IPを使います。

Push通知を使う場合は、同じGoogle CloudプロジェクトをFirebaseへ追加し、Androidアプリの `google-services.json` をダウンロードします。ファイルのパスを `GOOGLE_SERVICES_JSON` に設定し、FCM V1のサービスアカウントキーをEASへ登録します。サービスアカウントキーはリポジトリへ保存しません。

## 4. Android Development Build / APK

Google Sign-In、バックグラウンド位置情報、Push通知、録音ファイルの文字起こしはExpo Goでは完結しません。ネイティブ依存を含むDevelopment BuildまたはAPKを実機へ入れます。依存を追加・更新した場合はDevelopment Buildも再作成してください。

Windowsでローカルビルドする場合:

```powershell
npm run android:prebuild
npm run android
npm run dev
```

リポジトリのパスに日本語が含まれるWindows環境でもExpoがネイティブファイルを探索できるよう、`android:prebuild`は処理中だけ空きドライブ文字へ同じフォルダを割り当て、完了時に解除します。ソースの移動や複製は行いません。

Google OAuthへ登録するデバッグ署名のSHA-1は、prebuild後に次で確認できます。

```powershell
cd android
.\gradlew signingReport
```

EAS Buildで直接インストール可能なAPKを作る場合:

```powershell
npx eas-cli@latest login
npm run android:apk
```

完成したAPKはダウンロードURLから端末へ入れるか、USB接続して `adb install path\to\monju.apk` で導入できます。Google Playへの提出は不要です。

EASで作成されたProject IDを `EXPO_PUBLIC_EAS_PROJECT_ID` に設定し、AndroidのFCM V1 credentialsもEASで構成してください。位置共有をONにするときは、Android設定で位置情報を「常に許可」にします。位置共有中とバックグラウンド録音中は、Androidの要件により消せない常駐通知が表示されます。

録音開始時に初めてマイク権限を求めます。録音済みファイルの文字起こしはAndroid 13以上で利用し、端末の音声認識サービスや日本語モデルに依存します。M4A入力と長時間文字起こしの実際の対応範囲は端末差があるため、最終確認はAndroid実機で行ってください。

## 主なAPI

| Method | Path | 用途 |
| --- | --- | --- |
| POST | `/auth/google` | Google ID tokenを検証してセッション発行 |
| GET/DELETE | `/me` | 自分の取得／アカウント削除 |
| GET/POST | `/groups` | 一覧／作成 |
| GET/PATCH/DELETE | `/groups/:id` | 詳細／設定／削除 |
| POST | `/groups/:id/invites` | 単回招待の発行 |
| POST | `/invites/:token/join` | 招待で参加 |
| PUT | `/me/location` | 最新位置を送信して集合を再評価 |
| PUT | `/me/device-token` | Expo Push tokenを登録 |
| GET | `/groups/:id/gathering` | 集合状態を取得 |
| POST | `/groups/:id/recording/claim` | 録音担当を原子的に先着1名へ確定 |

## プライバシー上の境界

- 位置共有がOFFなら取得と送信を停止します。
- サーバーでは古い位置を上書きせず、各ユーザーの最新位置1件だけを保持します。
- 5分を超えた位置と、集合半径より不確かな位置は集合判定から除外します。
- ログへID token、セッショントークン、座標を出しません。
- QR招待は平文をDB保存せず、SHA-256ハッシュだけを保存します。
- 録音音声と文字起こしはアプリのDocuments領域だけに保存し、Workerへ送信しません。
