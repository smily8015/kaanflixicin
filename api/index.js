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
        const targetUrl = `https://kick.com/api/v2/channels/${channelId}/messages?t=${Date.now()}`;
        
        // Proxy Listesi
        const proxies = [
            `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
            `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`
        ];

        let pinnedMessage = null;

        for (const proxyUrl of proxies) {
            try {
                const response = await axios.get(proxyUrl, { timeout: 5000 });
                let data = response.data;

                // AllOrigins formatı kontrolü
                if (data && data.contents) {
                    try {
                        data = JSON.parse(data.contents);
                    } catch (e) {
                        console.error("JSON parse error for proxy contents");
                        continue;
                    }
                }

                pinnedMessage = data?.data?.pinned_message?.message;
                if (pinnedMessage !== undefined) break; 
            } catch (err) {
                console.warn(`Proxy failed: ${proxyUrl}`);
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
