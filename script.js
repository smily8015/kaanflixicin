// CONFIGURATION
const CHANNEL_ID = '972395'; // Sayısal ID daha stabildir // kaanflix : 7522082 // parisdekibebeg : 972395
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? `http://localhost:3000/api/pinned/${CHANNEL_ID}`
    : `/api/pinned/${CHANNEL_ID}`;
const REFRESH_INTERVAL = 15000;

const container = document.getElementById('widget-container');
let lastMessageId = null;
let resolvedImages = {}; // Çözülmüş resim linklerini burada saklayacağız
let hideAttempts = 0; // Silinme onay sayacı
const MAX_HIDE_ATTEMPTS = 3; // Üst üste 3 kez boş gelirse sil

console.log(`🚀 Widget Başlatıldı. Kanal ID: ${CHANNEL_ID}`);

async function fetchPinnedMessage() {
    try {
        const response = await fetch(`${API_BASE}?t=${Date.now()}`);
        if (!response.ok) throw new Error("Yerel sunucuya bağlanılamadı");

        const data = await response.json();

        // Sadece başarılı bir sorgu geldiyse ve içinde mesaj yoksa silme işlemini başlat
        if (data.success === true && !data.pinned_message) {
            hideAttempts++;
            console.log(`⚠️ Mesaj bulunamadı, silme denemesi: ${hideAttempts}/${MAX_HIDE_ATTEMPTS}`);

            if (hideAttempts >= MAX_HIDE_ATTEMPTS && lastMessageId !== null) {
                console.log("ℹ️ Sabitlenmiş mesaj onaylanarak kaldırıldı");
                hideWidget();
            }
            return;
        }

        // Eğer mesaj varsa, sayaçları sıfırla ve devam et
        if (data.pinned_message) {
            hideAttempts = 0;
            const pinnedMsg = data.pinned_message;

            if (pinnedMsg.id === lastMessageId) {
                return; // Değişiklik yok
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
    const isBroadcaster = msg.sender?.identity?.badges?.some(b => b.type === 'broadcaster');

    const render = (finalImageUrl) => {
        let html = '';

        if (finalImageUrl) {
            // GÖRSEL VARSA: Üst üste düzen
            html = `
                <div class="pinned-message">
                    <div class="pinned-header">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12Z" />
                        </svg>
                        <span>SABİTLENMİŞ MESAJ</span>
                    </div>
                    <div class="username" style="color: ${userColor}">
                        ${username}
                    </div>
                    ${content ? `<div class="message-content">${content}</div>` : ''}
                    <div class="pinned-image-container">
                        <img src="${finalImageUrl}" alt="Sabitlenmiş Görsel">
                    </div>
                </div>
            `;
        } else {
            // SADECE METİN VARSA: Yan yana (Nickname: Mesaj) düzeni
            html = `
                <div class="pinned-message inline-mode">
                    <div class="pinned-header">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12Z" />
                        </svg>
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
            setTimeout(() => {
                container.innerHTML = html;
            }, 400);
        } else {
            container.innerHTML = html;
        }
    };

    async function fetchExternalImage(url, msgId, type) {
        // Eğer bu mesajın resmi zaten çözüldüyse hafızadan getir
        if (resolvedImages[msgId]) {
            render(resolvedImages[msgId]);
            return;
        }

        try {
            // Vercel Edge Function kullan - fluid, hızlı, CORS'süz
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const edgeBase = isLocal
                ? 'http://localhost:3000/api/resolve-image'
                : '/api/resolve-image';

            const edgeUrl = `${edgeBase}?url=${encodeURIComponent(url)}`;
            const res = await fetch(edgeUrl);
            const data = await res.json();

            if (data.success && data.directUrl) {
                console.log(`✅ ${type} - Edge Function'dan URL:`, data.directUrl);
                resolvedImages[msgId] = data.directUrl;
                render(data.directUrl);
            } else {
                console.log(`❌ ${type} - URL çözülemedi:`, data.error || 'Unknown error');
                render(null);
            }
        } catch (e) {
            console.error("Scraping error:", e);
            render(null);
        }
    }

    // IMAGE DETECTION LOGIC
    const imgRegex = /(https?:\/\/[^\s]+?\.(?:jpg|jpeg|png|gif|webp))/i;
    const hizliResimRegex = /https?:\/\/hizliresim\.com\/([a-zA-Z0-9]+)/i;
    const giphyRegex = /https?:\/\/giphy\.com\/gifs\/(?:.*-)?([a-zA-Z0-9]+)/i;
    const prntScRegex = /https?:\/\/prnt\.sc\/([a-zA-Z0-9_-]+)/i;

    let imageUrl = null;
    const imgMatch = content.match(imgRegex);
    const hizliMatch = content.match(hizliResimRegex);
    const giphyMatch = content.match(giphyRegex);
    const prntMatch = content.match(prntScRegex);

    if (hizliMatch) {
        content = content.replace(hizliMatch[0], '').trim();
        fetchExternalImage(hizliMatch[0], msg.id, 'hizli');
    } else if (giphyMatch) {
        imageUrl = `https://media.giphy.com/media/${giphyMatch[1]}/giphy.gif`;
        content = content.replace(giphyMatch[0], '').trim();
        render(imageUrl);
    } else if (prntMatch) {
        content = content.replace(prntMatch[0], '').trim();
        fetchExternalImage(prntMatch[0], msg.id, 'prnt');
    } else if (imgMatch) {
        imageUrl = imgMatch[0];
        content = content.replace(imgMatch[0], '').trim();
        render(imageUrl);
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
            resolvedImages = {}; // Mesaj silindiğinde hafızayı temizle
        }, 400);
    }
}

fetchPinnedMessage();
setInterval(fetchPinnedMessage, REFRESH_INTERVAL);

console.log("⏱️ Rafraîchissement toutes les 5 secondes...");