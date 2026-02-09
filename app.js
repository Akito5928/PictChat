let ws = null;
const users = {};
let ownerID = null;
let myName = "";
let myUid = null;
let entryApproved = false;

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
// rid 抽出
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

  const wsUrl =
    `wss://wl.pictsense.com/socket.io/?userNo=${userNo}&rid=${rid}&EIO=4&transport=websocket`;

  logWS("→ Connect WS: " + wsUrl);

  ws = new WebSocket(wsUrl);
  entryApproved = false;
  myUid = null;

  ws.onopen = () => {
    logWS("→ WebSocket connected");

    // 入室申請制の部屋に対応（自由入室でも無害）
    ws.send(`42["entryRoomRequest send","${myName}"]`);
    logWS(`→ entryRoomRequest send: ${myName}`);
  };

  ws.onmessage = (e) => {
    const data = e.data;
    logWS(`← ${data}`);

    // 0{...} → handshake
    if (data.startsWith("0")) return;

    // 430[...] → 入室申請の承認結果
    if (data.startsWith("430")) {
      const payload = JSON.parse(data.slice(3));
      const approved = payload[0];
      const uid = payload[1];

      if (approved) {
        entryApproved = true;
        logWS("✔ 入室申請が承認されました (uid=" + uid + ")");

        // 名前設定を送る
        ws.send(`42["setName","${myName}"]`);
        logWS(`→ setName: ${myName}`);
      } else {
        logWS("❌ 入室が拒否されました");
      }
      return;
    }

    // 40 → transport ready（自由入室の部屋）
    if (data === "40") {
      if (!entryApproved) {
        ws.send(`42["setName","${myName}"]`);
        logWS(`→ setName: ${myName}`);
      }
      return;
    }

    // ping/pong
    if (data === "2") {
      ws.send("3");
      logWS("→ pong");
      return;
    }

    // 42[...] イベント
    if (!data.startsWith("42")) return;

    const payload = JSON.parse(data.slice(2));
    const event = payload[0];

    // ------------------------------
    // initRoom push
    // ------------------------------
    if (event === "initRoom push") {
      const info = payload[1];
      ownerID = info.ownerID;

      info.userList.forEach(u => {
        users[u.uid] = u.userName;

        // 自分の uid を特定
        if (u.userName === myName && myUid === null) {
          myUid = u.uid;
          logWS("✔ myUid (initRoom) = " + myUid);
        }
      });

      renderUsers();
      logWS("✔ initRoom push 受信 → 入室完了");
      return;
    }

    // ------------------------------
    // newUser push
    // ------------------------------
    if (event === "newUser push") {
      const u = payload[1];
      users[u.uid] = u.userName;

      // 自分が newUser として追加された場合
      if (u.userName === myName && myUid === null) {
        myUid = u.uid;
        logWS("✔ myUid (newUser) = " + myUid);
      }

      renderUsers();
      return;
    }

    // ------------------------------
    // userLeave push
    // ------------------------------
    if (event === "userLeave push") {
      const uid = payload[1];
      delete users[uid];
      renderUsers();
      return;
    }

    // ------------------------------
    // changeOwner push
    // ------------------------------
    if (event === "changeOwner push") {
      ownerID = payload[1];
      renderUsers();
      return;
    }

    // ------------------------------
    // kick push
    // ------------------------------
    if (event === "kick push") {
      const ownerUid = payload[1];
      const kickedUid = payload[2];

      if (kickedUid === myUid) {
        logWS("❌ あなたは部屋からキックされました (by " + ownerUid + ")");
        ws.close();
      } else {
        delete users[kickedUid];
        renderUsers();
        logWS("⚠ ユーザーがキックされました: " + kickedUid);
      }
      return;
    }

    // ------------------------------
    // chat push
    // ------------------------------
    if (event === "chat push") {
      const uid = payload[1];
      const text = payload[2];
      const name = users[uid] || "(unknown)";
      addChat(name, text);
      return;
    }

    // visitorCount push などはログだけで十分ならスルー
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
