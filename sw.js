// 현장 사진 분류함 — 오프라인 실행용 서비스 워커
// 앱을 수정해서 다시 올릴 때는 아래 버전 숫자를 하나 올려 주세요.
const VERSION = "v1";
const CACHE = "fieldcam-" + VERSION;
const FONTS = "fieldcam-fonts";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./jszip.min.js",
  "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== FONTS).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // 앱 화면: 인터넷이 되면 최신 버전, 안 되거나 느리면(터널 안) 저장된 버전
  if (req.mode === "navigate") {
    e.respondWith(withTimeout(fetch(req), 3500)
      .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put("./index.html", copy)); } return res; })
      .catch(() => caches.match("./index.html", { ignoreSearch: true })));
    return;
  }

  // 앱 파일: 저장된 것을 먼저 사용
  if (url.origin === self.location.origin) {
    e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }

  // 글꼴: 한 번 받아 두고 오프라인에서도 사용
  if (/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.open(FONTS).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then((res) => { c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
  }
});
