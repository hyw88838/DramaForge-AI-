export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { script } = req.body;
    if (!script || !script.episodes) return res.status(400).json({ error: '请提供剧本数据' });

    const API_KEY = process.env.AI_API_KEY;
    const API_URL = process.env.AI_API_URL;
    const MODEL   = process.env.AI_MODEL;

    if (!API_KEY || !API_URL) return res.status(500).json({ error: '服务未配置' });

    // 从剧本中提取每个场景的视觉描述
    var scenes = [];
    script.episodes.forEach(function(ep, epIdx) {
        if (ep.scenes) {
            ep.scenes.forEach(function(sc, scIdx) {
                scenes.push({
                    episode: ep.number || epIdx + 1,
                    scene: scIdx + 1,
                    setting: sc.setting || '',
                    action: sc.action || '',
                    dialogue: sc.dialogue ? sc.dialogue.map(function(d) {
                        return d.character + '：' + d.line;
                    }).join(' | ') : ''
                });
            });
        }
    });

    if (scenes.length === 0) {
        return res.status(400).json({ error: '剧本中没有场景数据' });
    }

    // 限制最多10个场景（控制成本）
    var selectedScenes = scenes.slice(0, 10);

    var prompt = '你是AI视频分镜师。根据以下短剧场景信息，为每个场景生成一段适合AI图片生成的英文提示词（prompt）。\n\n' +
        '要求：\n' +
        '1. 每个prompt 50-80个英文单词\n' +
        '2. 描述画面构图、人物外貌、表情、服装、环境、光线、氛围\n' +
        '3. 风格统一为：cinematic, dramatic lighting, 4K, film still\n' +
        '4. 不要包含文字、字幕、对话框\n' +
        '5. 人物描述要具体（性别、大致年龄、服装风格），但不要用真实人名\n\n' +
        '场景列表：\n' +
        JSON.stringify(selectedScenes, null, 2) + '\n\n' +
        '严格返回JSON数组，不要任何其他文字：\n' +
        '[\n' +
        '  {"episode":1,"scene":1,"prompt":"英文提示词","characters":"画面中的人物描述"},\n' +
        '  ...\n' +
        ']';

    try {
        var resp = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + API_KEY
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: 4000
            })
        });

        if (!resp.ok) return res.status(502).json({ error: 'AI服务不可用' });

        var data = await resp.json();
        var content = data.choices?.[0]?.message?.content;
        if (!content) return res.status(502).json({ error: 'AI未返回内容' });

        // 解析JSON
        var result = null;
        try { result = JSON.parse(content.trim()); } catch(e) {}
        if (!result) {
            try {
                var s = content.indexOf('[');
                var e = content.lastIndexOf(']');
                if (s !== -1 && e !== -1) result = JSON.parse(content.substring(s, e + 1));
            } catch(e2) {}
        }
        if (!result) {
            try {
                var m = content.match(/```(?:json)?\s*([\s\S]*?)```/);
                if (m) result = JSON.parse(m[1].trim());
            } catch(e3) {}
        }

        if (!Array.isArray(result)) {
            return res.status(502).json({ error: 'AI输出格式异常' });
        }

        return res.status(200).json({ success: true, scenes: result });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: '提取失败' });
    }
}
