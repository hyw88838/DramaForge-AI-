export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: '请提供提示词' });

    try {
        // 截短 prompt
        var shortPrompt = (prompt || '').substring(0, 200);
        var seed = Math.floor(Math.random() * 999999);
        var encodedPrompt = encodeURIComponent(shortPrompt);

        var imageUrl = 'https://image.pollinations.ai/prompt/' + encodedPrompt +
            '?width=1024&height=576&seed=' + seed + '&nologo=true&model=flux';

        // 重试2次
        for (var i = 0; i < 2; i++) {
            try {
                var resp = await fetch(imageUrl, {
                    method: 'GET',
                    signal: AbortSignal.timeout(90000)
                });
                if (resp.ok) {
                    return res.status(200).json({ success: true, image_url: imageUrl });
                }
            } catch(e) {
                if (i === 0) {
                    await new Promise(function(r) { setTimeout(r, 3000); });
                }
            }
        }

        // 超时兜底：返回URL，让前端img标签直接加载
        return res.status(200).json({ success: true, image_url: imageUrl, note: '图片可能需要几秒加载' });

    } catch (err) {
        console.error('Image error:', err.message);
        // 最终兜底
        var fallbackUrl = 'https://image.pollinations.ai/prompt/' + encodeURIComponent((prompt || '').substring(0, 150)) + '?width=1024&height=576&nologo=true&model=flux';
        return res.status(200).json({ success: true, image_url: fallbackUrl, note: '图片可能需要几秒加载' });
    }
}
