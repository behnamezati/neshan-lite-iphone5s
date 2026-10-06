// تنظیمات Neshan API
const NESHAN_API_KEY = 'web.YOUR_API_KEY'; // https://neshan.org وارد شوید و کلید بگیرید
const NESHAN_API_URL = 'https://api.neshan.org/v2/';

// متغیرهای نقشه
let map;
let userMarker;
let searchMarkers = [];
let routeLine;

// ایجاد نقشه
function initMap() {
    map = L.map('map').setView([35.6892, 51.3890], 13);
    
    // استفاده از OpenStreetMap (رایگان و سبک)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(map);
}

// تعویض تب‌ها
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');
}

// 🔍 جستجو کردن مکان
function searchPlace() {
    const query = document.getElementById('searchInput').value;
    
    if (!query) {
        alert('لطفاً متن جستجو را وارد کنید');
        return;
    }

    const url = `${NESHAN_API_URL}search/unified?q=${encodeURIComponent(query)}&key=${NESHAN_API_KEY}`;
    
    fetch(url)
        .then(response => response.json())
        .then(data => displaySearchResults(data))
        .catch(error => alert('خطا در جستجو: ' + error));
}

// نمایش نتایج جستجو
function displaySearchResults(data) {
    const resultsDiv = document.getElementById('searchResults');
    resultsDiv.innerHTML = '';
    
    if (!data.items || data.items.length === 0) {
        resultsDiv.innerHTML = '<p>نتیجه‌ای یافت نشد</p>';
        return;
    }

    // پاک کردن نشانگرهای قبلی
    searchMarkers.forEach(marker => map.removeLayer(marker));
    searchMarkers = [];

    data.items.slice(0, 10).forEach(item => {
        const resultDiv = document.createElement('div');
        resultDiv.className = 'result-item';
        resultDiv.innerHTML = `
            <strong>${item.title || 'بدون عنوان'}</strong><br>
            <small>${item.subtitle || ''}</small>
        `;
        
        resultDiv.onclick = () => {
            const lat = item.location.y;
            const lng = item.location.x;
            map.setView([lat, lng], 15);
            
            const marker = L.marker([lat, lng]).addTo(map)
                .bindPopup(`<strong>${item.title}</strong><br>${item.subtitle || ''}`);
            
            searchMarkers.push(marker);
            marker.openPopup();
        };
        
        resultsDiv.appendChild(resultDiv);
    });
}

// 📍 گرفتن موقعیت من
function getMyLocation() {
    const locationDiv = document.getElementById('locationInfo');
    locationDiv.innerHTML = 'در حال بدست آوردن موقعیت...';
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                
                // اضافه کردن نشانگر
                if (userMarker) map.removeLayer(userMarker);
                userMarker = L.marker([lat, lng], {
                    icon: L.icon({
                        iconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSI4IiBmaWxsPSIjNDI4YWYiLz48L3N2Zz4=',
                        iconSize: [24, 24],
                        iconAnchor: [12, 12]
                    })
                }).addTo(map).bindPopup('📍 موقعیت من');
                
                map.setView([lat, lng], 15);
                
                // نمایش مختصات
                locationDiv.innerHTML = `
                    <div class="info-item">
                        <strong>📍 موقعیت فعلی:</strong><br>
                        عرض جغرافیایی: ${lat.toFixed(6)}<br>
                        طول جغرافیایی: ${lng.toFixed(6)}<br>
                        <small>دقت: ${position.coords.accuracy.toFixed(0)} متر</small>
                    </div>
                `;
                
                // گرفتن نام آدرس (Reverse Geocoding)
                getReverseGeocode(lat, lng);
            },
            error => {
                locationDiv.innerHTML = `<p>❌ خطا: ${error.message}</p>`;
            }
        );
    } else {
        locationDiv.innerHTML = '<p>❌ مرورگر شما Geolocation را پشتیبانی نمی‌کند</p>';
    }
}

// معکوس شناسایی آدرس (Reverse Geocoding)
function getReverseGeocode(lat, lng) {
    const url = `${NESHAN_API_URL}reverse?lat=${lat}&lng=${lng}&key=${NESHAN_API_KEY}`;
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            const locationDiv = document.getElementById('locationInfo');
            const address = data.address ? data.address.address_line_1 : 'آدرس نامشخص';
            locationDiv.innerHTML += `
                <div class="info-item">
                    <strong>🏠 آدرس:</strong><br>
                    ${address}
                </div>
            `;
        })
        .catch(error => console.log('خطا در Reverse Geocoding:', error));
}

// 🚗 دریافت مسیر
function getRoute() {
    const fromInput = document.getElementById('fromInput').value;
    const toInput = document.getElementById('toInput').value;
    
    if (!fromInput || !toInput) {
        alert('لطفاً هر دو مکان را وارد کنید');
        return;
    }

    // ابتدا آدرس‌ها را جستجو کن
    geocodeAddress(fromInput, (fromCoords) => {
        geocodeAddress(toInput, (toCoords) => {
            if (fromCoords && toCoords) {
                drawRoute(fromCoords, toCoords);
            }
        });
    });
}

// تبدیل آدرس به مختصات
function geocodeAddress(address, callback) {
    const url = `${NESHAN_API_URL}search/unified?q=${encodeURIComponent(address)}&key=${NESHAN_API_KEY}`;
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.items && data.items.length > 0) {
                callback([data.items[0].location.y, data.items[0].location.x]);
            } else {
                alert(`آدرس "${address}" یافت نشد`);
                callback(null);
            }
        })
        .catch(error => console.log('خطا:', error));
}

// رسم مسیر روی نقشه
function drawRoute(from, to) {
    // پاک کردن مسیر قبلی
    if (routeLine) map.removeLayer(routeLine);
    
    // نشانگرها
    L.marker(from).addTo(map).bindPopup('نقطه شروع');
    L.marker(to).addTo(map).bindPopup('مقصد');
    
    // خط مسیر (خط سادە)
    routeLine = L.polyline([from, to], {
        color: 'blue',
        weight: 3,
        opacity: 0.7,
        dashArray: '5, 5'
    }).addTo(map);
    
    map.fitBounds(routeLine.getBounds());
    
    // محاسبه فاصله (تقریبی)
    const distance = map.distance(from, to) / 1000; // کیلومتر
    
    const routeDiv = document.getElementById('routeInfo');
    routeDiv.innerHTML = `
        <div class="info-item">
            <strong>🚗 مسیر:</strong><br>
            فاصله تقریبی: ${distance.toFixed(2)} کیلومتر<br>
            <small>⏱️ زمان تخمینی: ${Math.round(distance / 40)} دقیقه (با سرعت 40 کیلومتر)</small>
        </div>
    `;
}

// شروع اپ
window.addEventListener('load', () => {
    initMap();
});