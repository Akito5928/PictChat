let ws = null;
const users = {};
let ownerID = null;
let myName = "";

// rid抽出
function extractRid(url) {
  return url.split("#!/")[1];
}

// チャット表示
function addChat(name, text) {
  const div = document.getElementById("chat");
  div.innerHTML += `<div><b>${name}:</b> ${text}</div>`;
  div.scrollTop = div.scrollHeight;
}

// 参加者表示
function renderUsers() {
  const div = document.getElementById("users");
  div.innerHTML = "";
  for (const uid in users) {
    const name = users[uid];
    const crown = uid === ownerID ? "👑 " : "";
    div.innerHTML += `<div>${crown}${name}</div>`;
  }
}

// 接続ボタン
document.getElementById("connectBtn").onclick = () => {
  const url = document.getElementById("roomUrl").value;
  myName = document.getElementById("myName").value || "名無し";
  const rid = extractRid(url);

  ws = new WebSocket(
    `wss://wl.pictsense.com/socket.io/?rid=${rid}&EIO=4&transport=websocket`
  );

  ws.onopen = () => {
    console.log("WebSocket connected");
  };

  ws.onmessage = (e) => {
    const data = e.data;

    // 0{...} → Socket.IO handshake
    if (data.startsWith("0")) {
      console.log("Handshake:", data);
      return;
    }

    // 40 → WebSocket transport ready
    if (data === "40") {
      console.log("Transport ready");

      // ★ 名前送信（必須）
      ws.send(`42["setName","${myName}"]`);
      return;
    }

    // ping/pong
    if (data === "2") {
      ws.send("3");
      return;
    }

    // 42[...] イベント
    if (!data.startsWith("42")) return;

    const payload = JSON.parse(data.slice(2));
    const event = payload[0];

    // 初期データ
    if (event === "initRoom push") {
      const info = payload[1];
      ownerID = info.ownerID;

      info.userList.forEach(u => {
        users[u.uid] = u.userName;
      });

      renderUsers();
      return;
    }

    // 新規入室
    if (event === "newUser push") {
      const u = payload[1];
      users[u.uid] = u.userName;
      renderUsers();
      return;
    }

    // 退出
    if (event === "userLeave push") {
      delete users[payload[1]];
      renderUsers();
      return;
    }

    // オーナー変更
    if (event === "changeOwner push") {
      ownerID = payload[1];
      renderUsers();
      return;
    }

    // チャット
    if (event === "chat push") {
      const uid = payload[1];
      const text = payload[2];
      const name = users[uid] || "(unknown)";
      addChat(name, text);
      return;
    }
  };
};

// チャット送信
document.getElementById("sendBtn").onclick = () => {
  const text = document.getElementById("msg").value;
  if (!ws || ws.readyState !== 1) return;

  ws.send(`42["chat send","${text}",${Date.now()}]`);
  document.getElementById("msg").value = "";
};
