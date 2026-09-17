// test_double_buffer_prefetch.js
// 2重バッファ先読み（常に2件先まで先行生成）の動作シミュレーションテスト

const assert = require('assert');

// モック環境の構築
const preloadedNewsMap = new Map();
const consumedNewsTitles = new Set();
const fetchLog = [];
let prefetchCallCount = 0;

function executeNewsPrefetch(item, isFirst, isCategoryChanged) {
  prefetchCallCount++;
  fetchLog.push({ action: 'PREFETCH', title: item.title, order: prefetchCallCount });
  const promise = Promise.resolve({ status: 'ok', title: item.title, items: [{ display: item.title, speech: item.title }] });
  preloadedNewsMap.set(item.title, { promise, abort: () => {} });
  return promise;
}

function triggerNewsPrefetch(item, isFirst = false, isCategoryChanged = false) {
  if (!item || !item.title) return;
  if (preloadedNewsMap.size >= 4) return;
  if (!preloadedNewsMap.has(item.title) && !consumedNewsTitles.has(item.title)) {
    executeNewsPrefetch(item, isFirst, isCategoryChanged);
  }
}

// 模擬記事データ（10件）
const sortedNews = Array.from({ length: 10 }, (_, i) => ({
  title: `記事 #${i + 1} のニュース`,
  categoryKey: i < 5 ? 'cat_top' : 'cat_tech',
  categoryName: i < 5 ? '主要' : 'IT'
}));

async function runSimulation() {
  console.log('🧪 === 2重バッファ先読みシミュレーション開始 ===');

  const startIndex = 0;

  // 1. 放送開始直前のトリガー（#1, #2, #3）
  console.log('\n--- 1. 放送開始前の先行トリガー ---');
  if (startIndex < sortedNews.length) triggerNewsPrefetch(sortedNews[startIndex], true, false);
  if (startIndex + 1 < sortedNews.length) triggerNewsPrefetch(sortedNews[startIndex + 1], false, false);
  if (startIndex + 2 < sortedNews.length) triggerNewsPrefetch(sortedNews[startIndex + 2], false, false);

  assert.strictEqual(preloadedNewsMap.size, 3, '開始前に3件プールされていること');
  assert.ok(preloadedNewsMap.has(sortedNews[0].title), '#1がプールされていること');
  assert.ok(preloadedNewsMap.has(sortedNews[1].title), '#2がプールされていること');
  assert.ok(preloadedNewsMap.has(sortedNews[2].title), '#3がプールされていること');
  console.log('✅ 開始前プール確認: #1, #2, #3 が正常に登録されました');

  // 2. 記事ループのシミュレーション
  const playbackHistory = [];

  for (let i = startIndex; i < sortedNews.length; i++) {
    const item = sortedNews[i];
    const nextItem = (i + 1 < sortedNews.length) ? sortedNews[i + 1] : null;
    const nextNextItem = (i + 2 < sortedNews.length) ? sortedNews[i + 2] : null;

    console.log(`\n--- 記事ループ #${i + 1}: 「${item.title}」 ---`);

    // キャッシュからの取り出し（readOneNewsItem の冒頭）
    let data = null;
    let fromCache = false;
    if (preloadedNewsMap.has(item.title)) {
      fromCache = true;
      const cached = preloadedNewsMap.get(item.title);
      consumedNewsTitles.add(item.title);
      preloadedNewsMap.delete(item.title);
      data = await cached.promise;
    } else {
      // キャッシュにない場合（通常フェッチ）
      data = { status: 'ok', title: item.title };
      consumedNewsTitles.add(item.title);
    }

    assert.ok(data, 'データが正常に取得できること');
    assert.strictEqual(data.title, item.title, 'タイトルが一致すること（順序の狂いなし）');
    assert.ok(fromCache, `記事 #${i + 1} は先読みキャッシュから即時再生されること`);
    playbackHistory.push(item.title);

    // 記事発話中の先読みトリガー（2重バッファ: nextItem & nextNextItem）
    if (nextItem) triggerNewsPrefetch(nextItem, false, false);
    if (nextNextItem) triggerNewsPrefetch(nextNextItem, false, false);

    console.log(`  再生中: ${item.title}`);
    console.log(`  現在のプール数: ${preloadedNewsMap.size} (保持中: ${Array.from(preloadedNewsMap.keys()).map(k => k.split(' ')[0]).join(', ')})`);

    // 未再生の記事がまだ2件以上残っている場合、常に2件がプールに補充されているはず
    const remaining = sortedNews.length - 1 - i;
    if (remaining >= 2) {
      assert.strictEqual(preloadedNewsMap.size, 2, `記事 #${i + 1} の読み上げ中、常に2件先までバッファされていること`);
      assert.ok(preloadedNewsMap.has(nextItem.title), `次記事 #${i + 2} がプールされていること`);
      assert.ok(preloadedNewsMap.has(nextNextItem.title), `次々記事 #${i + 3} がプールされていること`);
    } else if (remaining === 1) {
      assert.strictEqual(preloadedNewsMap.size, 1, `残り1件の場合、1件がプールされていること`);
      assert.ok(preloadedNewsMap.has(nextItem.title), `ラスト記事がプールされていること`);
    } else {
      assert.strictEqual(preloadedNewsMap.size, 0, `最終記事ではプールが空になること`);
    }
  }

  // 3. 全体結果の検証
  console.log('\n--- 3. 総合整合性チェック ---');
  assert.strictEqual(playbackHistory.length, 10, '全10件が読み上げられたこと');
  for (let i = 0; i < 10; i++) {
    assert.strictEqual(playbackHistory[i], sortedNews[i].title, `再生順序が100%一致すること (#${i + 1})`);
  }
  assert.strictEqual(consumedNewsTitles.size, 10, '全10件が既読としてマークされていること');
  assert.strictEqual(prefetchCallCount, 10, '重複フェッチがなく、ちょうど10件のみフェッチされたこと');

  console.log('🎉 【全テスト合格】2重バッファにより、全記事が100%先読みキャッシュから即時再生され、順序の狂い・重複フェッチ・漏れがゼロであることを確認しました！');
}

runSimulation().catch(err => {
  console.error('❌ テスト失敗:', err);
  process.exit(1);
});
