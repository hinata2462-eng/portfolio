/* ═══════════════════════════════════════════════════════════
   SAMPLE MOTORS — showroom.js
   横回転リング+ターンテーブルの車入れ替え。
   診断・依頼票・LINE・実績・計測は classic 版(main.js)から移植。
   ═══════════════════════════════════════════════════════════ */
(function () {
'use strict';

/* ─── 設定(公開前にここを実データへ差し替え) ─── */
const CONFIG = {
  LINE_ID: '@sample_motors',      // TODO: LINE公式アカウントのベーシックID(@込み)
  GA4_ID: '',                     // TODO: 'G-XXXXXXXXXX'(空なら計測はconsole出力のみ)
  RECORDS_API_URL: '',            // TODO: GASデプロイURL(空なら内蔵サンプル表示)
  TEL: '0276-00-0000',            // TODO: 固定電話(表示・発信ともこの値を使用)
  BUSINESS_HOURS: { open: 10, close: 19 },
  VENUES_LABEL: '50+',            // TODO: 実際に入札可能な会場数を確認して差し替え
  RECORDS_BASE_COUNT: 0,
};

const html = document.documentElement;
const FX = html.classList.contains('fx');

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
function safeGet(key) { try { return sessionStorage.getItem(key); } catch (e) { return null; } }
function safeSet(key, val) { try { sessionStorage.setItem(key, val); } catch (e) { /* noop */ } }

/* ═══ 計測 ═══ */
function track(name, params) {
  if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
  else console.debug('[GA4]', name, params || {});
}
if (CONFIG.GA4_ID) {
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + CONFIG.GA4_ID;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', CONFIG.GA4_ID, { transport_type: 'beacon' });
}

/* ═══ LINE導線(本文プリセット・2タップ) ═══ */
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
document.querySelectorAll('a.js-tel').forEach((a) => {
  a.href = 'tel:' + CONFIG.TEL.replace(/-/g, '');
  if (/\d{2,4}-/.test(a.textContent)) a.textContent = CONFIG.TEL;
  a.addEventListener('click', () => track('tel_tap', { source: 'trust' }));
});

/* ═══ 追従バーTEL: クリック時点の営業時間で判定 ═══ */
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
      label.textContent = '電話する'; ico.textContent = '☎';
      btn.href = 'tel:' + CONFIG.TEL.replace(/-/g, '');
    } else {
      label.textContent = 'LINEなら24時間'; ico.textContent = '✉';
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
  setInterval(refresh, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
})();

/* ═══════════════════════════════════════════════════════════
   回転リング(ショールームの核)
   ═══════════════════════════════════════════════════════════ */
const ring = document.getElementById('ring');
const FACES = [...document.querySelectorAll('.face')];
const N = FACES.length;
const STEP_DEG = 360 / N;
const carImg = document.getElementById('carImg');
const carName = document.getElementById('carName');
const tabs = [...document.querySelectorAll('.tab')];
const FACE_NAMES = ['top', 'system', 'quiz', 'records', 'menu', 'company'];
const QUIZ_FACE = 2;

let cur = 0;        // 現在の面(0..N-1)
let turn = 0;       // 累積回転数(常に近い方向へ回すため)
let R = 400;

function layout() {
  /* コンテンツ面は重ね置き(3Dリング配置は廃止: 回るのはスタジオ背景側) */
}

/* ═══ 背景スタジオのクロスフェード(セクションと連動) ═══ */
const bgA = document.getElementById('bgA');
const bgB = document.getElementById('bgB');
const bgVeil = document.getElementById('bgVeil');
const BRIGHT_BGS = new Set(['studio-white']); // 明るい背景はベールを強める
let bgFront = null;
let bgCurrent = '';
/* dir: +1=次ページ(部屋が左へ回る) / -1=前ページ / 0=初期表示(回転なし) */
const SWING_CLASSES = ['swing-in-r', 'swing-in-l', 'swing-out-l', 'swing-out-r'];
function setBg(name, dir) {
  if (!bgA || !bgB) return;
  if (name === bgCurrent && !dir) return;
  bgCurrent = name;
  const next = bgFront === bgA ? bgB : bgA;
  next.querySelector('.bg-pan').style.backgroundImage = 'url(assets/' + name + '.jpg?d=3)'; // ?d=キャッシュ更新用
  next.classList.remove('show', ...SWING_CLASSES);
  void next.offsetWidth; // アニメを毎回リスタートさせる
  if (dir && FX) next.classList.add(dir > 0 ? 'swing-in-r' : 'swing-in-l'); // 次ページは右から回り込む
  next.classList.add('show');
  if (bgFront && bgFront !== next) {
    const out = bgFront;
    out.classList.remove('show', ...SWING_CLASSES);
    if (dir && FX) {
      void out.offsetWidth;
      out.classList.add(dir > 0 ? 'swing-out-l' : 'swing-out-r'); // 現スタジオは反対側へ回り出る
      setTimeout(() => out.classList.remove(...SWING_CLASSES), 900);
    }
  }
  bgFront = next;
  bgVeil.classList.toggle('bright', BRIGHT_BGS.has(name));
}

/* ═══ 3Dモデル(GLB)の自動検出: assets/models/<car>.glb があれば本物の3D表示 ═══ */
const carHolder = document.getElementById('carHolder');
const carMv = document.getElementById('carMv');
const MODEL_OK = {}; // car名 -> GLBの有無
let mvLibLoaded = false;

function applyCarMedia(face) {
  const n = face.dataset.car;
  if (MODEL_OK[n] && mvLibLoaded) {
    if (carMv.getAttribute('src') !== 'assets/models/' + n + '.glb') {
      carMv.setAttribute('src', 'assets/models/' + n + '.glb');
    }
    carMv.hidden = false;
    carImg.hidden = true;
  } else {
    carMv.hidden = true;
    carImg.hidden = false;
  }
}
(function checkModels() {
  const names = [...new Set(FACES.map((f) => f.dataset.car))];
  Promise.all(names.map((n) =>
    fetch('assets/models/' + n + '.glb', { method: 'HEAD', cache: 'no-store' })
      .then((res) => { MODEL_OK[n] = res.ok; })
      .catch(() => { MODEL_OK[n] = false; })
  )).then(() => {
    if (!Object.values(MODEL_OK).some(Boolean)) return; // GLBなし: ライブラリも読まない
    // 車は床に据え置き(自動回転なし)。ドラッグでの手動回転のみ許可
    carMv.addEventListener('error', () => { // 壊れたGLBは画像へフォールバック
      MODEL_OK[FACES[cur].dataset.car] = false;
      applyCarMedia(FACES[cur]);
    });
    const s = document.createElement('script');
    s.type = 'module';
    s.src = 'https://cdn.jsdelivr.net/npm/@google/model-viewer@4/dist/model-viewer.min.js';
    s.onload = () => { mvLibLoaded = true; applyCarMedia(FACES[cur]); };
    document.head.appendChild(s);
  });
})();

let carTimer = null;
function swapCar(face) {
  const src = 'assets/cars/' + face.dataset.car + '.png';
  const name = face.dataset.carname || '';
  if (carImg.getAttribute('src').endsWith(face.dataset.car + '.png')) return;
  if (FX && !document.hidden) {
    carHolder.classList.remove('swap');
    void carHolder.offsetWidth; // アニメ再スタート
    carHolder.classList.add('swap');
    clearTimeout(carTimer);
    carTimer = setTimeout(() => { // フェードで消えている間に車種を入れ替え
      carImg.src = src;
      carName.textContent = name;
      applyCarMedia(face);
    }, 350);
  } else {
    carImg.src = src;
    carName.textContent = name;
    applyCarMedia(face);
  }
}
carHolder.addEventListener('animationend', (e) => {
  if (e.animationName === 'car-fade') carHolder.classList.remove('swap'); // アイドル浮遊へ復帰
});

const FACE_ANIM = ['enter-l', 'enter-r', 'leave-l', 'leave-r'];
function go(i, via) {
  const next = ((i % N) + N) % N;
  if (next === cur && via !== 'init') return;
  closeSheet('rotate');
  // 回転方向: 常に近い方へ
  let delta = next - cur;
  if (delta > N / 2) delta -= N;
  if (delta < -N / 2) delta += N;
  const prev = cur;
  cur = next;
  // 文字: 現ページは横へ抜け、次ページは反対側からフェードイン
  FACES.forEach((f, idx) => {
    if (idx !== prev && idx !== cur) f.classList.remove('active', ...FACE_ANIM);
  });
  const outF = FACES[prev];
  const inF = FACES[cur];
  if (via !== 'init' && FX && prev !== cur) {
    outF.classList.remove('active', ...FACE_ANIM);
    inF.classList.remove(...FACE_ANIM);
    void outF.offsetWidth;
    outF.classList.add(delta > 0 ? 'leave-r' : 'leave-l');      // 次へ: 右へ抜ける
    inF.classList.add('active', delta > 0 ? 'enter-l' : 'enter-r'); // 次は左からフェードイン
    setTimeout(() => {
      outF.classList.remove(...FACE_ANIM);
      inF.classList.remove(...FACE_ANIM);
    }, 850);
  } else {
    FACES.forEach((f, idx) => f.classList.toggle('active', idx === cur));
    if (via === 'init' && FX) { // 初回表示もゆっくりフェードイン
      inF.classList.add('enter-l');
      setTimeout(() => inF.classList.remove('enter-l'), 1700);
    }
  }
  tabs.forEach((t, idx) => t.classList.toggle('active', idx === cur));
  const activeTab = tabs[cur];
  if (activeTab && activeTab.scrollIntoView) activeTab.scrollIntoView({ block: 'nearest', inline: 'center', behavior: FX ? 'smooth' : 'auto' });
  swapCar(FACES[cur]);
  setBg(FACES[cur].dataset.bg || 'studio', via === 'init' ? 0 : Math.sign(delta));
  if (via !== 'init') track('face_change', { to: FACE_NAMES[cur], via: via });
  if (cur === 3) { counters.visible = true; maybeCountUp(); } // 実績面に到達したらカウントアップ
}

/* ═══ 詳細シート ═══ */
const sheet = document.getElementById('sheet');
const sheetBackdrop = document.getElementById('sheetBackdrop');
const sheetBody = document.getElementById('sheetBody');
const sheetPages = [...document.querySelectorAll('.sheet-page')];
let sheetOpenPage = null;
let firedQuizReach = false;

function openSheet(page) {
  sheetPages.forEach((p) => { p.hidden = p.dataset.page !== page; });
  sheetBody.scrollTop = 0;
  sheet.hidden = false;
  sheetBackdrop.hidden = false;
  requestAnimationFrame(() => {
    sheet.classList.add('open');
    sheetBackdrop.classList.add('open');
  });
  // rAF停止環境の保険
  setTimeout(() => { sheet.classList.add('open'); sheetBackdrop.classList.add('open'); }, 60);
  if (sheetOpenPage !== page) track('sheet_open', { page: page });
  sheetOpenPage = page;
  if (page === 'quiz' && !firedQuizReach) { // §7「設問到達」: 診断シートの表示で quiz_q1
    firedQuizReach = true;
    if (!quiz.reached.has(1)) { quiz.reached.add(1); track('quiz_q1', {}); }
  }
}
function closeSheet(via) {
  if (!sheetOpenPage) return;
  sheetOpenPage = null;
  sheet.classList.remove('open');
  sheetBackdrop.classList.remove('open');
  setTimeout(() => {
    if (!sheetOpenPage) { sheet.hidden = true; sheetBackdrop.hidden = true; }
  }, FX ? 460 : 0);
}
document.getElementById('sheetClose').addEventListener('click', () => closeSheet('button'));
sheetBackdrop.addEventListener('click', () => closeSheet('backdrop'));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSheet('esc');
});
document.querySelectorAll('.js-open-sheet').forEach((b) =>
  b.addEventListener('click', () => openSheet(b.dataset.sheet))
);
document.querySelectorAll('.js-open-quiz').forEach((b) =>
  b.addEventListener('click', () => {
    const already = cur === QUIZ_FACE;
    go(QUIZ_FACE, 'cta');
    setTimeout(() => openSheet('quiz'), already ? 0 : 480); // 回転を見せてから開く
  })
);

