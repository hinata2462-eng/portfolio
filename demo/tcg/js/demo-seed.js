// demo-seed.js — ポートフォリオ公開用デモの見本データ(デモ版のみ)。
// 商品名・購入先・販売先・金額はすべて架空。日付は「今日」からの相対で作るため、いつ開いても直近3か月の記録に見える。
// データはアプリ本体と同じ形・同じ関数(lifecycle の状態遷移 / money の手数料計算)で組み立てる。
import { defaultState } from "./store.js";
import { applyProductTransition, applyLotteryTransition, PRODUCT_ACTION_LABELS, LOTTERY_ACTION_LABELS } from "./lifecycle.js";
import { realCost, realizedProfit, feeFromRate, fmt, fmtSigned } from "./money.js";

/** 見本データの販売先(架空)。手数料率は設定画面で変更できる。 */
export const DEMO_CHANNELS = [
  { name: "フリマアプリA", feeRate: 10 },
  { name: "オークションサイトB", feeRate: 8 },
  { name: "トレカ取引所C", feeRate: 6.6 },
  { name: "カードショップ買取", feeRate: 0 },
];

/** 商品・抽選が1件もなければ「空」とみなす(初回表示・全削除後の再読込で見本を入れる) */
export function isEmptyState(state) {
  return !state || ((state.products || []).length === 0 && (state.lotteries || []).length === 0);
}

/*
 * 商品の見本。日付は「何日前」で指定する。
 * ordered: 注文日(thisMonth:true は今月1日より前にしない=今月の仕入として必ず数える)
 * arrive: 注文から到着までの日数(0=店頭購入で登録時から保有中 / null=未着)
 * sale.payout: 売却から入金までの日数(null=未入金)
 */
