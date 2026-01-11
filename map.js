console.log('[MAP] Script loaded');
let map = null;
let marker = null;

// Initialize map with default location
function initMap(lat, lon, cityName, country) {
  console.log('[MAP] initMap called with:', lat, lon, cityName, country);
  
  // If map exists, just update position
  if (map && marker) {
    // Create bounds around the city (about 20km radius)
    const bounds = [
      [lat - 0.1, lon - 0.15], // Southwest corner
      [lat + 0.1, lon + 0.15]  // Northeast corner
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

  // Check if Leaflet is available
  if (typeof L === 'undefined') {
    console.error('[MAP] Leaflet library not loaded!');
    document.getElementById('map').innerHTML = '<div style="color: white; text-align: center; padding: 60px 20px;">Map library not loaded</div>';
    return;
  }

  console.log('[MAP] Creating map...');
  
  // Create bounds around the city (about 20km radius)
  const bounds = [
    [lat - 0.1, lon - 0.15], // Southwest corner
    [lat + 0.1, lon + 0.15]  // Northeast corner
  ];
  
  // Create new map - simple settings
  map = L.map('map', {
    zoomControl: true,
    scrollWheelZoom: true
  });
  
  // Fit to bounds instead of using center/zoom
  map.fitBounds(bounds, {
    padding: [20, 20]
  });

  console.log('[MAP] Adding tile layer...');
  // Add tile layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19
  }).addTo(map);

  console.log('[MAP] Adding marker...');
  // Add marker
  marker = L.marker([lat, lon]).addTo(map);
  marker.bindPopup(`
    <div style="text-align: center;">
      <b>${cityName}</b><br>
      ${country}
    </div>
  `).openPopup();

  // Invalidate size after map is created
  setTimeout(() => {
    if (map) {
      map.invalidateSize();
      // Don't re-fit bounds - let user zoom freely
    }
  }, 100);
  
  console.log('[MAP] Map initialized successfully');
}

// Listen for messages from parent window
window.addEventListener('message', (event) => {
  console.log('[MAP] Received message:', event.data);
  if (event.data && event.data.type === 'UPDATE_MAP') {
    const { lat, lon, cityName, country } = event.data;
    initMap(lat, lon, cityName, country);
  }
});

// Wait for page to load
console.log('[MAP] Waiting for location data from parent...');