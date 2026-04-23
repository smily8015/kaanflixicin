const axios = require('axios');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ success: false, error: 'URL is required' });
    }

    try {
        let directUrl = null;

        // Hızlı Resim
        if (url.includes('hizliresim.com')) {
            const response = await axios.get(url, { timeout: 8000 });
            const html = response.data;
            const match = html.match(/property="og:image" content="([^"]+)"/) || 
                          html.match(/<img[^>]+src="([^">]+i\.hizliresim\.com\/[^">]+)"/);
            if (match) directUrl = match[1];
        } 
        // Prnt.sc (Lightshot)
        else if (url.includes('prnt.sc')) {
            const response = await axios.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                timeout: 8000
            });
            const html = response.data;
            const match = html.match(/id="screenshot-image"[^>]*src="([^"]+)"/) ||
                          html.match(/property="og:image" content="([^"]+)"/);
            if (match) directUrl = match[1];
        }
        // Direkt Resim
        else if (/\.(jpg|jpeg|png|gif|webp)/i.test(url)) {
            directUrl = url;
        }

        if (directUrl) {
            if (directUrl.startsWith('//')) directUrl = 'https:' + directUrl;
            return res.status(200).json({ success: true, directUrl });
        }

        return res.status(404).json({ success: false, error: 'Could not resolve image' });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};
