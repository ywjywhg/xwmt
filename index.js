const Parser = require('rss-parser');
const fetch = require('node-fetch');
const axios = require('axios');

const parser = new Parser();
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`;
const SEND_MESSAGE_API = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

const RSS_FEEDS = [
  { name: 'BBC',      url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { name: 'Reuters',  url: 'https://www.reuters.com/arc/outboundfeeds/newsroom/all/?outputType=xml' },
  { name: 'AP News',  url: 'https://afs.google.com/dp-apnews/index.rss' },
  { name: 'Guardian', url: 'https://www.theguardian.com/world/rss' },
  { name: 'CNN',      url: 'https://rss.cnn.com/rss/edition_world.rss' }
];

async function log(text) {
  console.log(`[${new Date().toISOString()}] ${text}`);
}

// 翻译
async function translate(text) {
  if (!text) return '';
  try {
    const res = await axios.post('https://libretranslate.de/translate', {
      q: text, source: 'en', target: 'zh', format: 'text'
    }, { timeout: 8000 });
    return res.data.translatedText || text;
  } catch (e) {
    log('翻译失败，使用原文');
    return text;
  }
}

// 先用 sendMessage 试试 bot 能不能说话
async function testBot() {
  try {
    const res = await fetch(SEND_MESSAGE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text: '新闻机器人已启动，正在抓取…' })
    });
    const json = await res.json();
    log(`Bot 测试消息结果: ${json.ok ? '成功' : JSON.stringify(json)}`);
  } catch (e) {
    log('Bot 测试消息都发不出去！检查 BOT_TOKEN 和 CHAT_ID');
  }
}

// 发送图片（失败就改发文字）
async function sendNews(photo, caption) {
  try {
    const res = await fetch(TELEGRAM_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, photo, caption, parse_mode: 'HTML' })
    });
    const json = await res.json();
    if (json.ok) {
      log('成功发送图片消息');
    } else {
      log(`图片发送失败: ${JSON.stringify(json)} → 改用文字`);
      await fetch(SEND_MESSAGE_API, {
        method: 'POST',
        body: JSON.stringify({ chat_id: CHAT_ID, text: caption, parse_mode: 'HTML', disable_web_page_preview: true })
      });
    }
  } catch (e) {
    log('图片完全发不了，改发文字');
  }
}

(async () => {
  if (!BOT_TOKEN || !CHAT_ID) {
    log('BOT_TOKEN 或 CHAT_ID 为空！去 Settings → Secrets 检查');
    return;
  }

  await testBot();                    // ← 关键！先发一句确认 bot 活着

  let collected = [];

  for (const f of RSS_FEEDS) {
    try {
      log(`正在抓取 ${f.name}`);
      const feed = await parser.parseURL(f.url);
      for (const item of feed.items.slice(0, 5)) {
        let img = item.enclosure?.url ||
                  item['media:content']?.['@']?.url ||
                  item['media:thumbnail']?.['@']?.url ||
                  (item.content?.match(/src=["'](.*?)["']/) || [])[1];

        if (img && item.title) {
          collected.push({ title: item.title, link: item.link || '', img, source: f.name });
        }
      }
    } catch (e) {
      log(`${f.name} 抓取失败`);
    }
  }

  log(`共收集到 ${collected.length} 条带图新闻`);

  for (const n of collected.slice(0, 8)) {
    const zhTitle = await translate(n.title.trim());
    const caption = `<b>${zhTitle}</b>\n来源：${n.source}\n🔗 ${n.link}`;
    await sendNews(n.img, caption);
    await new Promise(r => setTimeout(r, 3500));  // 防风控
  }

  log('本次运行结束');
})();
