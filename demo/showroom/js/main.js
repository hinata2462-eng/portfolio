/* ═══════════════════════════════════════════════════════════
   SAMPLE MOTORS — main.js
   設計書v1.1 §4演出 / §6導線・データ / §7計測
   G10審議(2026-08-05)の指摘反映済み。GSAPは不使用(§5-4 JS予算)。
   ═══════════════════════════════════════════════════════════ */
(function () {
'use strict';

/* ─── 設定(公開前にここを実データへ差し替え) ─── */
const CONFIG = {
  LINE_ID: '@sample_motors',      // TODO: LINE公式アカウントのベーシックID(@込み)
  GA4_ID: '',                     // TODO: 'G-XXXXXXXXXX'(空なら計測はconsole出力のみ)
  RECORDS_API_URL: '',            // TODO: GASデプロイURL(空なら内蔵サンプル表示)
  TEL: '0276-00-0000',            // TODO: 固定電話(表示・発信ともこの値を使用)
  BUSINESS_HOURS: { open: 10, close: 19 }, // 営業時間(この外は追従バーが「LINEなら24時間」に切替)
  VENUES_LABEL: '50+',            // TODO: 実際に入札可能な会場数を確認して差し替え
  RECORDS_BASE_COUNT: 0,          // シート移行前の実績台数を加算したい場合に使用
};
// Preloaderのkill switch(§7)は index.html <head> の window.TN_PRELOADER = false

const html = document.documentElement;
const FX = html.classList.contains('fx'); // 演出ON(reduced-motionならOFF)

/* JSが正常起動したので、head側のfx-timeout保険(JS事故時の強制表示)を解除 */
if (window.__fxTimer) clearTimeout(window.__fxTimer);
html.classList.remove('fx-timeout');

/* 外部データ(GAS)由来の文字列は必ずこれを通す */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/* ストレージ遮断環境(Cookie全ブロック等)でも本体を止めない */
function safeGet(key) {
  try { return sessionStorage.getItem(key); } catch (e) { return null; }
}
function safeSet(key, val) {
  try { sessionStorage.setItem(key, val); } catch (e) { /* noop */ }
}

/* ═══ §7 計測 ═══ */
function track(name, params) {
  if (typeof window.gtag === 'function') {
    window.gtag('event', name, params || {});
  } else {
    console.debug('[GA4]', name, params || {});
  }
}
if (CONFIG.GA4_ID) {
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + CONFIG.GA4_ID;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  // beacon指定: line_open等、外部遷移直前のイベント喪失を防ぐ
  window.gtag('config', CONFIG.GA4_ID, { transport_type: 'beacon' });
}

/* ═══ LINE導線(§6: 本文プリセット方式・2タップ) ═══ */
/* ベーシックID(@・英数・._-)はURLパスとして安全なのでエンコードしない
   (%40化はLINEアプリ内での解釈差の報告があるため生の@で送る) */
function lineUrl(text) {
  return 'https://line.me/R/oaMessage/' + CONFIG.LINE_ID + '/?' + encodeURIComponent(text);
}
function openLine(text, context) {
  track('line_open', { context: context });
  window.location.href = lineUrl(text);
}
const GENERIC_CONSULT_TEXT =
  '【車さがし相談】\nSAMPLE MOTORSのサイトから相談です。\n・予算:\n・希望の車種やタイプ:\n・その他:\n(わかる範囲でOKです)';
const SELL_CONSULT_TEXT =
  '【無料査定希望】\n今の車がいくらになるか知りたいです。\n・車種:\n・年式:\n・走行距離:\n(わかる範囲でOKです)';

document.querySelectorAll('.js-line-link').forEach((a) => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    openLine(GENERIC_CONSULT_TEXT, a.dataset.lineContext || 'unknown');
  });
});
document.querySelectorAll('.js-sell').forEach((a) => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    track('sell_tap', { source: a.dataset.sellSource || 'unknown' });
    openLine(SELL_CONSULT_TEXT, 'sell_' + (a.dataset.sellSource || 'unknown'));
  });
});
/* 信頼ブロック等の電話リンク: 表示・発信ともCONFIG.TELに一本化 */
document.querySelectorAll('a.js-tel').forEach((a) => {
  a.href = 'tel:' + CONFIG.TEL.replace(/-/g, '');
  if (/\d{2,4}-/.test(a.textContent)) a.textContent = CONFIG.TEL;
  a.addEventListener('click', () => track('tel_tap', { source: 'trust' }));
});

