const Parser = require('rss-parser');
const fetch = require('node-fetch');

const parser = new Parser();
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const SEND = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

// 超级稳免费翻译（标题 + 正文一起翻）
async function translate(text) {
  if (!text?.trim()) return '';
  try {
    const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.trim())}&langpair=en|zh-CN`);
    const json = await res.json();
    if (json.responseStatus === 200) return json.responseData.translatedText;
  } catch (e) {}
  return text.trim(); // 实在翻不了就原文
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
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: `早安！全球头条 · ${new Date().toLocaleDateString('zh-CN', { weekday: 'long', month: 'long', day: 'numeric' })}`
    })
  });

  let count = 0;
  for (const url of RSS) {
    try {
      const feed = await parser.parseURL(url);
      for (const item of feed.items.slice(0, 6)) {
        if (!item.title || !item.link) continue;

        // 标题 + 正文导语一起翻译（最多 400 字，够用）
        const enText = (item.title + '. ' + (item.contentSnippet || item.description || '')).slice(0, 400);
        const zhText = await translate(enText);

        // 智能分割：第一句当标题，其余当正文
        const sentences = zhText.split(/[。！？.!?]/).filter(s => s.trim());
        const zhTitle = sentences[0] || zhText.slice(0, 60);
        const zhBody = sentences.slice(1).join('。').trim() || zhText.slice(zhTitle.length).trim();

        const text = `<b>${zhTitle}</b>\n\n${zhBody}\n\n来源：${feed.title?.split(' - ')[0].split('|')[0].trim()}\n<a href="${item.link}">阅读全文</a>`;

        await fetch(SEND, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: CHAT_ID,
            text,
            parse_mode: 'HTML',
            disable_web_page_preview: false   // 自动带大图
          })
        });

        count++;
        if (count >= 10) break;   // 每天最多 10 条
        await new Promise(r => setTimeout(r, 4500)); // 防风控
      }
      if (count >= 10) break;
    } catch (e) {}
  }

  // 收尾
  await fetch(SEND, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: `今日精选 ${count} 条全球头条已全部送达\n美好的一天从了解世界开始`
    })
  });
})();
