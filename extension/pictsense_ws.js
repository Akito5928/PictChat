let ws = null;
const users = {};
let ownerID = null;
let myUid = null;
let entryApproved = false;

const WR_SERVERS = ["wr1", "wr2", "wr3"];

// ------------------------------
// UIへの出力を background 経由で返す
// ------------------------------
function logWS(msg) {
  chrome.runtime.sendMessage({ action: "uiLog", text: msg });
}

function addChat(name, text) {
  chrome.runtime.sendMessage({ action: "uiChat", name, text });
}

function renderUsers() {
  chrome.runtime.sendMessage({ action: "uiUsers", users: Object.values(users) });
}

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
// 本接続
// ------------------------------
function connectToWR(wr, rid, userNo, myUid, myName) {
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

    if (data.startsWith("0")) return;

    if (data === "40") {
      logWS("✔ 40 received (transport ready)");

      ws.send(`42["entryRoomRequest send","${myName}"]`);
      logWS(`→ entryRoomRequest send: ${myName}`);

      ws.send(`42["setName","${myName}"]`);
      logWS(`→ setName (fallback): ${myName}`);
      return;
    }

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

    if (data === "2") {
      ws.send("3");
      logWS("→ pong");
      return;
    }

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
      logWS("✔ initRoom push 受信 → 入室完了");
      return;
    }

    if (event === "newUser push") {
      const u = payload[1];
      users[u.uid] = u.userName;
      renderUsers();
      return;
    }

    if (event === "userLeave push") {
      const uid = payload[1];
      delete users[uid];
      renderUsers();
      return;
    }

    if (event === "changeOwner push") {
      ownerID = payload[1];
      renderUsers();
      return;
    }

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
// background からのメッセージを受け取る
// ------------------------------
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.action === "connect") {
    const myName = msg.myName;
    const rid = extractRid(msg.roomUrl);
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

    connectToWR(wr, rid, userNo, myUid, myName);
  }

  if (msg.action === "chatSend" && ws) {
    ws.send(`42["chat send","${msg.text}",${Date.now()}]`);
    logWS(`→ chat send: ${msg.text}`);
  }
});
