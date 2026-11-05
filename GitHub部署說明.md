# 將信函產生器部署到 GitHub Pages

以下步驟使用GitHub網頁操作，免安裝Git或Python。GitHub Free可用公開儲存庫啟用Pages。

## 1 先解壓縮網站套件

將 `letter-generator-GitHub-Pages.zip` 解壓縮。解壓後應直接看到 `index.html`，以及 `assets`、`vendor` 等資料夾。

請上傳解壓後的網站檔案，不要只上傳ZIP。只用這個網站套件，不要上傳整個案件資料夾或個人收據、銀行截圖、原合約照片。

## 2 建立公開儲存庫

1. 登入 https://github.com ，點右上角「＋」→ **New repository**。
2. **Repository name** 填 `你的GitHub帳號.github.io`。例如帳號是 `sunlight-home`，填 `sunlight-home.github.io`。這是個人首頁的命名規則。
3. 選擇 **Public**，將 **Add README** 開啟，再按 **Create repository**。

若你已有同名個人首頁且想保留，也可另建 `muguang-letter` 之類的一般專案儲存庫；啟用方式相同，網址會變成 `https://你的帳號.github.io/muguang-letter/`。

## 3 上傳網站檔案

1. 進入剛建立的儲存庫，點 **Add file → Upload files**。
2. 從解壓後的資料夾，將裡面的檔案和子資料夾拖入上傳區。要拖入「內容」，不要把最外層資料夾再包一層上傳。
3. 等待上傳完成，填寫說明（例如 `Add letter generator`），儲存至 `main`。依畫面按 **Commit changes**；若介面使用 **Propose changes**，依引導將變更合併到 `main`。
4. 回到 **Code**，確認儲存庫根目錄可以直接看到：

```text
index.html
styles.css
app.js
generator.js
pdf-generator.js
.nojekyll
assets/
vendor/
README.md
GitHub部署說明.md
tests/
```

其中 `assets` 內須包含兩份Word範本、content.json、postal-blank.pdf、pdf-layout.json及繁中字型 `NotoSerifTC-Regular.ttf`；`vendor` 內須包含三個JavaScript套件及授權文件。上傳時保留資料夾層級即可。

如果根目錄只看到一個ZIP，或只看到一個外層資料夾，Pages無法直接找到首頁，請改成上述結構。若漏掉 `.nojekyll`，可用 **Add file → Create new file** 補建同名檔案。

## 4 啟用 Pages

1. 點儲存庫的 **Settings**。
2. 左側點 **Pages**。
3. 在 **Build and deployment**：
   - **Source** 選 **Deploy from a branch**。
   - **Branch** 選 **main**。
   - 資料夾選 **/(root)**。
4. 按 **Save**。
5. 等待發布完成。Pages畫面會顯示網址及 **Visit site**；官方說明提及發布可能需要最多約10分鐘。

個人首頁網址是 `https://你的GitHub帳號.github.io/`。

## 5 上線後檢查

開啟網站，先使用「填入示例資料」，確認戶別為「第5樓第A戶」，並產生兩份Word與兩份PDF。下載ZIP後應有四份檔案。也可用手機開啟同一網址測試。

如果是404，先確認Pages發布成功、選了main及/(root)、根目錄有index.html。如果頁面正常但無法產生文件，請確認assets與vendor完整上傳；首次需要載入約10MB繁中字型。

日後更新時，在相同儲存庫重新上傳更新後的檔案並儲存到main即可；Pages會再次發布。看到舊內容可在桌機按Ctrl+F5重新載入。

## 官方參考

- [GitHub Pages快速入門](https://docs.github.com/en/pages/quickstart)
- [透過GitHub網站上傳檔案](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)
