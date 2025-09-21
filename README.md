# PhysicBattle

PhysicBattle 是一款純前端、單一頁面的 2D 物理對戰小遊戲。騎槍手與手裡劍在封閉的競技場內高速碰撞，所有效果都以 Canvas 繪製，無需任何框架或套件即可離線遊玩與部署。

## 遊戲亮點
- **完全靜態**：只有 `index.html`、`style.css` 與 `main.js` 三個檔案，雙擊即可啟動。
- **重新設計的介面**：資訊面板、操作提示、殘影與慢動作效果讓對戰更具戲劇張力。
- **能量與連擊系統**：碰撞將累積能量並觸發連擊計數，提供更多操作深度。
- **無框架依賴**：可直接部署到 GitHub Pages 或任意靜態主機。

## 操作方式
- 滑鼠點擊或拖曳畫布：對騎槍手施加瞬間衝力。
- 長按 **Shift**：聚焦手裡劍並降低其速度（消耗能量）。
- **R**：重置對戰。
- **P**：暫停 / 繼續。
- **S**：切換慢動作模式。
- **T**：切換殘影效果。

## 本地遊玩
1. 下載或解壓縮整個資料夾。
2. 直接以瀏覽器開啟 `index.html`。
   - 若瀏覽器有跨來源限制，可使用 VS Code 的 **Live Server** 擴充套件或任意靜態伺服器。

## 部署到 GitHub Pages
1. 將專案 push 至 GitHub 的任一 repository（建議 repo 名稱即為 `PhysicBattle`）。
2. 進入 **Settings → Pages**：
   - Source 選擇 `Deploy from a branch`
   - Branch 選擇 `main`，資料夾選擇 `/ (root)`
3. 儲存後稍待片刻，即可取得公開網址。

> 若使用 GitHub Actions，自行加入簡單的靜態部署 workflow 即可自動發布。

## 自訂
- 遊戲邏輯集中於 `main.js`；
- 介面樣式在 `style.css`；
- HTML 結構與輔助資訊在 `index.html`。

所有程式碼皆以 MIT License 釋出，歡迎分支、改作或整合至其他專案。
