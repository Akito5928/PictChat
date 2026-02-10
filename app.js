let ws = null;
const users = {};
let ownerID = null;
let myName = "";
let myUid = null;
let entryApproved = false;

const WR_SERVERS = ["wr1", "wr2", "wr3"];

// ------------------------------
// userNo 生成（6桁）
// ------------------------------
function getUserNo() {
  let n = localStorage.getItem("userNo");
  if (!n) {
    n = Math.floor(100000 + Math.random() * 900000);
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
// wr1 / wr2 / wr3 を総当たりして部屋サーバーを探す
// ------------------------------
async function detectCorrectWR(rid, userNo, myUid) {
  logWS("🔍 wr1 / wr2 / wr3 を総当たりして部屋サーバーを探索中…");

  for (const wr of WR_SERVERS) {
    const testUrl =
      `wss://${wr}.pictsense.com/socket.io/?userNo=${userNo}&rid=${rid}&myUid=${myUid}&EIO=4&transport=websocket`;

    logWS(`→ テスト接続: ${testUrl}`);

    const testWS = new WebSocket(testUrl);

    const result = await new Promise(resolve => {
      let resolved = false;

      testWS.onmessage = (e) => {
        if (resolved) return;

        if (e.data.startsWith("0")) {
          const json = JSON.parse(e.data.slice(1));

          if (json.upgrades && json.upgrades.includes("websocket")) {
            resolved = true;
            resolve({ ok: true, wr });
            testWS.close();
          } else {
            resolved = true;
            resolve({ ok: false, wr });
            testWS.close();
          }
        }
      };

      testWS.onerror = () => {
        if (!resolved) resolve({ ok: false, wr });
      };

      setTimeout(() => {
        if (!resolved) resolve({ ok: false, wr });
      }, 1500);
    });

    if (result.ok) {
      logWS(`🎯 ヒット！ → ${result.wr} が部屋サーバーです`);
      return result.wr;
    } else {
      logWS(`× ${result.wr} は違いました`);
    }
  }

  logWS("❌ wr1 / wr2 / wr3 のどれにも部屋が存在しませんでした");
  return null;
}

// ------------------------------
// 本接続（あなたの既存ロジック）
// ------------------------------
function connectToWR(wr, rid, userNo, myUid) {
  const wsUrl =
    `wss://${wr}.pictsense.com/socket.io/?userNo=${userNo}&rid=${rid}&myUid=${myUid}&EIO=4&transport=websocket`;

  logWS("→ 本接続: " + wsUrl);

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    logWS("→ WebSocket connected");
  };

  ws.onmessage = (e) => {
    const data = e.data;
    logWS(`← ${data}`);

    // 0{...} → handshake
    if (data.startsWith("0")) return;

    // 40 → transport ready
    if (data === "40") {
      logWS("✔ 40 received (transport ready)");

      ws.send(`42["entryRoomRequest send","${myName}"]`);
      logWS(`→ entryRoomRequest send: ${myName}`);

      ws.send(`42["setName","${myName}"]`);
      logWS(`→ setName (fallback): ${myName}`);
      return;
    }

    // 430[...] → 入室申請の承認結果
    if (data.startsWith("430")) {
      const payload = JSON.parse(data.slice(3));
      const approved = payload[0];
      const uid = payload[1];

      if (approved) {
        entryApproved = true;
        logWS("✔ 入室申請が承認されました (uid=" + uid + ")");

        ws.send(`42["setName","${myName}"]`);
        logWS(`→ setName: ${myName}`);
      } else {
        logWS("❌ 入室が拒否されました");
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

    // initRoom push
    if (event === "initRoom push") {
      const info = payload[1];
      ownerID = info.ownerID;

      info.userList.forEach(u => {
        users[u.uid] = u.userName;

        if (u.userName === myName && myUid === u.uid) {
          logWS("✔ myUid 確認済 (initRoom) = " + myUid);
        }
      });

      renderUsers();
      logWS("✔ initRoom push 受信 → 入室完了");
      return;
    }

    // newUser push
    if (event === "newUser push") {
      const u = payload[1];
      users[u.uid] = u.userName;

      if (u.uid === myUid) {
        logWS("✔ myUid 確認済 (newUser) = " + myUid);
      }

      renderUsers();
      return;
    }

    // userLeave push
    if (event === "userLeave push") {
      const uid = payload[1];
      delete users[uid];
      renderUsers();
      return;
    }

    // changeOwner push
    if (event === "changeOwner push") {
      ownerID = payload[1];
      renderUsers();
      return;
    }

    // kick push
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

    // chat push
    if (event === "chat push") {
      const uid = payload[1];
      const text = payload[2];
      const name = users[uid] || "(unknown)";
      addChat(name, text);
      return;
    }
  };
}

// ------------------------------
// 接続ボタン
// ------------------------------
document.getElementById("connectBtn").onclick = async () => {
  const url = document.getElementById("roomUrl").value;
  myName = document.getElementById("myName").value || "名無し";

  const rid = extractRid(url);
  const userNo = getUserNo();
  myUid = crypto.randomUUID();

  logWS("RID = " + rid);
  logWS("userNo = " + userNo);
  logWS("myUid = " + myUid);

  const wr = await detectCorrectWR(rid, userNo, myUid);

  if (!wr) {
    logWS("❌ 部屋サーバーが見つかりませんでした");
    return;
  }

  connectToWR(wr, rid, userNo, myUid);
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
