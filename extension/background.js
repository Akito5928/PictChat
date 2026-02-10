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

  // connect / chatSend を pictsense_ws.js に forward
  if (msg.action === "connect" || msg.action === "chatSend") {
    if (pictsenseTabId) {
      chrome.tabs.sendMessage(pictsenseTabId, msg);
    }
  }
});