const PRODUCTS = [
  {
    id: "prod_demo01", name: "サンプルTCG 拡張パック『星の海』1BOX", series: "サンプルTCG 第1弾",
    store: "見本ホビー 中央店", orderNumber: "MH-240118", ordered: 84, arrive: 3, listed: 74,
    purchase: { itemPrice: 5940 },
    sale: { daysAgo: 70, channel: "フリマアプリA", gross: 9800, shippingFee: 750, payout: 3 },
  },
  {
    id: "prod_demo02", name: "見本カード 特製デッキセット", series: "見本カード",
    store: "架空トイズ オンライン", orderNumber: "KT-0093321", ordered: 80, arrive: 4, listed: 60,
    purchase: { itemPrice: 4400, shippingFee: 660 },
    sale: { daysAgo: 55, channel: "オークションサイトB", gross: 7500, shippingFee: 520, payout: 2 },
  },
  {
    id: "prod_demo03", name: "サンプルTCG 『月影の迷宮』プロモカードセット", series: "サンプルTCG 第2弾",
    store: "デモカード 本店", ordered: 62, arrive: 0,
    purchase: { itemPrice: 2200 },
    sale: { daysAgo: 40, channel: "トレカ取引所C", gross: 6800, shippingFee: 180, payout: 4 },
  },
  {
    id: "prod_demo04", name: "デモTCG スターターデッキ『黎明の騎士団』", series: "デモTCG", quantity: 3,
    store: "サンプル書店 駅前店", ordered: 58, arrive: 0, note: "相場下落のため買取で手放した",
    purchase: { itemPrice: 4950, pointsUsed: 300 },
    sale: { daysAgo: 30, channel: "カードショップ買取", gross: 3900, payout: 0 },
  },
  {
    id: "prod_demo05", name: "サンプルTCG 拡張パック『風鳴りの丘』1BOX", series: "サンプルTCG 第3弾",
    store: "見本ホビー 中央店", orderNumber: "MH-240377", ordered: 45, arrive: 2, listed: 12,
    purchase: { itemPrice: 5940 },
    sale: { daysAgo: 6, channel: "フリマアプリA", gross: 8900, shippingFee: 750, payout: null },
  },
  {
    id: "prod_demo06", name: "見本カード 限定スリーブ＆ローダーセット", series: "見本カード",
    store: "架空トイズ オンライン", orderNumber: "KT-0101457", ordered: 25, arrive: 3,
    purchase: { itemPrice: 3300, shippingFee: 550 },
    sale: { daysAgo: 2, channel: "オークションサイトB", gross: 5200, shippingFee: 370, payout: null },
  },
  {
    id: "prod_demo07", name: "サンプルTCG 拡張パック『星の海』1BOX", series: "サンプルTCG 第1弾", quantity: 2,
    store: "サンプル書店 駅前店", ordered: 35, arrive: 0, storageLocation: "防湿庫A",
    purchase: { itemPrice: 11880 },
    market: { est: 18600, low: 17000, high: 19800, source: "フリマ成約 5件平均(架空)", daysAgo: 3 },
  },
  {
    id: "prod_demo08", name: "サンプルTCG 『月影の迷宮』1BOX", series: "サンプルTCG 第2弾",
    store: "デモカード 本店", ordered: 50, arrive: 0, storageLocation: "防湿庫A",
    purchase: { itemPrice: 6600 },
    market: { est: 5800, low: 5400, high: 6200, source: "ショップ買取価格(架空)", daysAgo: 9 },
  },
  {
    id: "prod_demo09", name: "デモTCG ハイクラスパック『硝子の王冠』1BOX", series: "デモTCG",
    store: "見本ゲームズ 北口店", ordered: 28, arrive: 0, listed: 5, note: "フリマアプリAに9,800円で出品中",
    purchase: { itemPrice: 7700 },
    market: { est: 9500, low: 8800, high: 9800, source: "フリマ成約 3件平均(架空)", daysAgo: 5 },
  },
  {
    id: "prod_demo10", name: "見本カード プレミアムコレクション『はじまりの灯』", series: "見本カード",
    store: "架空トイズ オンライン", orderNumber: "KT-0098804", ordered: 40, arrive: 5, listed: 8,
    purchase: { itemPrice: 8800, pointsUsed: 500 },
    market: { est: 12000, low: 11000, high: 13500, source: "オークション落札 4件(架空)", daysAgo: 4 },
  },
  {
    id: "prod_demo11", name: "サンプルTCG 鑑定済みシングル『星詠みの巫女』", series: "サンプルTCG 第1弾",
    store: "デモカード 本店", ordered: 70, arrive: 0, condition: "鑑定済み(見本)", storageLocation: "鑑定品ケース",
    purchase: { itemPrice: 12000, shippingFee: 500, gradingFee: 3000 },
    market: { est: 11500, low: 10500, high: 13000, source: "取引所C 直近成約(架空)", daysAgo: 7 },
  },
  {
    id: "prod_demo12", name: "デモTCG サプライ ストレージボックス(大)", series: "デモTCG",
    store: "見本ホビー 中央店", ordered: 15, arrive: 0, condition: "新品", storageLocation: "押入れ",
    purchase: { itemPrice: 1980 },
  },
  {
    id: "prod_demo13", name: "サンプルTCG 拡張パック『蒼穹の旅団』1BOX(予約)", series: "サンプルTCG 第4弾",
    store: "サンプル書店 駅前店", orderNumber: "SB-77120", ordered: 5, thisMonth: true, arrive: null,
    purchase: { itemPrice: 5940 }, unpaidDueInDays: 2, note: "発売日に店頭受取・後払い",
  },
  {
    id: "prod_demo14", name: "見本カード 特製デッキセット 第2弾", series: "見本カード",
    store: "架空トイズ オンライン", orderNumber: "KT-0104410", ordered: 3, thisMonth: true, arrive: null,
    purchase: { itemPrice: 4400, shippingFee: 660 },
    market: { est: 5500, source: "予約相場(架空)", daysAgo: 1 },
  },
  {
    id: "prod_demo15", name: "サンプルTCG 拡張パック『星の海』1BOX(抽選当選分)", series: "サンプルTCG 第1弾",
    store: "見本ホビー 中央店", orderNumber: "MH-240512", ordered: 1, thisMonth: true, arrive: null,
    lotteryId: "lot_demo06",
    purchase: { itemPrice: 5940 },
    market: { est: 9300, low: 8800, high: 9800, source: "フリマ成約 5件平均(架空)", daysAgo: 1 },
  },
  {
    id: "prod_demo16", name: "デモTCG 拡張パック『硝子の王冠』1BOX", series: "デモTCG",
    store: "見本ゲームズ 北口店", ordered: 8, thisMonth: true, arrive: 0, storageLocation: "防湿庫B",
    purchase: { itemPrice: 7700 }, unpaidDueInDays: 10, note: "後払い(月末締め)",
    market: { est: 8400, source: "フリマ成約 2件(架空)", daysAgo: 2 },
  },
  {
    id: "prod_demo17", name: "見本カード コレクターズファイル(限定版)", series: "見本カード",
    store: "デモカード 本店", orderNumber: "DC-5521", ordered: 20, arrive: null, cancelAfter: 2,
    purchase: { itemPrice: 3300 }, note: "入荷未定のため注文キャンセル",
  },
];

