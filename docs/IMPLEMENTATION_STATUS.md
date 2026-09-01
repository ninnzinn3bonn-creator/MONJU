# MONJU 実装状況

基準日: 2026-09-01

## 現在地

React Native/Expoのモバイルアプリ、Cloudflare Workers API、PostgreSQLスキーマ、集合判定Domainを1つのnpm workspaceへ実装済みです。Android向け設定とWeb確認版をWindowsで検証済みですが、iOSネイティブビルドと実機動作はMac未使用のため未検証です。バックエンドとOAuth/Pushの本番資格情報も未設定です。

元の要件はiOS 17 MVPでしたが、途中でAndroid先行へ方針変更し、現在はAndroid/iOS/Webの3 platform設定を保持しています。今回、iOS側の継続開発をMac担当者へ戻します。

## 実装・検証マトリクス

| 領域 | コード | 自動検証 | 実機/本番 | 次の作業 |
| --- | --- | --- | --- | --- |
| UI・画面遷移 | 実装済み | TypeScript成功、Web操作確認済み | Android/iOS未確認 | iOS Simulatorと実機で全画面確認 |
| Googleログイン | Android/iOS共通実装済み | 型チェック済み | OAuth未設定 | iOS Client ID、Bundle ID、URL Schemeを設定して実機確認 |
| セッション保存 | SecureStore実装済み | 型チェック済み | 未確認 | 再起動、期限切れ、ログアウトを実機確認 |
| グループCRUD | Client/API/DB実装済み | API関連テスト成功 | DB未接続 | 実DB + Workerで権限/上限を確認 |
| QR招待 | 発行・単回join・Client読取実装済み | 型チェック済み | カメラ未確認 | iPhoneカメラで有効期限・再利用不可を確認 |
| 最新位置API | 実装済み | Domainテスト成功 | DB/実機未確認 | Core Location PoCと最新1件upsertを確認 |
| 集合判定 | 距離・精度・鮮度・State Machine実装済み | Domainテスト8件成功 | 3台E2E未実施 | GPSブレ、古い位置、解散、再集合を実測 |
| Push通知 | Expo Push送信・カテゴリ・録音開始action実装済み | Push payloadテスト成功 | Credentials未設定 | Apple Program準備後にAPNs実機確認 |
| Recording claim | APIのatomic claim実装済み | 競合テスト成功 | 2台同時操作未確認 | 2〜3台で同時タップ検証 |
| 録音 | M4A/AAC・手動/1時間停止・ローカル保存実装済み | 型チェック済み | iOS未確認 | 通話/サイレント/画面消灯を含め実機確認 |
| 文字起こし | iOS端末内優先、Androidオンライン実装済み | 型チェック済み | iOS未確認 | 長時間ファイル対応、精度、失敗時再試行を実測 |
| Web確認版 | API/端末機能モック実装済み | Web export成功 | localhost操作確認済み | 本番機能判定には使用しない |
| Cloudflare Worker | Routes/Auth/Rate Limit/Push実装済み | APIテスト6件成功 | 未デプロイ | Hyperdrive/Secrets/Rate Limit ID設定後deploy |
| PostgreSQL | 初期migration作成済み | SQLは未適用 | 未構築 | PostgreSQL作成、migration適用、バックアップ方針決定 |
| CI | GitHub Actions定義あり | ローカルで同等check成功 | GitHub push後に初回確認 | Actionsがgreenになることを確認 |

## 直近のローカル検証結果

Windows環境で次を確認しています。

- `npm run check`: 成功
- API: 3 test files / 6 tests成功
- Domain: 1 test file / 8 tests成功
- `npx expo-doctor`: 21/21成功
- `npx expo export --platform android`: 成功
- `npx expo export --platform web`: 成功
- Android native prebuild: 成功
- Webのホーム → グループ → 録音 → 文字起こし → 録音詳細: 操作確認済み

未確認:

- Android Gradle実ビルドとAndroid実機
- iOS prebuild/Xcode build/Simulator/iPhone
- Google OAuthの実アカウント
- Cloudflare/PostgreSQLの実環境
- Expo Push/APNs/FCM
- 3台E2Eとバッテリー測定

## 設定が必要なプレースホルダー

- `apps/mobile/.env`（exampleから作成、Git対象外）
- `EXPO_PUBLIC_API_BASE_URL`
- Google Web/iOS Client IDとiOS URL Scheme
- iOS Bundle ID
- Expo/EAS Project ID
- `apps/api/.dev.vars`の`AUTH_SECRET`
- `apps/api/wrangler.jsonc`のHyperdrive ID、Google Web Client ID、Rate Limit namespace IDs
- Push credentials（Apple/FCM）

## 仕様との差分・判断が必要な点

- 元要件はiOSのみでしたが、現在はAndroid先行の共通実装です。iOS固有問題は未解決の可能性があります。
- 元要件はグループ人数上限なしでしたが、現UI/APIはMVP安全策として最大5人を前提にしています。正式仕様を決めてください。
- Googleログインのみで開発しています。App Store一般公開前にはAppleの最新審査要件を確認し、Sign in with Apple追加要否を判断してください。
- Androidの録音ファイル文字起こしはAndroid 13以上前提です。iOSは端末内認識を優先していますが長時間音声の実測が必要です。
- 無料Personal Teamは個人PoC向けです。Pushと3人配布を完了条件にする段階ではApple Developer Programが必要です。

## iOS担当者の完了条件

- iOS 17以上のSimulatorと実機でビルド成功
- Googleログインとセッション復元成功
- 位置共有ON/OFFとバックグラウンド位置更新の証跡取得
- QR招待とグループ操作成功
- 録音、停止、端末内保存、文字起こし、再生、削除成功
- 有料Program準備後にPush actionから録音開始成功
- 3台E2E 8シナリオとバッテリー測定結果をIssueへ記録
- `npm run check`とGitHub Actionsが成功
