export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { topic, genre, episodes, audience, extra } = req.body;
    if (!topic || !topic.trim()) return res.status(400).json({ error: '请输入剧本主题' });

    const API_KEY = process.env.AI_API_KEY;
    const API_URL = process.env.AI_API_URL;
    const MODEL   = process.env.AI_MODEL;

    if (!API_KEY || !API_URL) {
        return res.status(500).json({ error: '服务未配置' });
    }

    // ── 类型说明 ──
    var genreNames = {
        'romance': '甜宠爱情',
        'suspense': '悬疑推理',
        'comedy': '搞笑喜剧',
        'fantasy': '玄幻仙侠',
        'urban': '都市情感',
        'rebirth': '重生逆袭',
        'revenge': '复仇爽文',
        'ceo': '霸道总裁'
    };

    var genreStyle = {
        'romance': '风格要求：甜宠路线，男女主互动要有化学反应，每集结尾要有心动瞬间或小悬念。对话要有暧昧感，适当撒糖。节奏轻快，虐中带甜。',
        'suspense': '风格要求：悬疑氛围浓厚，每集结尾必须有反转或新线索。节奏紧凑，信息量大。对话要有张力，适当设置误导和红鲱鱼。善用伏笔和呼应。',
        'comedy': '风格要求：笑点密集，善用反差、误会、吐槽等喜剧手法。人物要有鲜明的喜剧特质。节奏轻快，对话要接地气有网感。适当加入时下热梗。',
        'fantasy': '风格要求：世界观设定要清晰，修炼体系/法术规则要自洽。战斗场面要有画面感。人物要有仙气或霸气。每集要有爽点或燃点。',
        'urban': '风格要求：贴近现实，情感真挚。展现都市生活的压力与温情。人物关系要有层次感。对话自然生活化，引发共鸣。',
        'rebirth': '风格要求：重生后利用前世记忆逆转命运，每集要有打脸名场面。节奏要爽，敌人一个个被反杀。情感线穿插其中，不只是一味复仇。',
        'revenge': '风格要求：复仇为主线，每集要有进展。主角要隐忍蓄力，关键时刻爆发。反派要够坏够强。节奏紧凑，悬念迭起。',
        'ceo': '风格要求：霸道总裁人设要到位，高冷但对女主例外。要有经典名场面（壁咚、吃醋、护短）。节奏快，误会-解误会-撒糖循环推进。'
    };

    var epNum = parseInt(episodes) || 5;
    if (epNum < 1) epNum = 1;
    if (epNum > 20) epNum = 20;

    var genreKey = genre || 'romance';
    var genreName = genreNames[genreKey] || '短剧';
    var genreNote = genreStyle[genreKey] || '';

    var systemPrompt = '你是一位资深短剧编剧，擅长创作抖音、快手、微信短剧平台上的爆款短剧剧本。你深谙短剧创作的核心法则：前3秒抓人、每集有钩子、节奏快反转多、情绪价值拉满。\n\n' +
        '【短剧创作核心法则】\n' +
        '1. 黄金3秒法则：每集开头必须有冲突或悬念，立刻抓住观众\n' +
        '2. 钩子结构：每集结尾必须留悬念，让观众忍不住看下一集\n' +
        '3. 节奏紧凑：每集1-3分钟，不拖沓，信息密度高\n' +
        '4. 情绪波动：每集要有情绪起伏（愤怒→爽→感动→期待）\n' +
        '5. 人物鲜明：主角要有明确特质，反派要够可恨\n' +
        '6. 对话要有网感：简短有力，适合竖屏观看，金句频出\n\n' +
        genreNote + '\n\n' +
        '【输出格式】\n' +
        '严格返回合法JSON，不要加任何其他文字，不要用markdown代码块。\n' +
        'JSON结构：\n' +
        '{\n' +
        '  "title": "剧名（6字以内，有记忆点）",\n' +
        '  "tagline": "一句话卖点（吸引点击）",\n' +
        '  "characters": [\n' +
        '    {"name": "角色名", "role": "主角/配角/反派", "desc": "人物简介（性格+背景，30字以内）"}\n' +
        '  ],\n' +
        '  "synopsis": "剧情梗概（100-150字，概述全剧主线）",\n' +
        '  "episodes": [\n' +
        '    {\n' +
        '      "number": 1,\n' +
        '      "title": "集标题（有悬念感）",\n' +
        '      "duration": "建议时长（如1-2分钟）",\n' +
        '      "hook": "本集钩子/悬念（一句话）",\n' +
        '      "scenes": [\n' +
        '        {\n' +
        '          "setting": "场景描述（时间+地点+氛围）",\n' +
        '          "action": "动作/画面描述（给导演和演员看的）",\n' +
        '          "dialogue": [\n' +
        '            {"character": "角色名", "line": "台词内容", "emotion": "情绪/语气"}\n' +
        '          ]\n' +
        '        }\n' +
        '      ]\n' +
        '    }\n' +
        '  ]\n' +
        '}\n\n' +
        '【重要规则】\n' +
        '1. 每集2-4个场景\n' +
        '2. 每个场景3-6句对话\n' +
        '3. 对话要简短有力，每句不超过20字\n' +
        '4. 每集必须有情绪高潮点\n' +
        '5. 每集结尾的hook要让人想看下一集\n' +
        '6. 最后一集结尾可以开放或圆满，但要有记忆点\n' +
        '7. 角色数量控制在3-6个\n' +
        '8. 严格只输出JSON';

    var userPrompt = '请创作一部短剧剧本：\n\n' +
        '【主题/设定】' + topic.trim() + '\n' +
        '【类型】' + genreName + '\n' +
        '【集数】' + epNum + '集\n' +
        '【目标受众】' + (audience || '18-35岁年轻人') + '\n' +
        (extra ? '【补充要求】' + extra.trim() + '\n' : '') +
        '\n严格只输出JSON。';

    try {
        var resp = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + API_KEY
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.8,
                max_tokens: 8000
            })
        });

        if (!resp.ok) {
            var errText = await resp.text();
            console.error('API Error:', resp.status, errText);
            return res.status(502).json({ error: 'AI服务不可用' });
        }

        var data = await resp.json();
        var content = data.choices?.[0]?.message?.content;
        if (!content) return res.status(502).json({ error: 'AI未返回内容' });

        // ── 4种方法解析JSON ──
        var script = null;

        try {
            var c1 = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
            script = JSON.parse(c1);
        } catch(e1) {}

        if (!script) {
            try {
                var m = content.match(/```(?:json)?\s*([\s\S]*?)```/);
                if (m) script = JSON.parse(m[1].trim());
            } catch(e2) {}
        }

        if (!script) {
            try {
                var s = content.indexOf('{');
                var e = content.lastIndexOf('}');
                if (s !== -1 && e !== -1 && e > s) script = JSON.parse(content.substring(s, e + 1));
            } catch(e3) {}
        }

        if (!script) {
            try {
                var all = content.match(/\{[\s\S]*\}/g);
                if (all && all.length > 0) {
                    var longest = all.sort(function(a, b) { return b.length - a.length; })[0];
                    script = JSON.parse(longest);
                }
            } catch(e4) {}
        }

        if (!script || !script.title || !Array.isArray(script.episodes) || script.episodes.length === 0) {
            console.error('Parse failed:', content.substring(0, 500));
            return res.status(502).json({ error: 'AI输出格式异常，请重试' });
        }

        // 补全字段
        script.tagline = script.tagline || '';
        script.synopsis = script.synopsis || '';
        script.characters = Array.isArray(script.characters) ? script.characters : [];
        script.episodes = script.episodes.map(function(ep) {
            return {
                number: ep.number || 0,
                title: ep.title || '未命名',
                duration: ep.duration || '1-2分钟',
                hook: ep.hook || '',
                scenes: Array.isArray(ep.scenes) ? ep.scenes.map(function(sc) {
                    return {
                        setting: sc.setting || '',
                        action: sc.action || '',
                        dialogue: Array.isArray(sc.dialogue) ? sc.dialogue : []
                    };
                }) : []
            };
        });

        return res.status(200).json({ success: true, script: script, usage: data.usage || {} });

    } catch (err) {
        console.error('Server Error:', err);
        return res.status(500).json({ error: '生成失败' });
    }
}
