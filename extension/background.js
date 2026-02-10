let pictsenseTabId = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "openPictsense") {
    chrome.tabs.create({
      url: "https://pictsense.com",
      active: false
    }, tab => {
      pictsenseTabId = tab.id;
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["pictsense_ws.js"]
      });
    });
  }

  // forward connect/chatSend to pictsense_ws.js
  if ((msg.action === "connect" || msg.action === "chatSend") && pictsenseTabId) {
    chrome.tabs.sendMessage(pictsenseTabId, msg);
  }

  // forward logs/chats/users back to content.js
  if (msg.action === "uiLog" || msg.action === "uiChat" || msg.action === "uiUsers") {
    if (sender.tab) {
      chrome.tabs.sendMessage(sender.tab.id, msg);
    }
  }
});
