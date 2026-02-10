// pictchat が開かれたら pictsense を裏で開く
chrome.runtime.sendMessage({ action: "openPictsense" });

// UI → background 経由で pictsense_ws.js に橋渡し
window.addEventListener("message", (event) => {
  if (event.data.type === "connect") {
    chrome.runtime.sendMessage({ action: "connect", myName: event.data.myName, roomUrl: event.data.roomUrl });
  }
  if (event.data.type === "chatSend") {
    chrome.runtime.sendMessage({ action: "chatSend", text: event.data.text });
  }
});
