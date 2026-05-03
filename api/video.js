export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // ══════════════════════════════════════
    //  视频生成暂时用免费方案替代
    //  方案：将图片做成带 Ken Burns 效果的视频
    //  使用 Pollinations 的图片 + CSS 动画模拟
    // ══════════════════════════════════════

    return res.status(200).json({
        success: false,
        error: '免费视频生成暂不可用，请升级到付费版使用即梦视频功能',
        suggestion: 'upgrade'
    });
}
