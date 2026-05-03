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

    // 从剧本中提取场景
    var scenes = [];
    script.episodes.forEach(function(ep, epIdx) {
        if (ep.scenes && ep.scenes.length > 0) {
            ep.scenes.forEach(function(sc, scIdx) {
                // 拼接场景描述
                var desc = '';
                if (sc.setting) desc += sc.setting + '. ';
                if (sc.action) desc += sc.action + '. ';
                if (sc.dialogue && sc.dialogue.length > 0) {
                    desc += sc.dialogue.slice(0, 2).map(function(d) {
                        return d.character + ' ' + (d.emotion || '') + ' ' + d.line;
                    }).join('. ');
                }

                scenes.push({
                    episode: ep.number || epIdx + 1,
                    scene: scIdx + 1,
                    description: desc.trim()
                });
            });
        }
    });

    if (scenes.length === 0) {
        return res.status(400).json({ error: '剧本中没有场景数据' });
    }

    // 只取前8个场景
    var selected = scenes.slice(0, 8);

    // 把每个场景单独发给 AI 翻译成英文 prompt（短文本，成功率高）
    var prompts = [];
    for (var i = 0; i < selected.length; i++) {
        var sc = selected[i];
        var prompt = 'Convert this Chinese scene description into a short English image generation prompt (20-40 words). Focus on visual elements: characters appearance, action, environment, lighting, mood. Add: cinematic, dramatic lighting, 4K. Do NOT add any explanation, return ONLY the English prompt.\n\nScene: ' + sc.description;

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
                    temperature: 0.5,
                    max_tokens: 200
                })
            });

            if (resp.ok) {
                var data = await resp.json();
                var content = data.choices?.[0]?.message?.content;
                if (content && content.trim().length > 5) {
                    prompts.push({
                        episode: sc.episode,
                        scene: sc.scene,
                        prompt: content.trim().replace(/^["']|["']$/g, '')
                    });
                } else {
                    // AI返回空，用备用方案
                    prompts.push({
                        episode: sc.episode,
                        scene: sc.scene,
                        prompt: buildFallbackPrompt(sc.description)
                    });
                }
            } else {
                prompts.push({
                    episode: sc.episode,
                    scene: sc.scene,
                    prompt: buildFallbackPrompt(sc.description)
                });
            }
        } catch(e) {
            prompts.push({
                episode: sc.episode,
                scene: sc.scene,
                prompt: buildFallbackPrompt(sc.description)
            });
        }
    }

    return res.status(200).json({ success: true, scenes: prompts });
}

// 备用方案：直接从中文描述生成英文 prompt
function buildFallbackPrompt(desc) {
    // 基础视觉关键词
    var base = 'cinematic scene, dramatic lighting, 4K film still, ';
    // 把中文描述简单翻译为关键词
    var keywords = desc
        .replace(/[，。！？「」（）、：；\n]/g, ', ')
        .replace(/村口/g, 'village entrance')
        .replace(/晨雾/g, 'morning mist')
        .replace(/身影/g, 'silhouette')
        .replace(/字幕/g, '')
        .substring(0, 120);

    return base + 'Chinese drama scene, ' + keywords;
}
