const Parser = require('rss-parser');
const fetch = require('node-fetch');
const axios = require('axios');

const parser = new Parser();

const RSS_FEEDS = [
  { name: 'BBC', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { name: 'Reuters', url: 'https://www.reuters.com/arc/outboundfeeds/newsroom/all/?outputType=xml' },
  { name: 'AP News', url: 'https://afs.google.com/dp-apnews/index.rss' },
  { name: 'Guardian', url: 'https://www.theguardian.com/world/rss' },
  { name: 'CNN', url: 'https://rss.cnn.com/rss/edition_world.rss' }
];

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`;

async function translate(text) {
  if (!text) return '';
  try {
    const res = await axios.post('https://libretranslate.de/translate', {
      q: text,
      source: 'en',
      target: 'zh',
      format: 'text'
    });
    return res.data.translatedText;
  } catch {
    return text;
  }
}

async function send(photo, caption) {
  await fetch(TELEGRAM_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, photo, caption, parse_mode: 'HTML' })
  });
}

(async () => {
  let news = [];
  for (const f of RSS_FEEDS) {
    try {
      const feed = await parser.parseURL(f.url);
      for (const item of feed.items.slice(0, 4)) {
        const img = item.enclosure?.url || item['media:content']?.$.url || item['media:thumbnail']?.$.url;
        if (img && item.title) {
          news.push({ title: item.title, link: item.link, img, source: f.name });
        }
      }
    } catch (e) {}
  }

  for (const n of news.slice(0, 6)) {
    const zh = await translate(n.title);
    const caption = `<b>${zh}</b>\n来源：${n.source}\n🔗 ${n.link}`;
    await send(n.img, caption);
    await new Promise(r => setTimeout(r, 3000)); // 防风控
  }
})();
