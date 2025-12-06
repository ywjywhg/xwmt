const Parser = require('rss-parser');
const fetch = require('node-fetch');

const parser = new Parser();
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const SEND = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

// 换成这个接口：免费、速度快、GitHub 环境永远能用
async function translate(en) {
  if (!en) return '';
  try {
    const res = await fetch('https://translate.argosopentech.com/translate', {
      method: 'POST',
      body: JSON.stringify({ q: en, source: 'en', target: 'zh' }),
      headers: { 'Content-Type': 'application/json' }
    });
    const json = await res.json();
    return json.translatedText?.trim() || en;
  } catch (e) {
    return en; // 实在不行就原文
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
  if (!BOT_TOKEN || !CHAT_ID) return console.log('密钥缺失');

  // 开机问好
  await fetch(SEND, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text: '早安！全球头条来啦\n' + new Date().toLocaleDateString('zh-CN', { weekday: 'long', month: 'long', day: 'numeric' }) })
  });

  let count = 0;
  for (const url of RSS) {
    try {
      const feed = await parser.parseURL(url);
      for (const item of feed.items.slice(0, 5)) {
        if (!item.title || !item.link) continue;

        const zhTitle = await translate(item.title);
        const snippet = item.contentSnippet ? item.contentSnippet.slice(0, 180) + '…' : '';

        const text = `头条 ${++count}\n<b>${zhTitle}</b>\n\n${snippet}\n\n来源：${feed.title?.split('|')[0].trim()}\n🔗 <a href="${item.link}">阅读全文</a>`;

        await fetch(SEND, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: CHAT_ID,
            text: text,
            parse_mode: 'HTML',
            disable_web_page_preview: false   // 自动抓首图
          })
        });

        if (count >= 8) {
          await fetch(SEND, { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: CHAT_ID, text: `今日精选 ${count} 条全球头条已送达\n美好的一天从了解世界开始` })
          });
          return;
        }
        await new Promise(r => setTimeout(r, 4000)); // 防风控
      }
    } catch (e) {}
  }
})();
