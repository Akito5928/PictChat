let pictsenseTabId = null;

// pictsense.com を裏で開いて、読み込み完了後に pictsense_ws.js を注入
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.action === "openPictsense") {
    chrome.tabs.create(
      {
        url: "https://pictsense.com",
        active: false
      },
      (tab) => {
        pictsenseTabId = tab.id;

        // ページ読み込み完了を待つ
        chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
          if (tabId === tab.id && info.status === "complete") {
            chrome.tabs.onUpdated.removeListener(listener);

            // pictsense_ws.js を注入
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ["pictsense_ws.js"]
            });
          }
        });
      }
    );
  }

  // pictchat → pictsense_ws.js への橋渡し
  if ((msg.action === "connect" || msg.action === "chatSend") && pictsenseTabId) {
    chrome.tabs.sendMessage(pictsenseTabId, msg);
  }

  // pictsense_ws.js → pictchat への橋渡し
  if (msg.action === "uiLog" || msg.action === "uiChat" || msg.action === "uiUsers") {
    if (sender.tab) {
      chrome.tabs.sendMessage(sender.tab.id, msg);
    }
  }
});