/* ═══ 追従バーTEL: クリック時点の営業時間で判定(§6)。計測の二重発火なし ═══ */
(function dockTel() {
  const btn = document.getElementById('dockTel');
  const label = document.getElementById('dockTelLabel');
  if (!btn || !label) return;
  const ico = btn.querySelector('.dock-ico');
  function isOpen() {
    const h = new Date().getHours();
    return h >= CONFIG.BUSINESS_HOURS.open && h < CONFIG.BUSINESS_HOURS.close;
  }
  function refresh() {
    if (isOpen()) {
      label.textContent = '電話する';
      ico.textContent = '☎';
      btn.href = 'tel:' + CONFIG.TEL.replace(/-/g, '');
    } else {
      label.textContent = 'LINEなら24時間';
      ico.textContent = '✉';
      btn.href = '#';
    }
  }
  btn.addEventListener('click', (e) => {
    if (isOpen()) {
      track('tel_tap', { source: 'dock' });
    } else {
      e.preventDefault();
      openLine(GENERIC_CONSULT_TEXT, 'dock_afterhours');
    }
  });
  refresh();
  setInterval(refresh, 60000); // 営業時間を跨ぐ滞在にも追従
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
})();

/* ═══ ① Preloader(初回のみ1.2秒・タップ/キーでスキップ)
   表示判定はhead側インラインスクリプト(html.pre)。ここは閉じる処理のみ ═══ */
(function preloader() {
  const el = document.getElementById('preloader');
  if (!el || !html.classList.contains('pre')) return;
  el.setAttribute('aria-hidden', 'false');
  let closed = false;
  const close = (skipped) => {
    if (closed) return;
    closed = true;
    if (skipped) track('preloader_skip', {});
    el.classList.add('closing');
    setTimeout(() => {
      html.classList.remove('pre');
      el.setAttribute('aria-hidden', 'true');
    }, 300);
    safeSet('tn_preloaded', '1');
  };
  el.addEventListener('click', () => close(true));
  document.addEventListener('keydown', (e) => {
    if (!closed && (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ')) close(true);
  });
  setTimeout(() => close(false), 1200);
})();

/* ═══ ② HERO見出し: 行ごとMask Reveal + stagger 0.08s ═══ */
(function heroReveal() {
  if (!FX) return;
  const lines = document.querySelectorAll('.hero .line-in');
  const base = html.classList.contains('pre') ? 1150 : 150;
  lines.forEach((el, i) => {
    setTimeout(() => el.classList.add('shown'), base + i * 80);
  });
  // 見出し点灯後: 車が入場(400ms)→ヘッドライト点灯
  const car = document.getElementById('heroCar');
  if (car) {
    const carAt = base + lines.length * 80 + 80;
    setTimeout(() => car.classList.add('shown'), carAt);
    setTimeout(() => car.classList.add('lit'), carAt + 430);
  }
})();

/* ═══ ③ Particles(HERO背景: 赤/白の光粒・少数・低速)
   HERO画面外では停止(rafId管理でループ多重化を防止) ═══ */
(function particles() {
  const canvas = document.getElementById('particles');
  if (!canvas || !FX) return;
  const ctx = canvas.getContext('2d');
  let w, h, dpr;
  const dots = [];
  const N = 16;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.offsetWidth;
    h = canvas.offsetHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);
  for (let i = 0; i < N; i++) {
    dots.push({
      x: Math.random() * 100, y: Math.random() * 100,
      r: 0.8 + Math.random() * 1.8,
      vx: -0.006 - Math.random() * 0.012, vy: (Math.random() - 0.5) * 0.004,
      red: Math.random() < 0.4,
      o: 0.04 + Math.random() * 0.11, // opacity 0.15以下(§4-③)
    });
  }
  let rafId = null;
  function frame() {
    ctx.clearRect(0, 0, w, h);
    for (const d of dots) {
      d.x += d.vx; d.y += d.vy;
      if (d.x < -2) { d.x = 102; d.y = Math.random() * 100; }
      if (d.y < -2) d.y = 102;
      if (d.y > 102) d.y = -2;
      ctx.beginPath();
      ctx.arc((d.x / 100) * w, (d.y / 100) * h, d.r, 0, Math.PI * 2);
      ctx.fillStyle = d.red ? 'rgba(229,52,43,' + d.o + ')' : 'rgba(242,240,233,' + d.o + ')';
      ctx.fill();
    }
    rafId = requestAnimationFrame(frame);
  }
  function start() { if (rafId === null) rafId = requestAnimationFrame(frame); }
  function stop() { if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; } }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      entries[0].isIntersecting ? start() : stop();
    }, { threshold: 0 }).observe(document.getElementById('hero'));
  } else {
    start();
  }
})();