/*
 * 抽選の見本。deadline / result / purchaseBy は「今日から何日後」(負=過去)、時刻は HH:MM。
 * applied / decided / bought は「何日前」にその操作をしたか。
 */
const LOTTERIES = [
  {
    id: "lot_demo01", title: "デモTCG ハイクラスパック『硝子の王冠』再販抽選", productName: "デモTCG ハイクラスパック『硝子の王冠』1BOX",
    store: "見本ゲームズ 北口店", price: 7700, created: 3, deadline: [1, "23:59"], result: [4, "18:00"],
    eligibility: "会員登録が必要・店頭受取のみ", status: "興味あり",
  },
  {
    id: "lot_demo02", title: "見本カード プレミアムコレクション第2弾 抽選販売", productName: "見本カード プレミアムコレクション第2弾",
    store: "架空トイズ オンライン", price: 8800, created: 2, deadline: [6, "23:59"], result: [9, "12:00"],
    eligibility: "1人1点まで・過去の購入履歴が必要", status: "興味あり",
  },
  {
    id: "lot_demo03", title: "サンプルTCG 拡張パック『蒼穹の旅団』Web抽選", productName: "サンプルTCG 拡張パック『蒼穹の旅団』1BOX",
    store: "サンプル書店 駅前店", price: 5940, created: 9, applied: 8, deadline: [-3, "23:59"], result: [-1, "12:00"],
    status: "応募済み", note: "結果はメールで通知(見本)",
  },
  {
    id: "lot_demo04", title: "サンプルTCG 『月影の迷宮』記念セット 抽選", productName: "サンプルTCG 『月影の迷宮』記念セット",
    store: "デモカード 本店", price: 6600, created: 4, applied: 2, deadline: [3, "23:59"], result: [7, "18:00"],
    status: "応募済み",
  },
  {
    id: "lot_demo05", title: "デモTCG 限定コレクションBOX 抽選", productName: "デモTCG 限定コレクションBOX",
    store: "見本ゲームズ 北口店", price: 11000, created: 14, applied: 12, deadline: [-10, "23:59"], result: [-3, "12:00"],
    purchaseBy: [2, "20:00"], decided: 3, status: "当選", eligibility: "当選者は期限内に店頭で購入",
  },
  {
    id: "lot_demo06", title: "サンプルTCG 拡張パック『星の海』再販抽選", productName: "サンプルTCG 拡張パック『星の海』1BOX(抽選当選分)",
    store: "見本ホビー 中央店", price: 5940, created: 16, applied: 15, deadline: [-12, "23:59"], result: [-2, "12:00"],
    purchaseBy: [3, "20:00"], decided: 2, bought: "prod_demo15", status: "購入済み",
  },
  {
    id: "lot_demo07", title: "サンプルTCG 『星の海』発売記念 店頭抽選", productName: "サンプルTCG 拡張パック『星の海』1BOX",
    store: "サンプル書店 駅前店", price: 5940, created: 29, applied: 27, deadline: [-25, "20:00"], result: [-20, "12:00"],
    decided: 20, status: "落選",
  },
  {
    id: "lot_demo08", title: "見本カード プレミアムコレクション 抽選", productName: "見本カード プレミアムコレクション『はじまりの灯』",
    store: "架空トイズ オンライン", price: 8800, created: 50, applied: 49, deadline: [-45, "23:59"], result: [-41, "12:00"],
    decided: 41, status: "落選", note: "その後、通常販売で購入",
  },
];

