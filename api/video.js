export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { image_url, prompt, duration } = req.body;
    if (!image_url) return res.status(400).json({ error: '请提供图片URL' });

    const JIMENG_KEY    = process.env.JIMENG_API_KEY;
    const JIMENG_SECRET = process.env.JIMENG_API_SECRET;
    const JIMENG_EP     = process.env.JIMENG_ENDPOINT || 'https://visual.volcengineapi.com';

    if (!JIMENG_KEY || !JIMENG_SECRET) {
        return res.status(500).json({ error: '即梦API未配置' });
    }

    try {
        // ══════════════════════════════════════
        //  即梦2.0 图生视频 API
        //  文档：https://www.volcengine.com/docs/6791
        // ══════════════════════════════════════

        var submitResp = await fetch(JIMENG_EP + '/v1/jimeng/high_aes/general_v20/img2video', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + JIMENG_KEY,
                'X-Api-Key': JIMENG_KEY,
                'X-Api-Secret': JIMENG_SECRET
            },
            body: JSON.stringify({
                image_url: image_url,
                prompt: prompt || '',
                duration: duration || 4,       // 视频时长（秒）
                fps: 24,
                width: 1024,
                height: 576,
                motion_strength: 0.7,
                return_url: true
            })
        });

        if (!submitResp.ok) {
            var errText = await submitResp.text();
            console.error('Jimeng Video API Error:', submitResp.status, errText);
            return res.status(502).json({ error: '视频生成API调用失败' });
        }

        var submitData = await submitResp.json();

        // 直接返回视频URL
        if (submitData.data && submitData.data.video_url) {
            return res.status(200).json({
                success: true,
                video_url: submitData.data.video_url,
                task_id: submitData.data.task_id || null
            });
        }

        // 需要轮询
        if (submitData.data && submitData.data.task_id) {
            var taskId = submitData.data.task_id;
            var videoUrl = await pollVideoTask(JIMENG_EP, JIMENG_KEY, JIMENG_SECRET, taskId);
            if (videoUrl) {
                return res.status(200).json({ success: true, video_url: videoUrl, task_id: taskId });
            } else {
                return res.status(502).json({ error: '视频生成超时' });
            }
        }

        console.log('Video response:', JSON.stringify(submitData).substring(0, 500));
        return res.status(502).json({ error: '视频API返回异常', raw: submitData });

    } catch (err) {
        console.error('Video generation error:', err);
        return res.status(500).json({ error: '视频生成失败' });
    }
}

async function pollVideoTask(endpoint, key, secret, taskId) {
    var maxRetries = 60;  // 视频生成更久，最多等60次，每次3秒
    for (var i = 0; i < maxRetries; i++) {
        await new Promise(function(r) { setTimeout(r, 3000); });
        try {
            var resp = await fetch(endpoint + '/v1/jimeng/query?task_id=' + taskId, {
                headers: {
                    'Authorization': 'Bearer ' + key,
                    'X-Api-Key': key,
                    'X-Api-Secret': secret
                }
            });
            if (resp.ok) {
                var data = await resp.json();
                if (data.data && data.data.video_url) return data.data.video_url;
                if (data.data && data.data.status === 'failed') return null;
            }
        } catch (e) {
            console.error('Poll error:', e);
        }
    }
    return null;
}