/* ═══ ④ Reveal on Scroll(fade+8px上昇 300ms・1回のみ) ═══ */
(function revealOnScroll() {
  const targets = document.querySelectorAll('.reveal');
  if (!FX || !('IntersectionObserver' in window)) {
    targets.forEach((t) => t.classList.add('revealed'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        en.target.classList.add('revealed');
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.15 });
  targets.forEach((t) => io.observe(t));
})();

/* ═══ ⑤ Pin+Scrub: ヘッドライトが3ステップを順に照らす(scrub使用はここのみ)
   position:sticky + scroll進捗の自前実装(GSAP撤去: §5-4 JS予算50KB遵守) ═══ */
(function stepsPin() {
  const wrap = document.getElementById('stepsPinwrap');
  const stepsWrap = document.getElementById('steps');
  const beam = document.getElementById('beam');
  if (!wrap || !stepsWrap || !beam || !FX) return; // 演出OFF時: 縦積み・全点灯のまま
  stepsWrap.classList.add('fx-armed');
  const steps = stepsWrap.querySelectorAll('.step');
  const LIT_AT = [0.02, 0.38, 0.72];
  let ticking = false;
  function update() {
    ticking = false;
    const rect = wrap.getBoundingClientRect();
    const total = wrap.offsetHeight - window.innerHeight;
    if (total <= 0) return;
    const p = Math.min(1, Math.max(0, -rect.top / total));
    const first = steps[0].offsetTop;
    const last = steps[steps.length - 1].offsetTop;
    beam.style.transform = 'translateY(' + (first + (last - first) * p - 20) + 'px)';
    steps.forEach((s, i) => s.classList.toggle('lit', p >= LIT_AT[i]));
  }
  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();
})();

/* ═══════════════════════════════════════════════════════════
   診断(§3-3): 7問 → タコメーター(⑥) → 依頼票排出(⑦) → LINE
   ロジックは関数境界を維持(将来Claude API版へ差し替え可能)
   ═══════════════════════════════════════════════════════════ */
const QUESTIONS = [
  { key: 'use', label: '用途', q: 'いま探しているのは、どんな1台?', opts: ['通勤・買い物の足', '家族のメイン車', '趣味・週末の相棒', '仕事で使う(社用・商用)'] },
  { key: 'body', label: 'ボディ', q: 'ボディタイプの希望は?', opts: ['軽自動車', 'コンパクトカー', 'ミニバン', 'SUV', 'セダン・その他', 'プロにおまかせ'] },
  { key: 'budget', label: '予算総額', q: '予算は?(登録・納車までコミコミ)', opts: ['〜50万円', '50〜100万円', '100〜150万円', '150〜250万円', '250万円〜'] },
  { key: 'priority', label: 'こだわり', q: 'いちばん譲れないのは?', opts: ['年式の新しさ', '走行距離の少なさ', '装備・グレード', 'とにかく総額を安く'] },
  { key: 'color', label: '色', q: '色の希望は?', opts: ['白系', '黒系', 'シルバー・グレー系', 'カラフル系', 'こだわらない'] },
  { key: 'when', label: '納期', q: 'いつまでに欲しい?', opts: ['今すぐ(2週間以内)', '1ヶ月以内', '2〜3ヶ月以内', '急がない・いい出物があれば'] },
  { key: 'current', label: '今の車', q: 'いま乗っている車はどうする?', opts: ['売却・下取りも相談したい', '廃車にしたい', 'そのまま持っておく', '車は持っていない'] },
];

/* 総額目安(万円)。デモ版ロジック移植部 — 将来Claude API版に差し替える境界 */
function estimateTotal(answers) {
  const bands = {
    '〜50万円': [30, 50],
    '50〜100万円': [55, 98],
    '100〜150万円': [105, 148],
    '150〜250万円': [155, 245],
    '250万円〜': [255, 400],
  };
  const band = bands[answers.budget];
  if (!band) return null;
  return { min: band[0] * 10000, max: band[1] * 10000 };
}

function yen(n) {
  return '¥' + n.toLocaleString('ja-JP');
}

function buildSlipText(answers, slipNo, partial) {
  const lines = ['【車両調達依頼票】SAMPLE MOTORS'];
  if (slipNo) lines.push('伝票No: ' + slipNo);
  if (partial) lines.push('(30秒診断の途中から相談)');
  QUESTIONS.forEach((qd) => {
    if (answers[qd.key]) lines.push(qd.label + ': ' + answers[qd.key]);
  });
  const est = estimateTotal(answers);
  if (est) lines.push('総額目安: ' + yen(est.min) + '〜' + yen(est.max));
  lines.push('---');
  lines.push('この内容で相談します。よろしくお願いします。');
  return lines.join('\n');
}

const quiz = {
  idx: 0,
  answers: {},
  started: false,
  reached: new Set(),
  slipNo: '',
  locked: false,     // 連打ガード(設問遷移の予約中はtrue)
  completing: false, // completeQuizの二重実行ガード
  sellTracked: false,
  retries: 0,
};

const quizBody = document.getElementById('quizBody');
const quizBack = document.getElementById('quizBack');
const quizPartial = document.getElementById('quizPartial');
const tacho = document.getElementById('tacho');
const tachoNeedle = document.getElementById('tachoNeedle');
const tachoCount = document.getElementById('tachoCount');

/* タコメーターの目盛りを生成(0〜7) */
(function tachoTicks() {
  const g = document.getElementById('tachoTicks');
  if (!g) return;
  let s = '';
  for (let i = 0; i <= 7; i++) {
    const a = (i / 7) * Math.PI;
    const cx = 100, cy = 110;
    const x1 = cx - 68 * Math.cos(a), y1 = cy - 68 * Math.sin(a);
    const x2 = cx - 76 * Math.cos(a), y2 = cy - 76 * Math.sin(a);
    s += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '"/>';
  }
  g.innerHTML = s;
})();

function setNeedle(count) {
  const deg = (count / 7) * 180;
  tachoNeedle.style.setProperty('--deg', deg + 'deg');
  tachoCount.textContent = String(count);
  tacho.classList.toggle('redzone', count >= 6); // 残り1問でレッドゾーン(§4-⑥)
}

function answeredCount() {
  return Object.keys(quiz.answers).length;
}

function renderQuestion(moveFocus) {
  const qd = QUESTIONS[quiz.idx];
  const n = quiz.idx + 1;
  quiz.locked = false;
  // §7「各設問到達」: 初期描画では発火させない(Q1はIntersectionObserverで到達時に発火)
  if (quiz.started && !quiz.reached.has(n)) {
    quiz.reached.add(n);
    track('quiz_q' + n, {});
  }
  const optsHtml = qd.opts
    .map((o) => {
      const sel = quiz.answers[qd.key] === o;
      return '<button type="button" class="quiz-opt' + (sel ? ' selected' : '') +
        '" aria-pressed="' + sel + '" data-val="' + o + '">' + o + '</button>';
    })
    .join('');
  quizBody.innerHTML =
    '<p class="quiz-q" id="quizQ" tabindex="-1"><span class="quiz-qno">Q' + n + ' / 7 — ' + qd.label + '</span>' + qd.q + '</p>' +
    '<div class="quiz-opts">' + optsHtml + '</div>';
  quizBody.querySelectorAll('.quiz-opt').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (quiz.locked) return; // 連打で設問がスキップされるのを防ぐ
      quiz.locked = true;
      if (!quiz.started) {
        quiz.started = true;
        quiz.reached.add(1);
        if (!firedQ1) { firedQ1 = true; track('quiz_q1', {}); }
        track('quiz_start', {});
      }
      quiz.answers[qd.key] = btn.dataset.val;
      if (qd.key === 'current' && btn.dataset.val === '売却・下取りも相談したい' && !quiz.sellTracked) {
        quiz.sellTracked = true;
        track('sell_tap', { source: 'quiz_q7' }); // 売却導線3入口のひとつ(§6)
      }
      quizBody.querySelectorAll('.quiz-opt').forEach((b) => {
        b.classList.toggle('selected', b === btn);
        b.setAttribute('aria-pressed', String(b === btn));
        b.disabled = b !== btn;
      });
      setNeedle(answeredCount());
      setTimeout(() => {
        if (quiz.idx < QUESTIONS.length - 1) {
          quiz.idx++;
          renderQuestion(true);
        } else {
          completeQuiz();
        }
      }, 220);
    });
  });
  quizBack.hidden = quiz.idx === 0;
  // キーボード/SR利用者のフォーカスを新しい設問へ(初期描画では動かさない)
  if (moveFocus) {
    const qEl = document.getElementById('quizQ');
    if (qEl) qEl.focus({ preventScroll: true });
  }
}

