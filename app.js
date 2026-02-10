// 接続ボタン → 拡張に「connect」メッセージ送信
document.getElementById("connectBtn").onclick = () => {
  const myName = document.getElementById("myName").value || "名無し";
  const roomUrl = document.getElementById("roomUrl").value;

  window.postMessage({ type: "connect", myName, roomUrl }, "*");
};

// チャット送信 → 拡張に「chatSend」メッセージ送信
document.getElementById("sendBtn").onclick = () => {
  const text = document.getElementById("msg").value;
  window.postMessage({ type: "chatSend", text }, "*");
  document.getElementById("msg").value = "";
};

// 拡張からのメッセージを受け取ってUIに反映
window.addEventListener("message", (event) => {
  const data = event.data;

  if (data.type === "wsLog") {
    const div = document.getElementById("wslog");
    const time = new Date().toLocaleTimeString();
    div.innerHTML += `<div>[${time}] ${data.text}</div>`;
    div.scrollTop = div.scrollHeight;
  }

  if (data.type === "chatPush") {
    const div = document.getElementById("chat");
    div.innerHTML += `<div><b>${data.name}:</b> ${data.text}</div>`;
    div.scrollTop = div.scrollHeight;
  }

  if (data.type === "userList") {
    const div = document.getElementById("users");
    div.innerHTML = "";
    data.users.forEach(u => {
      div.innerHTML += `<div>${u}</div>`;
    });
  }
});
