// デモ版の共通設定: 見本の人物（架空）と、設定ページとの受け渡しに使う保存キー。
// 実在の人物・住所・電話番号ではありません。
window.ONETAP_DEMO = {
  STORE: 'demo-onetap-profile',
  SAMPLE: {
    P: {
      sei: '見本', mei: '花子', seiKana: 'みほん', meiKana: 'はなこ',
      birth: '1990-05-15', gender: 'f',
      tel: '000-0000-0000', email: 'sample@example.com',
      zip: '000-0000', pref: '見本県', city: '見本市', street: '見本町1-2-3', bldg: '見本ハイツ101'
    },
    O: { agree: true, sep: '　' }
  },
  /** 設定ページで保存した内容。なければ見本の人物。 */
  load: function () {
    try {
      var d = JSON.parse(localStorage.getItem(this.STORE) || 'null');
      if (d && d.P) return d;
    } catch (e) {}
    return JSON.parse(JSON.stringify(this.SAMPLE));
  }
};