/* Q1の「設問到達」(§7)は診断セクションの可視化で発火 */
let firedQ1 = false;
(function watchQuizReach() {
  const panel = document.getElementById('quizPanel');
  if (!panel || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !firedQ1) {
      firedQ1 = true;
      quiz.reached.add(1);
      track('quiz_q1', {});
      io.disconnect();
    }
  }, { threshold: 0.3 });
  io.observe(panel);
})();

quizBack.addEventListener('click', () => {
  if (quiz.idx > 0) {
    quiz.idx--;
    renderQuestion(true);
  }
});

/* 途中相談(全設問に常設・押下時点の回答をプリセットしてLINEへ) */
quizPartial.addEventListener('click', () => {
  track('quiz_partial_consult', { answered: answeredCount() });
  const text = answeredCount() > 0
    ? buildSlipText(quiz.answers, null, true)
    : GENERIC_CONSULT_TEXT;
  openLine(text, 'quiz_partial');
});

/* ═══ 完了: 針振り切り → 依頼票排出(⑦) + スクランブル(⑧) ═══ */
function completeQuiz() {
  if (quiz.completing) return;
  quiz.completing = true;
  setNeedle(7);
  track('slip_issued', { retry: quiz.retries });
  quiz.slipNo = makeSlipNo();
  const delay = FX ? 500 : 0;
  setTimeout(showSlip, delay);
}

