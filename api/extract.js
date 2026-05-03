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

    var selectedScenes = scenes.slice(0, 10);

    var prompt = 'You are an AI image prompt engineer. Convert each scene into a short, vivid English image prompt.\n\n' +
        'RULES:\n' +
        '1. Each prompt must be 20-40 words only (short prompts work better for AI image generators)\n' +
        '2. Focus on: main subject, action, environment, lighting, mood\n' +
        '3. Add style keywords: cinematic, dramatic lighting, 4K, film still\n' +
        '4. Do NOT include text, subtitles, or speech bubbles\n' +
        '5. Describe people by appearance (young woman in red dress), not by name\n' +
        '6. Write in English only\n\n' +
        'Scenes:\n' +
        JSON.stringify(selectedScenes, null, 2) + '\n\n' +
        'Return ONLY a JSON array, nothing else:\n' +
        '[{"episode":1,"scene":1,"prompt":"English prompt here","characters":"who appears"},...]';

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
                max_tokens: 3000
            })
        });

        if (!resp.ok) return res.status(502).json({ error: 'AI服务不可用' });

        var data = await resp.json();
        var content = data.choices?.[0]?.message?.content;
        if (!content) return res.status(502).json({ error: 'AI未返回内容' });

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
