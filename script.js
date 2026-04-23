// CONFIGURATION
const CHANNEL_ID = '972395'; // Sayısal ID daha stabildir
const REFRESH_INTERVAL = 15000;

// Dinamik base URL - Vercel'de relative path kullanır
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BASE_PATH = isLocal ? `http://localhost:7860` : ''; // Python portun 7860 ise
const API_BASE = `${BASE_PATH}/api/pinned/${CHANNEL_ID}`;

const container = document.getElementById('widget-container');
let lastMessageId = null;
let resolvedImages = {};

console.log(`🚀 Widget Başlatıldı. Kanal ID: ${CHANNEL_ID}`);

async function fetchPinnedMessage() {
    try {
        const response = await fetch(`${API_BASE}?t=${Date.now()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        
        // Eğer mesaj gelirse işle, gelmezse (null ise) hiçbir şey yapma (eski mesaj kalsın)
        if (data.success === true && data.pinned_message) {
            const pinnedMsg = data.pinned_message;

            if (pinnedMsg.id === lastMessageId) {
                return; // Aynı mesaj, değişiklik yok
            }

            console.log("📌 Yeni mesaj yüklendi:", pinnedMsg.content);
            lastMessageId = pinnedMsg.id;
            renderPinnedMessage(pinnedMsg);
        }
    } catch (error) {
        console.error("❌ Bağlantı Hatası:", error.message);
    }
}

function renderPinnedMessage(msg) {
    const username = msg.sender?.username || 'Anonim';
    let content = msg.content || '';

    const userColor = msg.sender?.identity?.color || '#53fc18';

    const render = (finalImageUrl) => {
        let html = '';
        if (finalImageUrl) {
            html = `
                <div class="pinned-message">
                    <div class="pinned-header">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12Z" /></svg>
                        <span>SABİTLENMİŞ MESAJ</span>
                    </div>
                    <div class="username" style="color: ${userColor}">${username}</div>
                    ${content ? `<div class="message-content">${content}</div>` : ''}
                    <div class="pinned-image-container">
                        <img src="${finalImageUrl}" alt="Görsel">
                    </div>
                </div>
            `;
        } else {
            html = `
                <div class="pinned-message inline-mode">
                    <div class="pinned-header">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12Z" /></svg>
                        <span>SABİTLENMİŞ MESAJ</span>
                    </div>
                    <div class="inline-content">
                        <span class="username" style="color: ${userColor}">${username}:</span>
                        <span class="message-content">${content}</span>
                    </div>
                </div>
            `;
        }

        const oldMsg = container.querySelector('.pinned-message');
        if (oldMsg) {
            oldMsg.classList.add('fade-out');
            setTimeout(() => { container.innerHTML = html; }, 400);
        } else {
            container.innerHTML = html;
        }
    };

    async function resolveExternalImage(url, msgId) {
        if (resolvedImages[msgId]) {
            render(resolvedImages[msgId]);
            return;
        }

        try {
            const resolveUrl = `${BASE_PATH}/api/resolve-image?url=${encodeURIComponent(url)}`;
            const res = await fetch(resolveUrl);
            const data = await res.json();

            if (data.success && data.directUrl) {
                resolvedImages[msgId] = data.directUrl;
                render(data.directUrl);
            } else {
                render(null);
            }
        } catch (e) {
            render(null);
        }
    }

    const imgRegex = /(https?:\/\/[^\s]+?\.(?:jpg|jpeg|png|gif|webp))/i;
    const hizliResimRegex = /https?:\/\/hizliresim\.com\/[a-zA-Z0-9]+/i;
    const giphyRegex = /https?:\/\/giphy\.com\/gifs\/(?:.*-)?([a-zA-Z0-9]+)/i;
    const prntScRegex = /https?:\/\/prnt\.sc\/[a-zA-Z0-9_-]+/i;

    const imgMatch = content.match(imgRegex);
    const hizliMatch = content.match(hizliResimRegex);
    const giphyMatch = content.match(giphyRegex);
    const prntMatch = content.match(prntScRegex);

    if (hizliMatch) {
        content = content.replace(hizliMatch[0], '').trim();
        resolveExternalImage(hizliMatch[0], msg.id);
    } else if (giphyMatch) {
        let giphyId = giphyMatch[1];
        let directUrl = `https://media.giphy.com/media/${giphyId}/giphy.gif`;
        content = content.replace(giphyMatch[0], '').trim();
        render(directUrl);
    } else if (prntMatch) {
        content = content.replace(prntMatch[0], '').trim();
        resolveExternalImage(prntMatch[0], msg.id);
    } else if (imgMatch) {
        content = content.replace(imgMatch[0], '').trim();
        render(imgMatch[0]);
    } else {
        render(null);
    }
}

function hideWidget() {
    const oldMsg = container.querySelector('.pinned-message');
    if (oldMsg) {
        oldMsg.classList.add('fade-out');
        setTimeout(() => {
            container.innerHTML = '';
            lastMessageId = null;
            resolvedImages = {};
        }, 400);
    }
}

fetchPinnedMessage();
setInterval(fetchPinnedMessage, REFRESH_INTERVAL);
console.log("⏱️ Rafraîchissement toutes les 15 secondes...");