function makeSlipNo() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  return 'TN-' + String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + rand;
}

function showSlip() {
  const area = document.getElementById('slipArea');
  const slip = document.getElementById('slip');
  const rows = document.getElementById('slipRows');
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  // 再発行時に前回の伝票No・総額が見えないよう先にプレースホルダへ戻す
  document.getElementById('slipNo').textContent = 'TN-______-____';
  document.getElementById('slipTotal').textContent = '¥---';
  document.getElementById('slipDate').textContent =
    d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  rows.innerHTML = QUESTIONS.map((qd) =>
    '<div><dt>' + qd.label + '</dt><dd>' + (quiz.answers[qd.key] || '—') + '</dd></div>'
  ).join('');
  const est = estimateTotal(quiz.answers);
  const totalText = est ? yen(est.min) + '〜' + yen(est.max) : '相談のうえ';
  area.hidden = false;
  document.getElementById('quizPanel').hidden = true;
  // SRへ発行を通知し、フォーカスを依頼票へ
  document.getElementById('slipStatus').textContent = '依頼票を発行しました。内容を確認して、LINEでそのまま送信できます。';
  // 排出(600ms) → スクランブル(0.3s)。rAFはタブ非表示時に止まるためタイマー駆動
  setTimeout(() => {
    slip.classList.add('ejected');
    slip.focus({ preventScroll: true });
    const wait = FX ? 500 : 0;
    setTimeout(() => {
      scramble(document.getElementById('slipNo'), quiz.slipNo);
      scramble(document.getElementById('slipTotal'), totalText);
    }, wait);
  }, 30);
  area.scrollIntoView({ behavior: FX ? 'smooth' : 'auto', block: 'center' });
  // LINE送信(2タップ目)
  const lineBtn = document.getElementById('slipLineBtn');
  lineBtn.onclick = (e) => {
    e.preventDefault();
    openLine(buildSlipText(quiz.answers, quiz.slipNo, false), 'slip');
  };
  document.getElementById('slipCopyBtn').onclick = () => {
    copyText(buildSlipText(quiz.answers, quiz.slipNo, false));
  };
  document.getElementById('quizRetry').onclick = () => {
    // 回答は保持したまま先頭へ(1タップずつ確認・修正しながら再発行できる)
    quiz.idx = 0;
    quiz.retries++;
    quiz.completing = false;
    slip.classList.remove('ejected');
    area.hidden = true;
    document.getElementById('slipStatus').textContent = '';
    document.getElementById('quizPanel').hidden = false;
    setNeedle(answeredCount());
    renderQuestion(true);
    document.getElementById('quiz').scrollIntoView({ behavior: FX ? 'smooth' : 'auto' });
  };
}

