// CONFIGURATION
const CHANNEL_ID = '972395'; // Sayısal ID daha stabildir // kaanflix : 7522082 // parisdekibebeg : 972395

// Hugging Face linkini buraya yapıştır (Sonunda / olmasın)
const HF_BACKEND_URL = 'https://kullaniciadi-spacename.hf.space'; 

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE = isLocal ? window.location.origin : HF_BACKEND_URL;

const API_PINNED = `${API_BASE}/api/pinned/${CHANNEL_ID}`;
const API_RESOLVE = `${API_BASE}/api/resolve-image`;
const REFRESH_INTERVAL = 5000;
const container = document.getElementById('widget-container');
let lastMessageId = null;
let resolvedImages = {}; // Çözülmüş resim linklerini burada saklayacağız
let hideAttempts = 0; // Silinme onay sayacı
const MAX_HIDE_ATTEMPTS = 2; // Üst üste 2 kez boş gelirse sil

console.log(`🚀 Widget Başlatıldı. Kanal ID: ${CHANNEL_ID}`);
console.log(`🔗 API_BASE: ${API_BASE}`);

async function fetchPinnedMessage() {
    try {
        const fetchUrl = `${API_PINNED}?t=${Date.now()}`;
        console.log(`📡 Fetching: ${fetchUrl}`);

        const response = await fetch(fetchUrl);
        console.log(`📥 Response status: ${response.status}`);

        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

        const data = await response.json();
        
        if (data.success === true) {
            if (data.pinned_message) {
                // Mesaj varsa göster
                hideAttempts = 0;
                const pinnedMsg = data.pinned_message;

                if (pinnedMsg.id === lastMessageId) {
                    return; // Aynı mesaj, değişiklik yok
                }

                console.log("📌 Yeni mesaj yüklendi:", pinnedMsg.content);
                lastMessageId = pinnedMsg.id;
                renderPinnedMessage(pinnedMsg);
            } else {
                // Pin kaldırılmış veya mesaj bulunamadı
                hideAttempts++;
                console.log(`⚪ Pin bulunamadı (${hideAttempts}/${MAX_HIDE_ATTEMPTS})`);
                
                if (hideAttempts >= MAX_HIDE_ATTEMPTS) {
                    hideWidget();
                }
            }
        }
    } catch (error) {
        console.error("❌ Bağlantı Hatası:", error.message);
        // Hata durumunda hemen silmiyoruz, bağlantı kopmuş olabilir
    }
}

function renderPinnedMessage(msg) {
    const username = msg.sender?.username;
    let content = msg.content || '';

    // Veri yoksa hiç render etme
    if (!username && !content) {
        console.log("⚠️ Mesaj verisi eksik - render atlanıyor");
        hideWidget();
        return;
    }

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
            // Resolve image API kullan
            const edgeUrl = `${API_RESOLVE}?url=${encodeURIComponent(url)}`;
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
        }, 400);
    } else {
        // Eski mesaj yoksa hemen temizle
        container.innerHTML = '';
    }
    lastMessageId = null;
    resolvedImages = {}; // Mesaj silindiğinde hafızayı temizle
}

fetchPinnedMessage();
setInterval(fetchPinnedMessage, REFRESH_INTERVAL);

console.log("⏱️ Rafraîchissement toutes les 5 secondes...");