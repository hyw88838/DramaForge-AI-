export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: '请提供提示词' });

    try {
        // ══════════════════════════════════════
        //  Pollinations.ai — 完全免费
        //  不需要API Key，不需要注册
        //  直接通过URL生成图片
        // ══════════════════════════════════════

        var seed = Math.floor(Math.random() * 999999);
        var encodedPrompt = encodeURIComponent(prompt);

        var imageUrl = 'https://image.pollinations.ai/prompt/' + encodedPrompt +
            '?width=1024&height=576&seed=' + seed +
            '&nologo=true&model=flux';

        // 验证图片是否可用（Pollinations 是同步生成，请求URL即生成）
        var imgResp = await fetch(imageUrl, {
            method: 'HEAD',
            signal: AbortSignal.timeout(60000)  // 60秒超时
        });

        if (imgResp.ok) {
            return res.status(200).json({
                success: true,
                image_url: imageUrl
            });
        }

        // HEAD 请求失败，尝试直接 GET
        var imgGet = await fetch(imageUrl, {
            method: 'GET',
            signal: AbortSignal.timeout(90000)
        });

        if (imgGet.ok) {
            return res.status(200).json({
                success: true,
                image_url: imageUrl
            });
        }

        return res.status(502).json({ error: '图片生成失败，请重试' });

    } catch (err) {
        console.error('Image error:', err.message);

        // 超时的情况，URL可能仍然有效
        if (err.name === 'TimeoutError' || err.name === 'AbortError') {
            var fallbackUrl = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) +
                '?width=1024&height=576&nologo=true&model=flux';
            return res.status(200).json({
                success: true,
                image_url: fallbackUrl,
                note: '图片可能需要几秒加载'
            });
        }

        return res.status(500).json({ error: '图片生成失败' });
    }
}
