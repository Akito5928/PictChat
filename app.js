let ws = null;
const users = {};
let ownerID = null;

function extractRid(url) {
  return url.split("#!/")[1];
}

function addChat(name, text) {
  const div = document.getElementById("chat");
  div.innerHTML += `<div><b>${name}:</b> ${text}</div>`;
  div.scrollTop = div.scrollHeight;
}

function renderUsers() {
  const div = document.getElementById("users");
  div.innerHTML = "";
  for (const uid in users) {
    const name = users[uid];
    const crown = uid === ownerID ? "👑 " : "";
    div.innerHTML += `<div>${crown}${name}</div>`;
  }
}

document.getElementById("connectBtn").onclick = () => {
  const url = document.getElementById("roomUrl").value;
  const rid = extractRid(url);

  ws = new WebSocket(
    `wss://wl.pictsense.com/socket.io/?rid=${rid}&EIO=4&transport=websocket`
  );

  ws.onmessage = (e) => {
    if (!e.data.startsWith("42")) return;

    const payload = JSON.parse(e.data.slice(2));
    const event = payload[0];

    if (event === "initRoom push") {
      const info = payload[1];
      ownerID = info.ownerID;

      info.userList.forEach(u => {
        users[u.uid] = u.userName;
      });

      renderUsers();
    }

    if (event === "newUser push") {
      const u = payload[1];
      users[u.uid] = u.userName;
      renderUsers();
    }

    if (event === "userLeave push") {
      delete users[payload[1]];
      renderUsers();
    }

    if (event === "changeOwner push") {
      ownerID = payload[1];
      renderUsers();
    }

    if (event === "chat push") {
      const uid = payload[1];
      const text = payload[2];
      const name = users[uid] || "(unknown)";
      addChat(name, text);
    }
  };
};

document.getElementById("sendBtn").onclick = () => {
  const text = document.getElementById("msg").value;
  ws.send(`42["chat send","${text}",${Date.now()}]`);
  document.getElementById("msg").value = "";
};
