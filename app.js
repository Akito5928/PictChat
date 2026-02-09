let ws = null;
const users = {};
let ownerID = null;
let myName = "";

// ------------------------------
// userNo 生成（pictsense と同じ）
// ------------------------------
function getUserNo() {
  let n = localStorage.getItem("userNo");
  if (!n) {
    n = Math.floor(100000 + Math.random() * 900000); // 6桁
    localStorage.setItem("userNo", n);
  }
  return n;
}

// ------------------------------
// rid 抽出（強化版）
// ------------------------------
function extractRid(url) {
  const m = url.match(/#!\/([0-9a-fA-F\-]{36})/);
  return m ? m[1] : null;
}

// ------------------------------
// 通信ログ
// ------------------------------
function logWS(text) {
  const div = document.getElementById("wslog");
  const time = new Date().toLocaleTimeString();
  div.innerHTML += `<div>[${time}] ${text}</div>`;
  div.scrollTop = div.scrollHeight;
}

// ------------------------------
// チャット表示
// ------------------------------
function addChat(name, text) {
  const div = document.getElementById("chat");
  div.innerHTML += `<div><b>${name}:</b> ${text}</div>`;
  div.scrollTop = div.scrollHeight;
}

// ------------------------------
// 参加者表示
// ------------------------------
function renderUsers() {
  const div = document.getElementById("users");
  div.innerHTML = "";
  for (const uid in users) {
    const name = users[uid];
    const crown = uid === ownerID ? "👑 " : "";
    div.innerHTML += `<div>${crown}${name}</div>`;
  }
}

// ------------------------------
// 接続
// ------------------------------
document.getElementById("connectBtn").onclick = async () => {
  const url = document.getElementById("roomUrl").value;
  myName = document.getElementById("myName").value || "名無し";

  const rid = extractRid(url);
  logWS("RID = " + rid);

  if (!rid) {
    logWS("❌ rid が抽出できませんでした。URL を確認してください。");
    return;
  }

  const userNo = getUserNo();
  logWS("userNo = " + userNo);

  // 🔥 正しい WebSocket URL（roomNo 不要）
  const wsUrl =
    `wss://wl.pictsense.com/socket.io/?userNo=${userNo}&rid=${rid}&EIO=4&transport=websocket`;

  logWS("→ Connect WS: " + wsUrl);

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    logWS("→ WebSocket connected");
  };

  ws.onmessage = (e) => {
    const data = e.data;
    logWS(`← ${data}`);

    // ------------------------------
    // 0{...} → handshake
    // ------------------------------
    if (data.startsWith("0")) return;

    // ------------------------------
    // 40 → transport ready（join 成功）
    // ------------------------------
    if (data === "40") {
      logWS("→ setName: " + myName);
      ws.send(`42["setName","${myName}"]`);
      return;
    }

    // ------------------------------
    // ping/pong
    // ------------------------------
    if (data === "2") {
      ws.send("3");
      logWS("→ pong");
      return;
    }

    // ------------------------------
    // 42[...] イベント
    // ------------------------------
    if (!data.startsWith("42")) return;

    const payload = JSON.parse(data.slice(2));
    const event = payload[0];

    if (event === "initRoom push") {
      const info = payload[1];
      ownerID = info.ownerID;

      info.userList.forEach(u => {
        users[u.uid] = u.userName;
      });

      renderUsers();
      return;
    }

    if (event === "newUser push") {
      const u = payload[1];
      users[u.uid] = u.userName;
      renderUsers();
      return;
    }

    if (event === "userLeave push") {
      delete users[payload[1]];
      renderUsers();
      return;
    }

    if (event === "changeOwner push") {
      ownerID = payload[1];
      renderUsers();
      return;
    }

    if (event === "chat push") {
      const uid = payload[1];
      const text = payload[2];
      const name = users[uid] || "(unknown)";
      addChat(name, text);
      return;
    }

    if (event === "visitorCount push") {
      // visitorCount はログだけでOK
      return;
    }
  };
};

// ------------------------------
// チャット送信
// ------------------------------
document.getElementById("sendBtn").onclick = () => {
  const text = document.getElementById("msg").value;
  if (!ws || ws.readyState !== 1) return;

  ws.send(`42["chat send","${text}",${Date.now()}]`);
  logWS(`→ chat send: ${text}`);
  document.getElementById("msg").value = "";
};
