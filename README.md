# Lance vs Shuriken (Static Web Game)

一個**完全靜態**的物理小遊戲（Canvas），可以：

- 直接打開 `index.html` 本地玩（不需要安裝任何套件）。
- 直接上傳到 GitHub 後開啟 **GitHub Pages**（已附 `deploy-pages.yml` 工作流程，也可用 Settings→Pages 指定 `main` 分支）。

## 操作
- 點擊畫面：給長矛一個推力（朝點擊方向）。
- **R**：重置。
- **P**：暫停/繼續。

## 本地測試
1. 下載或解壓縮整個資料夾。
2. 直接雙擊打開 `index.html`。
   - 若瀏覽器有安全性限制，建議以 VS Code 的 **Live Server** 或任意靜態伺服器開啟。

## 上傳到 GitHub Pages（兩種方式）

### A) 用 Settings 直接開啟
1. 新建一個 repo（例如 `lance-vs-shuriken`）。
2. 把檔案全部放到 repo 根目錄並 push。
3. 進 **Settings → Pages**：
   - **Source** 選 `Deploy from a branch`
   - Branch 選 `main`、資料夾選 `/ (root)`，按 **Save**。
4. 等待幾十秒，右上角會出現公開網址。

### B) 用 GitHub Actions（本專案已附）
1. push 後，進 **Actions** 啟用 workflows。
2. 首次會跑 `Deploy static content to Pages`，完成後 Pages 自動更新。

> 若你的帳號是 organization，記得要允許 Pages/Actions 權限。

## 自訂
- 遊戲邏輯寫在 `main.js`，樣式在 `style.css`。
- 全部是純前端靜態檔，方便加素材、改參數，或嵌入你現有作品。

## 授權
MIT License（見 `LICENSE`）。
