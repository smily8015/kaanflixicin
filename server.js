const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.static('./')); // Dosyaları (index.html, script.js vs.) sunucu üzerinden yayınla

// Kick API URL şablonu
const getKickUrl = (channelId) => `https://kick.com/api/v2/channels/${channelId}/messages`;

app.get('/api/pinned/:channelId', async (req, res) => {
    const { channelId } = req.params;

    try {
        // console.log(`📡 Fetching: ${channelId}`);

        // Cloudflare'i aşmak için bir proxy üzerinden istek atıyoruz
        const targetUrl = `https://kick.com/api/v2/channels/${channelId}/messages`;
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;

        const response = await axios.get(proxyUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const pinnedMessage = response.data?.data?.pinned_message?.message;

        res.json({
            success: true,
            pinned_message: pinnedMessage || null
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: 'Kick API error',
            message: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`\n🚀 Kick Pinned Message Server running!`);
    console.log(`🔗 Local API: http://localhost:${PORT}/api/pinned/YOUR_CHANNEL_ID`);
    console.log(`___________________________________________________\n`);
});
