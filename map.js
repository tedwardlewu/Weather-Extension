console.log('[MAP] Script loaded');
let map = null;
let marker = null;

function initMap(lat, lon, cityName, country) {
  console.log('[MAP] initMap called with:', lat, lon, cityName, country);
  
 
  if (map && marker) {

    const bounds = [
      [lat - 0.1, lon - 0.15],
      [lat + 0.1, lon + 0.15]  
    ];
    
    map.fitBounds(bounds, {
      padding: [20, 20],
      animate: false
    });
    
    marker.setLatLng([lat, lon]);
    marker.setPopupContent(`
      <div style="text-align: center;">
        <b>${cityName}</b><br>
        ${country}
      </div>
    `).openPopup();
    return;
  }

  if (typeof L === 'undefined') {
    console.error('[MAP] Leaflet library not loaded!');
    document.getElementById('map').innerHTML = '<div style="color: white; text-align: center; padding: 60px 20px;">Map library not loaded</div>';
    return;
  }

  console.log('[MAP] Creating map...');
  
  const bounds = [
    [lat - 0.1, lon - 0.15], 
    [lat + 0.1, lon + 0.15]  
  ];
  
  map = L.map('map', {
    zoomControl: true,
    scrollWheelZoom: true
  });
  
  map.fitBounds(bounds, {
    padding: [20, 20]
  });

  console.log('[MAP] Adding tile layer...');
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19
  }).addTo(map);

  console.log('[MAP] Adding marker...');

  marker = L.marker([lat, lon]).addTo(map);
  marker.bindPopup(`
    <div style="text-align: center;">
      <b>${cityName}</b><br>
      ${country}
    </div>
  `).openPopup();

  setTimeout(() => {
    if (map) {
      map.invalidateSize();
    
    }
  }, 100);
  
  console.log('[MAP] Map initialized successfully');
}

window.addEventListener('message', (event) => {
  console.log('[MAP] Received message:', event.data);
  if (event.data && event.data.type === 'UPDATE_MAP') {
    const { lat, lon, cityName, country } = event.data;
    initMap(lat, lon, cityName, country);
  }
});

console.log('[MAP] Waiting for location data from parent...');