# MONJU Mac・iOS開発引き継ぎ手順

最終更新: 2026-09-01

## まず結論

Apple Developer Programへ有料登録しなくても、MacとXcode、無料のApple Accountがあれば、iOS Simulatorと自分のiPhoneで開発・個人テストを始められます。無料のPersonal Teamには次の制限があります。

- App IDは同時に10個までで、7日後に期限切れ
- プラットフォームごとのテスト端末は3台までで、7日後に期限切れ
- Provisioning Profileは7日で期限切れになり、再ビルド・再インストールが必要
- App Store、TestFlight、Ad Hoc配布、チーム向け配布は利用不可
- APNs Push通知など、有料Programの資格情報が必要な機能は無料範囲だけでは完了しない

したがって、無料で行う範囲は「iOS Simulatorでの画面・ロジック確認」「Personal Teamで自分のiPhoneへ入れて、ログイン・位置・QR・録音・文字起こしのPoC」です。MONJUの必須要件であるPush通知、3台への安定配布、最終E2E検証へ進む段階でApple Developer Programを用意します。

Apple公式: [Membershipの比較](https://developer.apple.com/support/compare-memberships/)、[iOSの対応Capability](https://developer.apple.com/help/account/reference/supported-capabilities-ios/)

## 1. Macへ開発環境を用意する

1. Mac App Storeから最新の正式版Xcodeをインストールする。
2. Xcodeを一度起動し、ライセンスと追加コンポーネントのインストールを完了する。
3. Xcode > Settings > Locations > Command Line Toolsで、インストール済みXcodeを選ぶ。
4. Xcode > Settings > ComponentsからiOS 17以上のSimulator runtimeを入れる。
5. Node.js 22.13以上とGitを用意する。Homebrewを使う例:

```bash
brew install node@22 git
node --version
git --version
```

6. `pod`が見つからない場合だけCocoaPodsを入れる。

```bash
brew install cocoapods
pod --version
```

Expo SDK 57ではWatchmanは必須ではありません。公式手順: [iOS Simulator](https://docs.expo.dev/workflow/ios-simulator/)

## 2. GitHubから取得して検証する

```bash
git clone <このGitHubリポジトリのURL>
cd MONJU
npm ci
npm run check
cd apps/mobile
npx expo-doctor
```

期待値:

- TypeScript型チェックがすべて成功
- APIテスト6件が成功
- Domainテスト8件が成功
- Expo Doctorが21/21成功

失敗した場合は、Node.jsのバージョン、`npm ci`のエラー全文、`npx expo-doctor`の結果をIssueへ貼ってください。

## 3. 秘密情報をローカルだけに設定する

```bash
cd apps/mobile
cp .env.example .env
```

`.env`はGitへ追加しません。最低限、次を実値へ変更します。

```dotenv
EXPO_PUBLIC_API_BASE_URL=https://<デプロイ済みWorkerのURL>
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<Google Web OAuth Client ID>
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<Google iOS OAuth Client ID>
EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME=com.googleusercontent.apps.<iOS Client IDの逆順scheme>
EXPO_PUBLIC_IOS_BUNDLE_ID=jp.monju.app.<担当者を識別する短い文字列>
```

無料Personal Teamでは、他人と衝突しないBundle IDを使ってください。Bundle IDを変えた場合は、Google Cloud Consoleでも同じBundle IDのiOS OAuth Clientを作り直します。GoogleのClient secretやAppleの秘密鍵をリポジトリへ置かないでください。

APIが未デプロイなら、画面だけは次でWeb確認できます。

```bash
cd ../..
npm run web
```

ブラウザで `http://localhost:8081` を開きます。Web確認版の端末機能とAPIはモックです。

## 4. iOS Simulatorで起動する（完全無料・署名不要）

MONJUはネイティブ依存を使うため、Expo GoではなくDevelopment Buildで確認します。

```bash
cd apps/mobile
npm run ios
```

初回はExpoが`ios/`を生成し、PodsをインストールしてSimulatorへアプリを入れます。別ターミナルでMetroを再起動する場合:

```bash
cd apps/mobile
npm run dev
```

Googleログイン、Push通知、実際のバックグラウンド位置挙動はSimulatorだけで完了判定しないでください。画面遷移、APIエラー表示、グループ操作、録音一覧の確認を優先します。

## 5. 無料Personal Teamで自分のiPhoneへ入れる

1. iPhoneをUSBでMacへ接続し、iPhone側で「このコンピュータを信頼」を許可する。
2. Xcode > Settings > Accountsへ無料のApple Accountを追加する。
3. iPhoneがiOS 16以上なら、設定 > プライバシーとセキュリティ > デベロッパモードをONにして再起動する。
4. 次を実行し、一覧から接続したiPhoneを選ぶ。

```bash
cd apps/mobile
npm run ios:device
```

5. Signingで止まった場合:

```bash
open ios/*.xcworkspace
```

XcodeでMONJU target > Signing & Capabilitiesを開き、Automatically manage signingをON、Teamを自分のPersonal Teamへ変更します。Bundle Identifierが自分専用であることを確認し、Xcode上のRunを押します。

6. インストール後は次でMetroを起動し、iPhoneとMacを同じLANへ接続する。

```bash
npm run dev
```

公式手順: [Expo Development Build](https://docs.expo.dev/develop/development-builds/introduction/)、[iOS Developer Mode](https://docs.expo.dev/guides/ios-developer-mode/)

## 6. Mac担当者が最初に実装・検証する順番

### A. iOSビルド成立

- `npm run ios`でSimulator起動
- `npm run ios:device`でPersonal Team実機起動
- 権限説明文が日本語で表示されることを確認
- iOS 17でクラッシュしないことを確認

### B. Googleログイン

- Google CloudにiOS OAuth Clientを作る
- Bundle IDとURL Schemeを`.env`へ設定
- 設定変更後に`npx expo prebuild --platform ios --clean`で再生成
- 実機でログイン、再起動後のセッション復元、ログアウトを確認

### C. Core Location PoC

- 位置共有ONのタイミングで権限を要求することを確認
- 「使用中」から「常に」への権限導線を確認
- 画面消灯・バックグラウンド・アプリ再起動後の取得を記録
- LOW/MEDIUM/HIGHの精度変更と電池消費を測る
- サーバーに履歴ではなく最新位置1件だけが残ることを確認

### D. 録音と文字起こし

- 初回録音時だけマイク権限を要求
- M4A/AAC、手動停止、最大1時間、端末内保存を確認
- 停止後にiOS端末内認識を優先して文字起こし
- 1分、10分、60分の日本語音声で精度、処理時間、発熱を記録
- 音声と文字起こしの再生・再試行・削除を確認

### E. Push通知（有料Programを用意した後）

- Expo/EAS Project IDとApple Push credentialsを設定
- 集合成立時に対象者全員へ通知
- 通知の「録音開始」から確認なしで録音画面へ遷移
- 同時タップ時に1台だけrecording claimが成功
- 30分再通知と録音開始後の停止を確認

### F. 3台E2E・バッテリー

- [現在の実装状況](./IMPLEMENTATION_STATUS.md)の未確認項目を埋める
- 3台で通常集合、GPSブレ、精度不足、5分超、解散、再集合、再通知、同時録音開始を実施
- テスト日時、端末、iOS、結果、ログ、スクリーンショットをGitHub Issueへ残す

## 7. 日々の開発ループ

JavaScript/TypeScriptだけの変更:

```bash
npm run dev
```

ネイティブ依存、Expo plugin、Bundle ID、権限設定を変えた場合:

```bash
npx expo prebuild --platform ios --clean
npm run ios:device
```

作業ブランチとPull Request:

```bash
git switch -c ios/<短い作業名>
npm run check
git add <変更ファイル>
git commit -m "feat(ios): 変更内容"
git push -u origin HEAD
```

Pull Requestには、確認した端末/iOS、実行したコマンド、権限状態、成功・失敗、画面またはログを記載してください。

## 8. 有料化する判断点

次のどれかへ進む時点でApple Developer Programを用意します。

- APNs Push通知を実機で完了検証する
- 開発チーム3人へ安定して配布する
- TestFlightを使う
- 7日ごとの再署名をやめる
- App Storeへ提出する

EASによるiOS実機Development BuildはAppleの署名資格情報を必要とします。無料段階ではまずMac上のXcode + Personal Teamを使ってください。
