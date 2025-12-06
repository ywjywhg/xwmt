const Parser = require('rss-parser');
const fetch = require('node-fetch');

const parser = new Parser();
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const SEND = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

// 终极稳翻译接口（已实测 2025.12 还能用）
async function translate(text) {
  if (!text) return '';
  try {
    const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh-CN`);
    const json = await res.json();
    return json.responseStatus === 200 ? json.responseData.translatedText : text;
  } catch {
    return text;
  }
}

const RSS = [
  'https://feeds.bbci.co.uk/news/world/rss.xml',
  'https://www.reuters.com/arc/outboundfeeds/newsroom/all/?outputType=xml',
  'https://afs.google.com/dp-apnews/index.rss',
  'https://www.theguardian.com/world/rss',
  'https://rss.cnn.com/rss/edition_world.rss'
];

(async () => {
  if (!BOT_TOKEN || !CHAT_ID) return console.log('密钥错');

  await fetch(SEND, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text: `早安！全球头条 · ${new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}` })
  });

  let count = 0;
  for (const url of RSS) {
    try {
      const feed = await parser.parseURL(url);
      for (const item of feed.items.slice(0, 6)) {
        if (!item.title || !item.link) continue;

        const zh = await translate(item.title.trim());

        const text = `<b>${zh}</b>\n\n${(item.contentSnippet || '').slice(0, 180).trim()}…\n\n来源：${feed.title?.split(' - ')[0].split('|')[0].trim()}\n🔗 <a href="${item.link}">阅读全文</a>`;

        await fetch(SEND, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: CHAT_ID,
            text,
            parse_mode: 'HTML',
            disable_web_page_preview: false
          })
        });

        count++;
        if (count >= 9) break;
        await new Promise(r => setTimeout(r, 4000));
      }
      if (count >= 9) break;
    } catch (e) {}
  }

  await fetch(SEND, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text: `今日精选 ${count} 条全球头条已送达\n祝你一天好心情！` })
  });
})();
