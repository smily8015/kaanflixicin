// Edge Function: Prnt.sc ve Hizliresim URL'lerini direkt görsel URL'sine çevirir
// Fluid/Edge'de çalışır, hızlı ve CORS'süz

export const config = {
    runtime: 'edge',
    regions: ['iad1', 'fra1', 'hkg1'] // Multi-region for speed
};

export default async function handler(request) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
        return new Response(JSON.stringify({ error: 'URL required' }), {
            status: 400,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }

    try {
        let directUrl = null;
        const type = getUrlType(targetUrl);

        if (type === 'hizli') {
            // Hizliresim: Direkt URL conversion
            const match = targetUrl.match(/hizliresim\.com\/([a-zA-Z0-9]+)/i);
            if (match) {
                directUrl = `https://i.hizliresim.com/${match[1]}.jpg`;
            }
        } else if (type === 'prnt') {
            // Prnt.sc: HTML fetch ve parse
            const response = await fetch(targetUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.0'
                }
            });

            if (response.ok) {
                const html = await response.text();

                // Parse img src from screenshot-image
                const imgMatch = html.match(/<img[^>]*id="screenshot-image"[^>]*src="([^"]+)"/i) ||
                    html.match(/<img[^>]*src="([^"]+)"[^>]*id="screenshot-image"/i) ||
                    html.match(/<img[^>]+src="([^"]*img\.lightshot\.app\/[^"]+)"/i) ||
                    html.match(/<img[^>]+src="([^"]*i\.prnt\.sc\/[^"]+)"/i);

                if (imgMatch) {
                    directUrl = imgMatch[1];
                    if (directUrl.startsWith('//')) directUrl = 'https:' + directUrl;
                }
            }
        } else if (type === 'direct') {
            directUrl = targetUrl;
        }

        if (!directUrl) {
            return new Response(JSON.stringify({ error: 'Could not resolve image URL' }), {
                status: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }

        // Cache for 1 hour on edge
        return new Response(JSON.stringify({
            success: true,
            originalUrl: targetUrl,
            directUrl: directUrl,
            type: type
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
            }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}

function getUrlType(url) {
    if (/hizliresim\.com\//i.test(url)) return 'hizli';
    if (/prnt\.sc\//i.test(url)) return 'prnt';
    if (/\.(jpg|jpeg|png|gif|webp)$/i.test(url)) return 'direct';
    return 'unknown';
}
