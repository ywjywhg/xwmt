const Parser = require('rss-parser');
const fetch = require('node-fetch');

const parser = new Parser();
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const SEND_MSG = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

const RSS_FEEDS = [
  'https://feeds.bbci.co.uk/news/world/rss.xml',
  'https://www.reuters.com/arc/outboundfeeds/newsroom/all/?outputType=xml',
  'https://afs.google.com/dp-apnews/index.rss',
  'https://www.theguardian.com/world/rss',
  'https://rss.cnn.com/rss/edition_world.rss'
];

async function translate(text) {
  try {
    const res = await fetch('https://libretranslate.de/translate', {
      method: 'POST',
      body: JSON.stringify({ q: text, source: 'en', target: 'zh', format: 'text' }),
      headers: { 'Content-Type': 'application/json' },
      timeout: 8000
    });
    const json = await res.json();
    return json.translatedText || text;
  } catch {
    return text;
  }
}

(async () => {
  if (!BOT_TOKEN || !CHAT_ID) return console.log('缺少密钥');

  // 先发一句开机报平安
  await fetch(SEND_MSG, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text: '早安！全球头条来啦，今天是 ' + new Date().toLocaleDateString('zh-CN') })
  });

  let sent = 0;
  for (const url of RSS_FEEDS) {
    try {
      const feed = await parser.parseURL(url);
      for (const item of feed.items.slice(0, 4)) {
        if (!item.title || !item.link) continue;

        const zh = await translate(item.title.trim());
        const text = `<b>${zh}</b>\n\n${item.contentSnippet ? item.contentSnippet.slice(0, 200) + '...' : ''}\n\n来源：${feed.title || '未知'}\n🔗 <a href="${item.link}">阅读原文</a>`;

        await fetch(SEND_MSG, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: CHAT_ID,
            text: text,
            parse_mode: 'HTML',
            disable_web_page_preview: false   // 自动带大图预览！
          })
        });

        sent++;
        if (sent >= 8) return;  // 每天最多 8 条，够用
        await new Promise(r => setTimeout(r, 4000));
      }
    } catch (e) {}
  }

  // 收尾
  await fetch(SEND_MSG, {
    method: 'POST',
    body: JSON.stringify({ chat_id: CHAT_ID, text: `今日共推送 ${sent} 条全球头条，祝你好心情` })
  });
})();