tabs.forEach((t) => t.addEventListener('click', () => go(Number(t.dataset.go), 'tab')));
document.getElementById('navPrev').addEventListener('click', () => go(cur - 1, 'arrow'));
document.getElementById('navNext').addEventListener('click', () => go(cur + 1, 'arrow'));
document.addEventListener('keydown', (e) => {
  if (sheetOpenPage) return;
  if (e.key === 'ArrowLeft') go(cur - 1, 'key');
  if (e.key === 'ArrowRight') go(cur + 1, 'key');
});

/* スワイプ: 横=回転、縦=回転(シート・タブ・ドック・3Dビューア上のジェスチャは除外) */
(function swipe() {
  let sx = 0, sy = 0, tracking = false;
  const ignore = (t) => t && t.closest &&
    (t.closest('.sheet') || t.closest('.tabs') || t.closest('.dock') ||
     t.closest('model-viewer') || t.closest('.edge-nav'));
  document.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || ignore(e.target)) { tracking = false; return; }
    sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    tracking = true;
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (!tracking) return;
    tracking = false;
    if (sheetOpenPage) return;
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 52 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      go(cur + (dx < 0 ? 1 : -1), 'swipe');
    } else if (Math.abs(dy) > 56 && Math.abs(dy) > Math.abs(dx) * 1.2) {
      go(cur + (dy < 0 ? 1 : -1), 'swipe_v'); // 上スワイプ=次へ
    }
  }, { passive: true });
})();