/* ⑧ Text Scramble: 数字のみ0.3秒で解読 */
function scramble(el, finalText) {
  if (!FX || document.hidden) { el.textContent = finalText; return; }
  const DUR = 300;
  const start = performance.now();
  function frame(now) {
    const p = Math.min(1, (now - start) / DUR);
    el.textContent = finalText.replace(/\d/g, (c, i) =>
      (i / finalText.length) < p ? c : String(Math.floor(Math.random() * 10))
    );
    if (p < 1) requestAnimationFrame(frame);
    else el.textContent = finalText;
  }
  requestAnimationFrame(frame);
  setTimeout(() => { el.textContent = finalText; }, DUR + 120); // rAF停止時の最終値保証
}

/* コピー成功時のみslip_copyを計測(§7の実効性評価を汚さない) */
function copyText(text) {
  const done = () => { track('slip_copy', {}); toastCopy('コピーしました'); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, () => legacyCopy(text, done));
  } else {
    legacyCopy(text, done);
  }
}
function legacyCopy(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    if (document.execCommand('copy')) done();
    else toastCopy('コピーできませんでした');
  } catch (e) { toastCopy('コピーできませんでした'); }
  document.body.removeChild(ta);
}
function toastCopy(msg) {
  const btn = document.getElementById('slipCopyBtn');
  btn.textContent = msg;
  setTimeout(() => { btn.textContent = '内容をコピー(予備)'; }, 1600);
}

