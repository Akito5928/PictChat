// pictchat が開かれたら pictsense を裏で開く
chrome.runtime.sendMessage({ action: "openPictsense" });

// UI → background
window.addEventListener("message", (event) => {
  // 他拡張やページ内部のメッセージを無視
  if (!event.data || typeof event.data !== "object") return;
  if (!event.data.type) return;

  const data = event.data;

  if (data.type === "connect") {
    chrome.runtime.sendMessage({
      action: "connect",
      myName: data.myName,
      roomUrl: data.roomUrl
    });
  }

  if (data.type === "chatSend") {
    chrome.runtime.sendMessage({
      action: "chatSend",
      text: data.text
    });
  }
});

// background → UI
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "uiLog") {
    window.postMessage({ type: "wsLog", text: msg.text }, "*");
  }

  if (msg.action === "uiChat") {
    window.postMessage({ type: "chatPush", name: msg.name, text: msg.text }, "*");
  }

  if (msg.action === "uiUsers") {
    window.postMessage({ type: "userList", users: msg.users }, "*");
  }
});