/* ホイールスクロールでも回転(1ジェスチャ=1面。慣性の連続deltaはロックで吸収) */
(function wheelSpin() {
  let acc = 0;
  let locked = false;
  const bootAt = performance.now(); // 直前ページからの慣性ホイール流れ込み対策
  window.addEventListener('wheel', (e) => {
    if (sheetOpenPage) return; // シート内は通常スクロール
    e.preventDefault();
    if (locked || performance.now() - bootAt < 1000) return;
    acc += (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY);
    if (Math.abs(acc) > 90) {
      go(cur + (acc > 0 ? 1 : -1), 'wheel');
      acc = 0;
      locked = true;
      setTimeout(() => { locked = false; }, 750);
    }
  }, { passive: false });
})();

window.addEventListener('resize', layout);
layout();
setBg(FACES[0].dataset.bg || 'studio', 0);
go(0, 'init');
FACES[0].classList.add('active');

/* 残りの車画像・背景を先読み(初回切替でのちらつき防止) */
window.addEventListener('load', () => {
  setTimeout(() => {
    FACES.forEach((f) => {
      const im = new Image(); im.src = 'assets/cars/' + f.dataset.car + '.png';
      const bg = new Image(); bg.src = 'assets/' + (f.dataset.bg || 'studio') + '.jpg?d=3';
    });
  }, 800);
});

