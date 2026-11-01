// PeerJS（公開サーバー 0.peerjs.com）で WebRTC の P2P 接続を張る。
// ルーム番号 5 桁 → ホストの Peer ID「hussmash-v2-12345」。クライアントはそこへつなぐ。
// v の番号は version.js の PROTOCOL（版の違う人どうしは、同じ番号でも別のルームになってつながらない）。
// 接続は reliable: false、serialization: "raw"（PeerJS に JSON / BinaryPack の解読をさせず、
// 届いた生の文字列を自分で長さを見てから読む）。それ以外の形でつないできた相手はすぐ切る。

import { PROTOCOL } from "./version.js";
import { parse, checkFromClient, checkFromHost, MAX_FROM_CLIENT, MAX_FROM_HOST } from "./protocol.js";

const ID_PREFIX = `hussmash-v${PROTOCOL}-`;
const TIMEOUT_MS = 8000;        // これだけ何も届かなければ切れたとみなす
const OPEN_TIMEOUT_MS = 15000;  // つながるまでの待ち時間
const MAX_PENDING = 6;          // まだ開いていない接続の上限（大量の接続要求への備え）

const Peer = () => window.Peer;

export const randomRoom = () => String(Math.floor(10000 + Math.random() * 90000));
export const isRoomCode = s => /^[0-9]{5}$/.test(s);

/** 1 秒あたり rate 通まで（ためられるのは burst 通）。超えた分は捨てる */
class Limiter {
  constructor(rate, burst) {
    this.rate = rate; this.burst = burst; this.tokens = burst; this.t = performance.now();
    this.dropped = 0;
  }
  take() {
    const now = performance.now();
    this.tokens = Math.min(this.burst, this.tokens + (now - this.t) * this.rate / 1000);
    this.t = now;
    if (this.tokens < 1) { this.dropped++; return false; }
    this.tokens--;
    return true;
  }
}

function errorText(err) {
  switch (err?.type) {
    case "unavailable-id": return "その番号のルームはすでに使われています。";
    case "peer-unavailable": return "ルームが見つかりません。番号と、ホストとバージョンが同じか（タイトルの v○○）を確かめてください。";
    case "browser-incompatible": return "このブラウザは WebRTC に対応していません。";
    case "network": case "socket-error": case "socket-closed": case "server-error":
      return "接続サーバーにつながりませんでした。通信環境を確かめてください。";
    default: return "通信エラーが起きました。";
  }
}

/** 文字列にして送る。送れなかったら（切れかけなど）黙って捨てる */
function sendRaw(conn, obj) {
  if (!conn.open) return;
  try { conn.send(JSON.stringify(obj)); } catch { /* 失敗したら次の送信に任せる */ }
}

// ---- ホスト ----

/**
 * ルームを立てる。handlers:
 *   accept(peerId) → 入れるならスロット番号、だめなら "full" / "started"
 *   message(peerId, msg)  検査済みのメッセージ
 *   leave(peerId)
 */
