const axios = require('axios');

module.exports = async (req, res) => {
    // CORS Ayarları
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // URL'den ID çekme (örn: /api/pinned/972395)
    const parts = req.url.split('/');
    const channelId = parts[parts.length - 1].split('?')[0];

    if (!channelId || channelId === 'pinned') {
        return res.status(400).json({ success: false, error: 'Channel ID is required' });
    }

    try {
        // Denenecek URL listesi (En hızlıdan en yavaşa)
        const targetUrls = [
            `https://kick.com/api/internal/v1/channels/${channelId}/chatroom/pinned-message`,
            `https://kick.com/api/v2/channels/${channelId}/messages`
        ];
        
        let pinnedMessage = null;
        let successFound = false;

        for (const targetUrl of targetUrls) {
            if (successFound) break;

            const timeStamp = Date.now();
            const finalTarget = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}t=${timeStamp}`;
            
            const proxies = [
                `https://api.allorigins.win/get?url=${encodeURIComponent(finalTarget)}`,
                `https://corsproxy.io/?${encodeURIComponent(finalTarget)}`
            ];

            for (const proxyUrl of proxies) {
                try {
                    const response = await axios.get(proxyUrl, { timeout: 5000 });
                    let data = response.data;

                    // Proxy formatını (AllOrigins) temizle
                    if (data && data.contents) {
                        try {
                            data = JSON.parse(data.contents);
                        } catch (e) { continue; }
                    }

                    // Veri yapısını kontrol et (internal API vs v2 API)
                    // Internal API direkt data.message içinde döndürebilir
                    pinnedMessage = data?.data?.message || data?.data?.pinned_message?.message || data?.message;
                    
                    if (pinnedMessage) {
                        successFound = true;
                        break;
                    }
                } catch (err) {
                    console.warn(`Proxy failed: ${proxyUrl}`);
                }
            }
        }

        return res.status(200).json({
            success: true,
            pinned_message: pinnedMessage || null
        });

    } catch (error) {
        return res.status(200).json({
            success: false,
            pinned_message: null,
            error: error.message
        });
    }
};
