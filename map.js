console.log('[MAP] Script loaded');
let map = null;
let marker = null;

// Wait for container to have dimensions before initializing
function waitForContainer(callback) {
  const container = document.getElementById('map');
  if (!container) {
    console.error('[MAP] Map container not found!');
    return;
  }
  
  // Check if container has dimensions
  const checkDimensions = () => {
    const width = container.offsetWidth;
    const height = container.offsetHeight;
    console.log('[MAP] Container dimensions:', width, 'x', height);
    
    if (width > 0 && height > 0) {
      console.log('[MAP] Container ready with dimensions');
      callback();
    } else {
      console.log('[MAP] Container not ready, retrying...');
      setTimeout(checkDimensions, 50);
    }
  };
  
  checkDimensions();
}

// Initialize map with default location
function initMap(lat, lon, cityName, country) {
  console.log('[MAP] initMap called with:', lat, lon, cityName, country);
  
  // If map exists, just update position
  if (map && marker) {
    console.log('[MAP] Updating existing map');
    map.setView([lat, lon], map.getZoom(), { animate: true });
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

  // Wait for container to be ready
  waitForContainer(() => {
    console.log('[MAP] Creating map...');
    
    // Create new map
    map = L.map('map', {
      center: [lat, lon],
      zoom: 12,
      zoomControl: true,
      scrollWheelZoom: true,
      trackResize: true
    });

    console.log('[MAP] Adding tile layer...');
    
    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
      subdomains: ['a', 'b', 'c']
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

    // Critical: Force Leaflet to recalculate everything
    setTimeout(() => {
      if (map) {
        console.log('[MAP] Forcing size recalculation');
        map.invalidateSize({ pan: false });
        map.setView([lat, lon], 12);
      }
    }, 100);
    
    setTimeout(() => {
      if (map) {
        console.log('[MAP] Second size recalculation');
        map.invalidateSize({ pan: false });
      }
    }, 300);
    
    console.log('[MAP] Map initialized successfully');
  });
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
