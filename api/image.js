export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: '请提供提示词' });

    // ══════════════════════════════════════
    //  即梦2.0 API 配置
    //  从环境变量读取
    // ══════════════════════════════════════
    const JIMENG_KEY    = process.env.JIMENG_API_KEY;
    const JIMENG_SECRET = process.env.JIMENG_API_SECRET;
    const JIMENG_EP     = process.env.JIMENG_ENDPOINT || 'https://visual.volcengineapi.com';

    if (!JIMENG_KEY || !JIMENG_SECRET) {
        return res.status(500).json({ error: '即梦API未配置，请设置 JIMENG_API_KEY 和 JIMENG_API_SECRET' });
    }

    try {
        // ══════════════════════════════════════
        //  即梦2.0 文生图 API
        //  注意：以下接口地址和参数需要根据
        //  火山引擎官方文档确认和调整
        //  文档：https://www.volcengine.com/docs/6791
        // ══════════════════════════════════════

        // Step 1: 提交文生图任务
        var submitResp = await fetch(JIMENG_EP + '/v1/jimeng/high_aes/general_v20/text2img', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + JIMENG_KEY,
                'X-Api-Key': JIMENG_KEY,
                'X-Api-Secret': JIMENG_SECRET
            },
            body: JSON.stringify({
                prompt: prompt,
                width: 1024,
                height: 576,    // 16:9 横屏，适合短剧
                seed: Math.floor(Math.random() * 1000000),
                scale: 3.5,
                ddim_steps: 25,
                return_url: true,
                logo_info: { add_logo: false }
            })
        });

        if (!submitResp.ok) {
            var errText = await submitResp.text();
            console.error('Jimeng API Error:', submitResp.status, errText);
            return res.status(502).json({ error: '即梦API调用失败：' + submitResp.status });
        }

        var submitData = await submitResp.json();

        // 即梦可能返回直接结果，也可能返回任务ID需要轮询
        if (submitData.data && submitData.data.image_urls && submitData.data.image_urls.length > 0) {
            // 直接返回了图片
            return res.status(200).json({
                success: true,
                image_url: submitData.data.image_urls[0],
                task_id: submitData.data.task_id || null
            });
        }

        // 如果返回了任务ID，需要轮询
        if (submitData.data && submitData.data.task_id) {
            var taskId = submitData.data.task_id;
            var imageUrl = await pollTask(JIMENG_EP, JIMENG_KEY, JIMENG_SECRET, taskId);
            if (imageUrl) {
                return res.status(200).json({ success: true, image_url: imageUrl, task_id: taskId });
            } else {
                return res.status(502).json({ error: '图片生成超时' });
            }
        }

        // 兜底：返回原始响应供调试
        console.log('Jimeng response:', JSON.stringify(submitData).substring(0, 500));
        return res.status(502).json({ error: '即梦API返回格式异常', raw: submitData });

    } catch (err) {
        console.error('Image generation error:', err);
        return res.status(500).json({ error: '图片生成失败' });
    }
}

// 轮询任务状态
async function pollTask(endpoint, key, secret, taskId) {
    var maxRetries = 30;  // 最多等30次，每次2秒
    for (var i = 0; i < maxRetries; i++) {
        await new Promise(function(r) { setTimeout(r, 2000); });

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
                if (data.data && data.data.image_urls && data.data.image_urls.length > 0) {
                    return data.data.image_urls[0];
                }
                if (data.data && data.data.status === 'failed') {
                    console.error('Task failed:', data);
                    return null;
                }
            }
        } catch (e) {
            console.error('Poll error:', e);
        }
    }
    return null;
}