/**
 * 見本データ入りの state を作る(純粋関数。localStorage には触れない)。
 * @param {Date} now 基準日時(通常は new Date())
 */
export function buildDemoState(now = new Date()) {
  const nowT = now.getTime();
  const MIN = 60 * 1000;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 10, 0).getTime();

  /**
   * n日前の hh:mm(ローカル)。未来になる場合は「今より少し前」に寄せる。
   * notBefore があればそれより前にしない(ただし現在時刻は超えない)。
   */
  const at = (daysAgo, hh = 20, mm = 0, notBefore = null) => {
    let t = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, hh, mm).getTime();
    t = Math.min(t, nowT - 15 * MIN);
    if (notBefore !== null && t < notBefore) t = Math.min(notBefore, nowT);
    return new Date(t);
  };
  const iso = (d) => d.toISOString();
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const ahead = ([days, hm]) => {
    const [hh, mm] = hm.split(":").map(Number);
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, hh, mm);
    return `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; // datetime-local 形式(アプリの入力欄と同じ)
  };

  const state = defaultState();
  const events = [];
  const log = (date, action, entityType, entityId, detail) =>
    events.push({ at: iso(date), actor: "user", action, entityType, entityId, detail });

  // 初期設定(オンボーディング済み・予算・販売先)
  const setupAt = at(92, 21, 0);
  Object.assign(state.settings, {
    mode: "detail",
    monthlyBudget: 30000,
    strictPayout: false,
    purpose: "投資・副業",
    mainTcg: "その他",
    onboarded: true,
    channels: DEMO_CHANNELS.map((c) => ({ ...c })),
  });
  log(setupAt, "onboarding", "settings", "onboarding", "初期設定を完了した");
  log(new Date(setupAt.getTime() + 2 * MIN), "budget", "settings", "budget", `月間予算を ${fmt(30000)} に設定した`);

  // ---- 商品 ----
  for (const s of PRODUCTS) {
    const purchase = {
      store: s.store,
      orderNumber: s.orderNumber || "",
      orderedAt: "",
      itemPrice: 0, shippingFee: 0, paymentFee: 0, gradingFee: 0, otherFee: 0, discount: 0, pointsUsed: 0,
      ...s.purchase,
      paymentStatus: s.unpaidDueInDays ? "unpaid" : "paid",
      paymentDueAt: null,
      paidAt: null,
    };
    const instore = s.arrive === 0;
    const createdD = at(s.ordered, instore ? 15 : 21, instore ? 30 : 10, s.thisMonth ? monthStart : null);
    purchase.orderedAt = ymd(createdD);
    if (s.unpaidDueInDays) purchase.paymentDueAt = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + s.unpaidDueInDays));
    else purchase.paidAt = iso(createdD);
    const cost = realCost(purchase);
    const firstStatus = instore ? "保有中" : "到着待ち";

    let p = {
      id: s.id,
      name: s.name, series: s.series || "", quantity: s.quantity || 1,
      status: firstStatus,
      condition: s.condition || "未開封", storageLocation: s.storageLocation || "", note: s.note || "",
      purchase, market: {}, sale: null,
      lotteryId: s.lotteryId || null,
      history: [{ at: iso(createdD), from: "(登録)", to: firstStatus, note: "" }],
      createdAt: iso(createdD), updatedAt: iso(createdD),
      receivedAt: instore ? iso(createdD) : null,
    };
    log(createdD, "create", "product", p.id, `${p.name} を登録した(${fmt(cost)})`);

    let last = createdD;
    const step = (to, date, note) => {
      const label = note !== undefined ? note : PRODUCT_ACTION_LABELS[`${p.status}>${to}`] || "";
      const from = p.status;
      p = applyProductTransition(p, to, label, iso(date));
      log(date, "transition", "product", p.id, `${p.name}: ${from} → ${to}`);
      last = date;
    };

    if (s.cancelAfter) step("キャンセル", at(s.ordered - s.cancelAfter, 11, 40));
    if (s.arrive) step("保有中", at(s.ordered - s.arrive, 18, 20));
    if (s.listed) step("出品中", at(s.listed, 22, 5));

    if (s.sale) {
      const soldD = at(s.sale.daysAgo, 21, 45);
      const ch = state.settings.channels.find((c) => c.name === s.sale.channel);
      const sale = {
        channel: s.sale.channel,
        soldAt: ymd(soldD),
        grossAmount: s.sale.gross,
        platformFee: feeFromRate(s.sale.gross, ch ? ch.feeRate : 0), // 売却登録フォームと同じ計算
        shippingFee: s.sale.shippingFee || 0,
        packingFee: s.sale.packingFee || 0,
        payoutFee: 0,
        otherFee: 0,
        paymentStatus: "pending",
        payoutAt: null,
      };
      // 売却登録フォームと同じ手順: sale を付けて「売却済み」へ遷移し、売却日は日付で持つ
      p = structuredClone(p);
      p.sale = sale;
      p = applyProductTransition(p, "売却済み", `${sale.channel}で売却`, iso(soldD));
      p.soldAt = sale.soldAt;
      log(soldD, "sale", "product", p.id, `${p.name} を売却登録した(利益 ${fmtSigned(realizedProfit(sale, purchase))})`);
      last = soldD;
      if (s.sale.payout !== null && s.sale.payout !== undefined) {
        const paidD = s.sale.payout === 0 ? new Date(soldD.getTime() + 5 * MIN) : at(s.sale.daysAgo - s.sale.payout, 12, 30);
        step("入金済み", paidD);
      }
    }

    if (s.market) {
      const md = at(s.market.daysAgo, 22, 10 + (state.products.length * 7) % 45, last.getTime());
      p.market = {
        estimatedValue: s.market.est,
        low: s.market.low ?? null,
        high: s.market.high ?? null,
        sourceNote: s.market.source || "",
        updatedAt: iso(md),
      };
      log(md, "estimate", "product", p.id, `${p.name} の相場を ${fmt(s.market.est)} に更新した`);
      if (md > last) last = md;
    }
    p.updatedAt = iso(last);
    state.products.push(p);
  }

  // ---- 抽選 ----
  for (const s of LOTTERIES) {
    const createdD = at(s.created, 12, 15);
    let l = {
      id: s.id, title: s.title,
      productName: s.productName || "", store: s.store || "",
      price: s.price ?? null,
      applicationDeadline: s.deadline ? ahead(s.deadline) : null,
      resultDate: s.result ? ahead(s.result) : null,
      purchaseDeadline: s.purchaseBy ? ahead(s.purchaseBy) : null,
      url: "", // デモでは外部リンクを持たない
      eligibility: s.eligibility || "", note: s.note || "",
      status: "興味あり",
      history: [{ at: iso(createdD), from: "(登録)", to: "興味あり", note: "" }],
      createdAt: iso(createdD), updatedAt: iso(createdD),
    };
    log(createdD, "create", "lottery", l.id, `抽選 ${l.title} を登録した`);

    // アプリと同じ履歴メモ: 応募は空、当落は操作ラベル、購入は「当選購入」
    const lstep = (to, date, action, detail, note) => {
      const from = l.status;
      const label = note !== undefined ? note : LOTTERY_ACTION_LABELS[`${from}>${to}`] || "";
      l = applyLotteryTransition(l, to, label, iso(date));
      log(date, action, "lottery", l.id, detail || `${l.title}: ${from} → ${to}`);
    };

    if (s.applied !== undefined) lstep("応募済み", at(s.applied, 22, 40), "lottery-applied", `${s.title} に応募した`, "");
    if (["当選", "落選", "購入済み"].includes(s.status)) {
      lstep(s.status === "落選" ? "落選" : "当選", at(s.decided, 12, 20), "lottery-transition");
    }
    if (s.status === "購入済み") {
      const prod = state.products.find((x) => x.id === s.bought);
      const boughtD = new Date(Math.min(new Date(prod.createdAt).getTime() + MIN, nowT));
      lstep("購入済み", boughtD, "lottery-purchase", `${s.title} の当選分を購入登録した`, "当選購入");
    }
    state.lotteries.push(l);
  }

  // 監査ログは時系列順(ホームの「最近の変化」と設定の変更履歴に表示される)
  events.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  state.auditLog = events.slice(-500);
  return state;
}
