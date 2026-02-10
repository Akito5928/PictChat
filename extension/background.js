let pictsenseTabId = null;
let pictchatTabId = null;

// pictchat / pictsense 間のハブ
chrome.runtime.onMessage.addListener((msg, sender) => {
  // ① pictchat から最初に飛んでくる：pictsense を開く
  if (msg.action === "openPictsense") {
    // pictchat のタブIDを記録
    if (sender.tab) {
      pictchatTabId = sender.tab.id;
    }

    chrome.tabs.create(
      {
        url: "https://pictsense.com",
        active: false
      },
      (tab) => {
        pictsenseTabId = tab.id;

        // pictsense の読み込み完了を待ってから注入
        chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
          if (tabId === tab.id && info.status === "complete") {
            chrome.tabs.onUpdated.removeListener(listener);

            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ["pictsense_ws.js"]
            });
          }
        });
      }
    );
  }

  // ② pictchat → pictsense_ws.js（connect / chatSend）
  if ((msg.action === "connect" || msg.action === "chatSend") && pictsenseTabId) {
    chrome.tabs.sendMessage(pictssenseTabId, msg);
  }

  // ③ pictsense_ws.js → pictchat（ログ / チャット / ユーザー一覧）
  if (msg.action === "uiLog" || msg.action === "uiChat" || msg.action === "uiUsers") {
    if (pictchatTabId) {
      chrome.tabs.sendMessage(pictchatTabId, msg);
    }
  }
});