/* ═══════════════════════════════════════════════════════════
   30秒診断(classic版から移植・IDそのまま)
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
function yen(n) { return '¥' + n.toLocaleString('ja-JP'); }

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
  idx: 0, answers: {}, started: false, reached: new Set(),
  slipNo: '', locked: false, completing: false, sellTracked: false, retries: 0,
};

const quizBody = document.getElementById('quizBody');
const quizBack = document.getElementById('quizBack');
const quizPartial = document.getElementById('quizPartial');
const tacho = document.getElementById('tacho');
const tachoNeedle = document.getElementById('tachoNeedle');
const tachoCount = document.getElementById('tachoCount');

(function tachoTicks() {
  const g = document.getElementById('tachoTicks');
  if (!g) return;
  let s = '';
  for (let i = 0; i <= 7; i++) {
    const a = (i / 7) * Math.PI;
    const x1 = 100 - 68 * Math.cos(a), y1 = 110 - 68 * Math.sin(a);
    const x2 = 100 - 76 * Math.cos(a), y2 = 110 - 76 * Math.sin(a);
    s += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '"/>';
  }
  g.innerHTML = s;
})();

function setNeedle(count) {
  tachoNeedle.style.setProperty('--deg', (count / 7) * 180 + 'deg');
  tachoCount.textContent = String(count);
  tacho.classList.toggle('redzone', count >= 6);
}
function answeredCount() { return Object.keys(quiz.answers).length; }

function renderQuestion(moveFocus) {
  const qd = QUESTIONS[quiz.idx];
  const n = quiz.idx + 1;
  quiz.locked = false;
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
      if (quiz.locked) return;
      quiz.locked = true;
      if (!quiz.started) {
        quiz.started = true;
        if (!quiz.reached.has(1)) { quiz.reached.add(1); track('quiz_q1', {}); }
        track('quiz_start', {});
      }
      quiz.answers[qd.key] = btn.dataset.val;
      if (qd.key === 'current' && btn.dataset.val === '売却・下取りも相談したい' && !quiz.sellTracked) {
        quiz.sellTracked = true;
        track('sell_tap', { source: 'quiz_q7' });
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
  if (moveFocus) {
    const qEl = document.getElementById('quizQ');
    if (qEl) qEl.focus({ preventScroll: true });
  }
}

quizBack.addEventListener('click', () => {
  if (quiz.idx > 0) { quiz.idx--; renderQuestion(true); }
});
quizPartial.addEventListener('click', () => {
  track('quiz_partial_consult', { answered: answeredCount() });
  const text = answeredCount() > 0 ? buildSlipText(quiz.answers, null, true) : GENERIC_CONSULT_TEXT;
  openLine(text, 'quiz_partial');
});

function completeQuiz() {
  if (quiz.completing) return;
  quiz.completing = true;
  setNeedle(7);
  track('slip_issued', { retry: quiz.retries });
  quiz.slipNo = makeSlipNo();
  setTimeout(showSlip, FX ? 500 : 0);
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
  document.getElementById('slipStatus').textContent = '依頼票を発行しました。内容を確認して、LINEでそのまま送信できます。';
  setTimeout(() => {
    slip.classList.add('ejected');
    slip.focus({ preventScroll: true });
    setTimeout(() => {
      scramble(document.getElementById('slipNo'), quiz.slipNo);
      scramble(document.getElementById('slipTotal'), totalText);
    }, FX ? 500 : 0);
  }, 30);
  area.scrollIntoView({ behavior: FX ? 'smooth' : 'auto', block: 'nearest' });
  document.getElementById('slipLineBtn').onclick = (e) => {
    e.preventDefault();
    openLine(buildSlipText(quiz.answers, quiz.slipNo, false), 'slip');
  };
  document.getElementById('slipCopyBtn').onclick = () => {
    copyText(buildSlipText(quiz.answers, quiz.slipNo, false));
  };
  document.getElementById('quizRetry').onclick = () => {
    quiz.idx = 0;
    quiz.retries++;
    quiz.completing = false;
    slip.classList.remove('ejected');
    area.hidden = true;
    document.getElementById('slipStatus').textContent = '';
    document.getElementById('quizPanel').hidden = false;
    setNeedle(answeredCount());
    renderQuestion(true);
  };
}

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
  setTimeout(() => { el.textContent = finalText; }, DUR + 120);
}

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
   納車実績(classic版から移植)
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
const stampedKeys = new Set();
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
    showRecordsNote('※現在は表示サンプルです(実績データ準備中)');
    renderRecords();
    return;
  }
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
/* カウントアップの発火は実績面(face 3)到達時にgo()から行う(3D回転中のIO誤発火を避ける) */
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
    setTimeout(() => { el.textContent = String(target); }, DUR + 120);
  });
}

loadRecords();

})();
