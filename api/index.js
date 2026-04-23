const axios = require('axios');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate');

    // URL'den ID çekme (/api/pinned/ID)
    const parts = req.url.split('/');
    const channelId = parts[parts.length - 1].split('?')[0];

    if (!channelId || channelId === 'pinned') {
        return res.status(400).json({ success: false, error: 'Channel ID required' });
    }

    try {
        const targetUrls = [
            `https://kick.com/api/internal/v1/channels/${channelId}/chatroom/pinned-message`,
            `https://kick.com/api/v2/channels/${channelId}/messages`
        ];
        
        let pinnedMessage = null;

        for (const targetUrl of targetUrls) {
            if (pinnedMessage) break;

            const finalTarget = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
            const proxies = [
                `https://api.allorigins.win/get?url=${encodeURIComponent(finalTarget)}`,
                `https://corsproxy.io/?${encodeURIComponent(finalTarget)}`
            ];

            for (const proxyUrl of proxies) {
                try {
                    const response = await axios.get(proxyUrl, { timeout: 6000 });
                    let data = response.data;

                    if (data && data.contents) {
                        try { data = JSON.parse(data.contents); } catch (e) { continue; }
                    }

                    // Veri Ayıklama
                    let pinned = data?.data?.message || data?.data?.pinned_message?.message || data?.message;
                    
                    if (pinned && typeof pinned === 'object') {
                        pinnedMessage = pinned;
                        break;
                    }
                } catch (err) { continue; }
            }
        }

        return res.status(200).json({
            success: true,
            pinned_message: pinnedMessage || null
        });

    } catch (error) {
        return res.status(200).json({ success: false, pinned_message: null, error: error.message });
    }
};
