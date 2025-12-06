const Parser = require('rss-parser');
const fetch = require('node-fetch');
const axios = require('axios');

const parser = new Parser();
const RSS_FEEDS = [
  { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { name: 'Reuters World', url: 'https://www.reuters.com/arc/outboundfeeds/newsroom/all/?outputType=xml' },
  { name: 'AP News', url: 'https://apnews.com/index.rss' },
  { name: 'The Guardian World', url: 'https://www.theguardian.com/world/rss' },
  { name: 'CNN World', url: 'https://rss.cnn.com/rss/edition_world.rss' }
];

const BOT_TOKEN = '8284424286:AAGpxpoqJHx6qJ6017XVa5q-wlE6c_i0aBs'; // 替换为你的 Bot Token
const CHAT_ID = '5798301485'; // 替换为你的 Chat ID
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`;
const LIBRE_API = 'https://libretranslate.de/translate'; // 免费公共实例
const SOURCE_LANG = 'en'; // 源语言：英语
const TARGET_LANG = 'zh'; // 目标语言：中文

// 翻译函数（使用 LibreTranslate）
async function translateText(text) {
  if (!text) return '';
  try {
    const response = await axios.post(LIBRE_API, {
      q: text,
      source: SOURCE_LANG,
      target: TARGET_LANG,
      format: 'text'
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    return response.data.translatedText;
  } catch (error) {
    console.error('翻译失败:', error.message);
    return text; // 失败时返回原文
  }
}

// 发送到 Telegram（带图片）
async function sendToTelegram(imageUrl, caption) {
  try {
    await fetch(TELEGRAM_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        photo: imageUrl,
        caption: caption,
        parse_mode: 'HTML' // 支持简单 HTML 格式
      })
    });
    console.log('消息发送成功');
  } catch (error) {
    console.error('发送失败:', error.message);
  }
}

// 主函数：抓取并处理
async function fetchNews() {
  let allNews = [];
  for (const feed of RSS_FEEDS) {
    try {
      console.log(`抓取 ${feed.name}...`);
      const feedData = await parser.parseURL(feed.url);
      feedData.items.slice(0, 3).forEach(item => { // 每个源取前 3 条，避免太多
        // 过滤带图片的：检查 enclosure 或 media:content
        const imageUrl = item.enclosure?.url || item['media:content']?.$.url || item['media:thumbnail']?.$.url;
        if (imageUrl && item.title && item.link && item.contentSnippet) {
          allNews.push({
            title: item.title,
            link: item.link,
            source: feed.name,
            image: imageUrl
          });
        }
      });
    } catch (error) {
      console.error(`抓取 ${feed.name} 失败:`, error.message);
    }
  }

  // 翻译并发送（取前 5 条总新闻，避免 spam）
  for (const news of allNews.slice(0, 5)) {
    const transTitle = await translateText(news.title);
    const caption = `<b>${transTitle}</b>\n来源: ${news.source}\n原文: ${news.link}`;
    await sendToTelegram(news.image, caption);
    await new Promise(resolve => setTimeout(resolve, 2000)); // 延时 2 秒，避免速率限制
  }
}

// 运行
fetchNews().catch(console.error);