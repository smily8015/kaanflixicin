const axios = require('axios');

module.exports = async (req, res) => {
    // CORS ayarları
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { pathname } = new URL(req.url, `http://${req.headers.host}`);
    const channelId = pathname.split('/').pop();

    if (!channelId || channelId === 'index.js') {
        return res.status(400).json({ success: false, error: 'Channel ID is required' });
    }

    try {
        const targetUrl = `https://kick.com/api/v2/channels/${channelId}/messages`;
        
        // Denenecek Proxy Listesi
        const proxies = [
            `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
            `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`
        ];

        let lastError = null;
        let pinnedMessage = null;

        for (const proxyUrl of proxies) {
            try {
                console.log(`📡 Trying proxy: ${proxyUrl}`);
                const response = await axios.get(proxyUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    },
                    timeout: 4000
                });

                // AllOrigins formatı farklıdır (data.contents), corsproxy direkt veri döndürür
                const data = response.data.contents ? JSON.parse(response.data.contents) : response.data;
                pinnedMessage = data?.data?.pinned_message?.message;
                
                if (pinnedMessage !== undefined) break; // Başarılıysa döngüden çık
            } catch (err) {
                console.warn(`⚠️ Proxy failed: ${err.message}`);
                lastError = err;
            }
        }

        res.status(200).json({
            success: true,
            pinned_message: pinnedMessage || null,
            error: pinnedMessage === null ? 'No pinned message found' : null
        });

    } catch (error) {
        console.error('❌ Vercel API Critical Error:', error.message);
        res.status(200).json({
            success: false,
            error: 'Kick API error',
            message: error.message,
            pinned_message: null
        });
    }
};