renderQuestion(false);
setNeedle(0);

/* ═══════════════════════════════════════════════════════════
   納車実績(§3-4): GAS JSON API → フォールバック内蔵サンプル
   ═══════════════════════════════════════════════════════════ */
const SAMPLE_RECORDS = [
  { date: '2026-07', car: 'N-BOX カスタム', type: '軽自動車', price: 118, days: 9, area: '見本市', comment: '通勤+お子さんの送迎用。走行2.8万kmの高評価車。' },
  { date: '2026-07', car: 'ヴォクシー ZS 煌', type: 'ミニバン', price: 189, days: 14, area: '伊勢崎市', comment: '7人家族のメイン車。両側電動スライド必須条件でした。' },
  { date: '2026-06', car: 'ハスラー Jスタイル', type: '軽自動車', price: 102, days: 11, area: 'サンプル市', comment: '初めての車。総額を抑えつつ装備優先で選定。' },
  { date: '2026-06', car: 'ヤリスクロス ハイブリッド', type: 'SUV', price: 218, days: 17, area: '足利市', comment: '燃費重視の通勤車。会場3回目で条件どんぴしゃ。' },
  { date: '2026-05', car: 'アルファード 2.5S', type: 'ミニバン', price: 348, days: 21, area: '見本市', comment: '法人様の送迎車。内装の状態を最優先で捜索。' },
  { date: '2026-05', car: 'フィット ホーム', type: 'コンパクト', price: 128, days: 8, area: '館林市', comment: '奥様の買い物用。最短記録の8日納車。' },
  { date: '2026-04', car: 'ジムニー XC', type: 'SUV', price: 205, days: 28, area: '前橋市', comment: '人気車のため3週間粘って相場より安く落札。' },
  { date: '2026-04', car: 'タント カスタムRS', type: '軽自動車', price: 132, days: 10, area: '見本市', comment: '下取り車の売却も同時に代行しました。' },
];

const recordState = { all: [], filter: 'すべて' };
const stampedKeys = new Set(); // スタンプ演出は1実績につき1回だけ(§5-2)
let stampObserver = null;

function recordKey(r) { return r.car + '|' + r.date + '|' + r.price; }

function showRecordsNote(msg) {
  const note = document.getElementById('recordsNote');
  note.textContent = msg;
  note.hidden = false;
}

async function loadRecords() {
  const list = document.getElementById('recordList');
  if (!CONFIG.RECORDS_API_URL) {
    recordState.all = SAMPLE_RECORDS;
    // 架空データを実績と誤認させない(優良誤認防止)
    showRecordsNote('※現在は表示サンプルです(実績データ準備中)');
    renderRecords();
    return;
  }
  // スケルトン表示(§6: 取得中はスケルトン、失敗時は内蔵サンプルへ)
  list.innerHTML = '<div class="record-skel"></div>'.repeat(3);
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(CONFIG.RECORDS_API_URL, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const rows = Array.isArray(data.records)
      ? data.records.filter((r) => r && typeof r === 'object' && r.car)
      : [];
    if (rows.length === 0) throw new Error('empty');
    recordState.all = rows;
  } catch (e) {
    recordState.all = SAMPLE_RECORDS;
    showRecordsNote('※通信状況によりサンプル実績を表示しています');
  }
  renderRecords();
}

