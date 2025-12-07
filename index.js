const Parser = require('rss-parser');
const fetch = require('node-fetch');

const parser = new Parser();
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const SEND_PHOTO = `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`;

// 免费 OCR + 免费翻译 + 免费文字上图（三连击）
async function ocrAndTranslateImage(imageUrl) {
  try {
    // 第1步：OCR 识别图片文字（免费接口）
    const ocrRes = await fetch('https://ocr.space/ocrapi', {
      method: 'POST',
      body: JSON.stringify({
        apikey: 'helloworld',           // ocr.space 免费默认 key，够用
        language: 'eng',
        url: imageUrl,
        isOverlayRequired: false
      }),
      headers: { 'Content-Type': 'application/json' }
    });
    const ocr = await ocrRes.json();
    const englishText = ocr.ParsedResults?.[0]?.ParsedText || '';

    if (!englishText.trim()) return imageUrl;  // 没文字就原图

    // 第2步：翻译成中文
    const transRes = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(englishText)}&langpair=en|zh-CN`);
    const trans = await transRes.json();
    const chineseText = trans.responseStatus === 200 ? trans.responseData.translatedText : englishText;

    // 第3步：把中文打到原图上（免费文字上图 API）
    const overlayUrl = `https://api.textinimage.com/overlay?text=${encodeURIComponent(chineseText)}&url=${encodeURIComponent(imageUrl)}&fontSize=48&color=ffffff&stroke=000000&strokeWidth=6&gravity=southeast&padding=30`;

    return overlayUrl;  // 返回带中文字幕的新图链接
  } catch (e) {
    return imageUrl;  // 任何一步失败都退回原图
  }
}

const RSS = [
  'https://feeds.bbci.co.uk/news/world/rss.xml',
  'https://feeds.feedburner.com/techcrunch',
  'https://rss.dw.com/rdf/rss-en-top',
  'https://www.theguardian.com/world/rss',
  'https://www.aljazeera.com/xml/rss/all.xml'
];

async function translate(text) {
  if (!text) return '';
  try {
    const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh-CN`);
    const j = await r.json();
    return j.responseStatus === 200 ? j.responseData.translatedText : text;
  } catch { return text; }
}

(async () => {
  if (!BOT_TOKEN || !CHAT_ID) return;

  await fetch(SEND_PHOTO.replace('/sendPhoto', '/sendMessage'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text: `全球头条 · ${new Date().toLocaleDateString('zh-CN', { weekday: 'long', month: 'long', day: 'numeric' })}` })
  });

  let count = 0;
  for (const url of RSS) {
    const feed = await parser.parseURL(url);
    for (const item of feed.items.slice(0, 6)) {
      if (count >= 10) break;
      if (!item.link) continue;

      const en = (item.title + '. ' + (item.contentSnippet || '')).slice(0, 400);
      const zh = await translate(en);
      const sentences = zh.split(/[。！？.!?]/).filter(s => s.trim());
      const title = sentences[0] || zh.slice(0, 60);
      const body = sentences.slice(1).join('。');

      // 提取文章首图（几乎 100% 有）
      const page = await fetch(item.link);
      const html = await page.text();
      const imgMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) ||
                       html.match(/<meta\s+name="og:image"\s+content="([^"]+)"/i);
      const img = imgMatch ? imgMatch[1] : null;

      const caption = `<b>${title}</b>\n\n${body}\n\n来源：${feed.title?.split(' - ')[0].split('|')[0].trim()}\n🔗 ${item.link}`;

      if (img) {
        const finalImg = await ocrAndTranslateImage(img);   // ← 关键：图上英文变中文
        await fetch(SEND_PHOTO, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: CHAT_ID, photo: finalImg, caption, parse_mode: 'HTML' })
        });
      } else {
        await fetch(SEND_PHOTO.replace('/sendPhoto', '/sendMessage'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: CHAT_ID, text: caption, parse_mode: 'HTML', disable_web_page_preview: false })
        });
      }

      count++;
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  await fetch(SEND_PHOTO.replace('/sendPhoto', '/sendMessage'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text: `今日共 ${count} 条全中文全球头条已送达` })
  });
})();