export function hostRoom(code, handlers) {
  return new Promise((resolve, reject) => {
    if (!Peer()) { reject(new Error("PeerJS を読み込めませんでした。")); return; }
    const peer = new (Peer())(ID_PREFIX + code, { debug: 0 });
    const peers = new Map();   // peerId → { conn, last, limiter }
    let pending = 0;
    let ready = false;

    const drop = id => {
      const p = peers.get(id);
      if (!p) return;
      peers.delete(id);
      try { p.conn.close(); } catch { /* もう閉じている */ }
      handlers.leave(id);
    };

    peer.on("open", () => {
      ready = true;
      resolve(api);
    });
    peer.on("error", err => {
      if (!ready) { peer.destroy(); reject(new Error(errorText(err))); }
      else console.warn("peer error", err?.type);
    });
    // シグナリングサーバーとの接続だけが切れた（張ったP2Pは生きている）。新しい人が入れるようにつなぎ直す
    peer.on("disconnected", () => { if (!peer.destroyed) setTimeout(() => { try { peer.reconnect(); } catch { /* 次に任せる */ } }, 2000); });

    peer.on("connection", conn => {
      if (conn.serialization !== "raw" || conn.reliable || pending >= MAX_PENDING || peers.has(conn.peer)) {
        try { conn.close(); } catch { /* 無視 */ }
        return;
      }
      pending++;
      let opened = false;
      const openTimer = setTimeout(() => { if (!opened) { pending--; try { conn.close(); } catch { /* 無視 */ } } }, OPEN_TIMEOUT_MS);
      conn.on("open", () => {
        opened = true;
        pending--;
        clearTimeout(openTimer);
        const res = handlers.accept(conn.peer);
        if (typeof res !== "number") {
          sendRaw(conn, { t: "no", r: res });
          setTimeout(() => { try { conn.close(); } catch { /* 無視 */ } }, 500);
          return;
        }
        const entry = { conn, last: performance.now(), limiter: new Limiter(150, 60) };
        peers.set(conn.peer, entry);
        conn.on("data", raw => {
          if (peers.get(conn.peer) !== entry) return;
          if (!entry.limiter.take()) return;
          const o = parse(raw, MAX_FROM_CLIENT);
          const msg = o && checkFromClient(o);
          if (!msg) return;
          entry.last = performance.now();
          if (msg.t === "by") { drop(conn.peer); return; }
          handlers.message(conn.peer, msg);
        });
      });
      conn.on("close", () => { if (!opened) { opened = true; pending--; clearTimeout(openTimer); } drop(conn.peer); });
      conn.on("error", () => drop(conn.peer));
    });

    // 黙って消えた相手・送りすぎる相手を切る
    const watch = setInterval(() => {
      const now = performance.now();
      for (const [id, p] of peers) {
        if (now - p.last > TIMEOUT_MS || p.limiter.dropped > 300) drop(id);
        else p.limiter.dropped = 0;
      }
    }, 1000);

    const api = {
      code,
      send(id, obj) { const p = peers.get(id); if (p) sendRaw(p.conn, obj); },
      /** JSON にした文字列をそのまま送る（スナップショットは全員ぶんを 1 回だけ JSON にして使い回す） */
      sendText(id, s) { const p = peers.get(id); if (p?.conn.open) { try { p.conn.send(s); } catch { /* 無視 */ } } },
      kick: drop,
      close() {
        clearInterval(watch);
        for (const p of peers.values()) sendRaw(p.conn, { t: "no", r: "other" });
        setTimeout(() => peer.destroy(), 200);
      },
    };
  });
}

// ---- クライアント ----

/**
 * ルームに入る。handlers:
 *   message(msg)  検査済みのメッセージ（ホストからだけ）
 *   lost(text)    切れた
 */
export function joinRoom(code, handlers) {
  return new Promise((resolve, reject) => {
    if (!Peer()) { reject(new Error("PeerJS を読み込めませんでした。")); return; }
    const peer = new (Peer())({ debug: 0 });
    let conn = null, opened = false, closed = false, last = performance.now(), watch = 0;
    const limiter = new Limiter(150, 60);

    const fail = text => {
      if (closed) return;
      closed = true;
      clearInterval(watch);
      try { peer.destroy(); } catch { /* 無視 */ }
      if (!opened) reject(new Error(text));
      else handlers.lost(text);
    };
    const openTimer = setTimeout(() => { if (!opened) fail("ルームにつながりませんでした（時間切れ）。"); }, OPEN_TIMEOUT_MS);

    peer.on("error", err => fail(errorText(err)));
    peer.on("open", () => {
      conn = peer.connect(ID_PREFIX + code, { reliable: false, serialization: "raw" });
      conn.on("open", () => {
        opened = true;
        clearTimeout(openTimer);
        last = performance.now();
        watch = setInterval(() => { if (performance.now() - last > TIMEOUT_MS) fail("ホストとの通信が途絶えました。"); }, 1000);
        resolve(api);
      });
      conn.on("data", raw => {
        if (closed || !limiter.take()) return;
        const o = parse(raw, MAX_FROM_HOST);
        const msg = o && checkFromHost(o);
        if (!msg) return;
        last = performance.now();
        if (msg.t === "no") {
          fail(msg.r === "full" ? "ルームが満員です。" : msg.r === "started" ? "対戦中のため入れませんでした。" : "ホストがルームを閉じました。");
          return;
        }
        handlers.message(msg);
      });
      conn.on("close", () => fail("ホストとの接続が切れました。"));
      conn.on("error", () => fail("ホストとの接続でエラーが起きました。"));
    });

    const api = {
      code,
      send(obj) { if (conn && !closed) sendRaw(conn, obj); },
      close() {
        if (closed) return;
        if (conn) sendRaw(conn, { t: "by" });
        closed = true;
        clearInterval(watch);
        setTimeout(() => { try { peer.destroy(); } catch { /* 無視 */ } }, 150);
      },
    };
  });
}