function renderFilters() {
  const wrap = document.getElementById('recordFilters');
  const types = ['すべて'].concat([...new Set(recordState.all.map((r) => String(r.type || 'その他')))]);
  wrap.innerHTML = types
    .map((t) => {
      const active = t === recordState.filter;
      return '<button type="button" class="rec-filter' + (active ? ' active' : '') +
        '" aria-pressed="' + active + '" data-f="' + esc(t) + '">' + esc(t) + '</button>';
    })
    .join('');
  wrap.querySelectorAll('.rec-filter').forEach((b) => {
    b.addEventListener('click', () => {
      recordState.filter = b.dataset.f;
      track('record_filter', { filter: b.dataset.f });
      renderRecords();
    });
  });
}

function renderRecords() {
  const list = document.getElementById('recordList');
  renderFilters();
  updateSummary();
  const rows = recordState.filter === 'すべて'
    ? recordState.all
    : recordState.all.filter((r) => String(r.type || 'その他') === recordState.filter);
  list.innerHTML = rows
    .map((r) => {
      const stamped = stampedKeys.has(recordKey(r));
      return '<article class="record-card ' + (stamped ? 'stamped' : 'pending-stamp') + '" data-key="' + esc(recordKey(r)) + '">' +
        '<div class="rec-top"><p class="rec-car">' + esc(r.car) + '</p><p class="rec-date">' + esc(r.date) + '</p></div>' +
        '<div class="rec-data">' +
        '<span>総額 <b>' + Number(r.price || 0) + '</b>万円</span>' +
        '<span>納車 <b>' + Number(r.days || 0) + '</b>日</span>' +
        '<span>' + esc(r.area) + '</span></div>' +
        (r.comment ? '<p class="rec-comment">' + esc(r.comment) + '</p>' : '') +
        '<div class="stamp" aria-label="納車済">納車済</div>' +
        '</article>';
    })
    .join('');
  observeStamps();
}

/* ⑩ 納車済スタンプ: 到達時に scale1.4→1.0(200ms)・1実績1回のみ */
function observeStamps() {
  if (stampObserver) { stampObserver.disconnect(); stampObserver = null; }
  const cards = document.querySelectorAll('.record-card.pending-stamp');
  if (!FX || !('IntersectionObserver' in window)) {
    cards.forEach((c) => { c.classList.remove('pending-stamp'); c.classList.add('stamped'); });
    return;
  }
  stampObserver = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        setTimeout(() => en.target.classList.add('stamped'), 120);
        stampedKeys.add(en.target.dataset.key);
        stampObserver.unobserve(en.target);
      }
    });
  }, { threshold: 0.4 });
  cards.forEach((c) => stampObserver.observe(c));
}

/* ⑥ カウントアップ(Michroma・800ms・1回のみ) */
const counters = { visible: false, dataReady: false, done: false };
function updateSummary() {
  const n = recordState.all.length + CONFIG.RECORDS_BASE_COUNT;
  const avg = Math.round(recordState.all.reduce((a, r) => a + Number(r.days || 0), 0) / (recordState.all.length || 1));
  document.getElementById('sumCount').dataset.target = String(n);
  document.getElementById('sumDays').dataset.target = String(avg);
  document.getElementById('sumVenues').textContent = CONFIG.VENUES_LABEL;
  counters.dataReady = true;
  maybeCountUp();
}
(function watchSummary() {
  const el = document.getElementById('recordsSummary');
  if (!('IntersectionObserver' in window)) { counters.visible = true; maybeCountUp(); return; }
  const io = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      counters.visible = true;
      io.disconnect();
      maybeCountUp();
    }
  }, { threshold: 0.3 });
  io.observe(el);
})();
function maybeCountUp() {
  if (!counters.visible || !counters.dataReady || counters.done) return;
  counters.done = true;
  document.querySelectorAll('.countup').forEach((el) => {
    const target = Number(el.dataset.target || '0');
    if (!FX) { el.textContent = String(target); return; }
    const start = performance.now();
    const DUR = 800;
    function frame(now) {
      const p = Math.min(1, (now - start) / DUR);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    setTimeout(() => { el.textContent = String(target); }, DUR + 120); // rAF停止時の最終値保証
  });
}

loadRecords();

})();
