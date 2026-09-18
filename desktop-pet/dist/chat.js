// src/conversation-api.mjs
async function conversationApi(path = "", body, options = {}) {
  const response = await fetch(`/desktop-pet/api/conversation${path}`, { ...options, method: body === void 0 ? "GET" : "POST", headers: { "content-type": "application/json" }, body: body === void 0 ? void 0 : JSON.stringify(body) });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? "\u684C\u5BA0\u8BF7\u6C42\u5931\u8D25");
  return value;
}

// src/chat.mjs
var find = (id) => document.getElementById(id);
var events = new EventSource("/desktop-pet/api/conversation/events");
var state;
var disposed = false;
var recorder;
var opening = false;
var recordingGeneration = 0;
var sending = false;
var status = (text) => {
  if (!disposed) find("status").textContent = text;
};
var render = () => {
  const list = find("messages"), bottom = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
  list.replaceChildren();
  if (!state?.session.messages.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "\u6211\u5728\u8FD9\u91CC\uFF0C\u968F\u65F6\u53EF\u4EE5\u804A\u804A\u3002";
    list.append(empty);
  }
  for (const message of state?.session.messages ?? []) {
    const node = document.createElement("div");
    node.className = `message ${message.role}`;
    node.textContent = message.content || "\u2026";
    if (["failed", "interrupted"].includes(message.status)) {
      const note = document.createElement("small");
      note.textContent = message.status === "failed" ? "\u56DE\u590D\u672A\u5B8C\u6210" : "\u5DF2\u505C\u6B62";
      node.append(note);
    }
    node.dataset.id = message.id;
    list.append(node);
  }
  find("send").disabled = Boolean(state?.generating || recorder || opening || sending);
  if (bottom) list.scrollTop = list.scrollHeight;
};
var run = (fn) => async () => {
  try {
    await fn();
  } catch (e) {
    status(e.message);
  }
};
events.addEventListener("state", (e) => {
  const wasGenerating = state?.generating;
  state = JSON.parse(e.data);
  if (wasGenerating && !state.generating) status("\u56DE\u590D\u5DF2\u5B8C\u6210\u3002");
  if (recorder?.id && !recorder.ending && state.recording !== recorder.id) {
    status("\u8BC6\u522B\u5DF2\u7ED3\u675F\u3002");
    void cancelRecording();
  }
  render();
});
events.addEventListener("text", (e) => {
  const { id, delta } = JSON.parse(e.data), message = state?.session.messages.find((m) => m.id === id);
  if (message) {
    message.content += delta;
    render();
  }
});
events.addEventListener("notice", (e) => status(JSON.parse(e.data).message));
events.addEventListener("transcript", (e) => {
  const value = JSON.parse(e.data);
  if (recorder?.id === value.id) {
    find("input").value = value.text;
    status(value.final ? "\u8BC6\u522B\u5B8C\u6210\uFF0C\u53EF\u4FEE\u6539\u540E\u53D1\u9001\u3002" : "\u6B63\u5728\u542C\u2026");
  }
});
events.onerror = () => {
  status("\u8FDE\u63A5\u4E2D\u65AD\uFF0C\u6B63\u5728\u91CD\u8FDE\u2026");
  void cancelRecording();
};
async function releaseCapture(rec) {
  clearTimeout(rec.timer);
  rec.stream?.getTracks().forEach((t) => t.stop());
  rec.node?.disconnect();
  rec.source?.disconnect();
  await rec.context?.close();
}
async function cancelRecording() {
  recordingGeneration++;
  const rec = recorder;
  recorder = null;
  opening = false;
  if (rec) {
    rec.cancelled = true;
    await releaseCapture(rec);
  }
  await conversationApi("/stop", {}).catch(() => {
  });
  if (!disposed) {
    find("record").textContent = "\u5F55\u97F3";
    render();
  }
}
async function endRecording() {
  const rec = recorder;
  if (!rec || rec.ending) return;
  rec.ending = true;
  clearTimeout(rec.timer);
  try {
    await new Promise((resolve) => {
      rec.flushed = resolve;
      rec.node.port.postMessage("flush");
      setTimeout(resolve, 300);
    });
    await releaseCapture(rec);
    await rec.upload;
    const result = await conversationApi("/record/end", { id: rec.id });
    if (!rec.cancelled && !disposed) {
      find("input").value = result.text;
      status(result.text ? "\u8BC6\u522B\u5B8C\u6210\uFF0C\u53EF\u4FEE\u6539\u540E\u53D1\u9001\u3002" : "\u6CA1\u6709\u542C\u6E05\uFF0C\u8BF7\u91CD\u8BD5\u6216\u6253\u5B57\u3002");
    }
  } finally {
    if (recorder === rec) recorder = null;
    find("record").textContent = "\u5F55\u97F3";
    render();
  }
}
find("record").onclick = run(async () => {
  if (recorder) return endRecording();
  if (opening) return;
  opening = true;
  const generation = ++recordingGeneration;
  render();
  status("\u6B63\u5728\u8BF7\u6C42\u9EA6\u514B\u98CE\u2026");
  let rec;
  try {
    await conversationApi("/stop", {});
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 }, video: false });
    if (disposed || generation !== recordingGeneration) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    rec = { stream, context: new AudioContext(), upload: Promise.resolve(), pending: 0 };
    recorder = rec;
    await rec.context.audioWorklet.addModule("/desktop-pet/recorder-worklet.js");
    const started = await conversationApi("/record/start", {});
    rec.id = started.id;
    if (disposed || generation !== recordingGeneration) {
      await cancelRecording();
      return;
    }
    rec.node = new AudioWorkletNode(rec.context, "pet-recorder");
    rec.source = rec.context.createMediaStreamSource(stream);
    rec.node.port.onmessage = (event) => {
      if (event.data.flushed) {
        rec.flushed?.();
        return;
      }
      if (rec.cancelled || !event.data.pcm) return;
      if (++rec.pending > 10) {
        status("\u7F51\u7EDC\u8F83\u6162\uFF0C\u5F55\u97F3\u5DF2\u505C\u6B62\u3002");
        void cancelRecording();
        return;
      }
      const bytes = new Uint8Array(event.data.pcm);
      let binary = "";
      for (const b of bytes) binary += String.fromCharCode(b);
      rec.upload = rec.upload.then(() => rec.cancelled ? void 0 : conversationApi("/record/chunk", { id: rec.id, pcm: btoa(binary) })).finally(() => rec.pending--);
      rec.upload.catch((e) => {
        if (!rec.cancelled) {
          status(e.message);
          void cancelRecording();
        }
      });
    };
    rec.source.connect(rec.node);
    const mute = rec.context.createGain();
    mute.gain.value = 0;
    rec.node.connect(mute).connect(rec.context.destination);
    await rec.context.resume();
    rec.timer = setTimeout(() => void endRecording().catch((e) => status(e.message)), started.seconds * 1e3);
    find("record").textContent = "\u7ED3\u675F\u5F55\u97F3";
    status("\u6B63\u5728\u542C\u2026\u7ED3\u675F\u5F55\u97F3\u540E\u53EF\u4FEE\u6539\u6587\u5B57\u3002");
  } catch (e) {
    if (rec) await cancelRecording();
    throw e;
  } finally {
    opening = false;
    render();
  }
});
var send = async () => {
  if (sending || state?.generating || recorder || opening) return;
  const text = find("input").value.trim();
  if (!text) return;
  sending = true;
  render();
  try {
    await conversationApi("/send", { text });
    find("input").value = "";
    status("\u6B63\u5728\u56DE\u590D\u2026");
  } finally {
    sending = false;
    render();
  }
};
find("send").onclick = run(send);
find("input").onkeydown = (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
    e.preventDefault();
    void send().catch((e2) => status(e2.message));
  }
};
find("stop").onclick = run(async () => {
  await cancelRecording();
  status("\u5DF2\u505C\u6B62\u3002");
});
var pause = document.createElement("button");
pause.textContent = "\u6682\u505C\u6717\u8BFB";
find("stop").after(pause);
var paused = false;
events.addEventListener("speech-stop", () => {
  paused = false;
  pause.textContent = "\u6682\u505C\u6717\u8BFB";
});
pause.onclick = run(async () => {
  paused = !paused;
  await conversationApi("/pause", { paused });
  pause.textContent = paused ? "\u7EE7\u7EED\u6717\u8BFB" : "\u6682\u505C\u6717\u8BFB";
});
find("new").onclick = run(async () => {
  await cancelRecording();
  state = await conversationApi("/new", {});
  render();
  status("\u5DF2\u5F00\u59CB\u65B0\u5BF9\u8BDD\u3002");
});
window.addEventListener("pagehide", () => {
  disposed = true;
  events.close();
  recordingGeneration++;
  if (recorder || opening) {
    if (recorder) {
      recorder.cancelled = true;
      void releaseCapture(recorder);
    }
    void conversationApi("/stop", {}, { keepalive: true }).catch(() => {
    });
  }
}, { once: true });
state = await conversationApi();
render();
//# sourceMappingURL=chat.js.map
