let pictsenseTabId = null;
let pictchatTabId = null;

chrome.runtime.onMessage.addListener((msg, sender) => {
  // pictchat から最初に飛んでくる
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

  // pictchat → pictsense_ws.js
  if ((msg.action === "connect" || msg.action === "chatSend") && pictsenseTabId) {
    chrome.tabs.sendMessage(pictsenseTabId, msg);
  }

  // pictsense_ws.js → pictchat
  if (msg.action === "uiLog" || msg.action === "uiChat" || msg.action === "uiUsers") {
    if (pictchatTabId) {
      chrome.tabs.sendMessage(pictchatTabId, msg);
    }
  }
});
