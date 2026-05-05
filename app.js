// Inicializacion del mapa
const map = L.map('map', {
    maxZoom: 22,
    zoomSnap: 0.5
}).setView([-12.04637, -77.04279], 13);
const defaultHomeView = {
    center: [-12.04637, -77.04279],
    zoom: 13
};
let homeBounds = null;

const recorridosListElement = document.getElementById('recorridosList');
const recorridosPanelElement = document.getElementById('recorridosPanel');
const toggleRecorridosPanelButton = document.getElementById('toggleRecorridosPanel');

const baseLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxNativeZoom: 19,
    maxZoom: 22
}).addTo(map);

const satelliteBaseLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles © Esri',
    maxNativeZoom: 19,
    maxZoom: 22
});

const baseFilter = 'ESTADO = 2 AND ACTIVO = 1';
const urlParams = new URLSearchParams(window.location.search);
const ubigeoParam = urlParams.get('ubigeo');
const idSolicitudParam = urlParams.get('id_solicitud');

function sanitizeSqlValue(value, isNumeric = false) {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    if (isNumeric) {
        return /^-?\d+(\.\d+)?$/.test(value) ? value : null;
    }

    return `'${String(value).replace(/'/g, "''")}'`;
}

function buildWhere(extraClauses = []) {
    return [baseFilter, ...extraClauses.filter(Boolean)].join(' AND ');
}

const ubigeoClause = ubigeoParam ? `UBIGEO = ${sanitizeSqlValue(ubigeoParam)}` : '';
const idSolicitudValue = sanitizeSqlValue(idSolicitudParam, true);
const idSolicitudClause = idSolicitudValue ? `ID_SOLICITUD = ${idSolicitudValue}` : '';
const limitesFilter = ubigeoClause || '1=1';

function setRecorridosPanelCollapsed(collapsed) {
    document.body.classList.toggle('panel-collapsed', collapsed);

    if (toggleRecorridosPanelButton) {
        toggleRecorridosPanelButton.textContent = collapsed ? 'Expandir' : 'Minimizar';
        toggleRecorridosPanelButton.setAttribute('aria-expanded', String(!collapsed));
    }

    window.setTimeout(() => map.invalidateSize(), 280);
}

if (recorridosPanelElement && toggleRecorridosPanelButton) {
    toggleRecorridosPanelButton.addEventListener('click', () => {
        const collapsed = !document.body.classList.contains('panel-collapsed');
        setRecorridosPanelCollapsed(collapsed);
    });
}

const layer0Filter = buildWhere([ubigeoClause]);
const layer1Filter = buildWhere([ubigeoClause]);
const layer2Filter = buildWhere([ubigeoClause, idSolicitudClause]);

const arancelStyle = {
    color: '#ff8c00',
    weight: 4,
    fillColor: '#ff8c00',
    fillOpacity: 0.25
};

// Capas ESRI en el orden solicitado: 0, 1, 2
const esriLayer0 = L.esri.featureLayer({
    url: 'https://ws.mineco.gob.pe/serverdf/rest/services/pruebas/inspeccion_ocular/MapServer/0',
    where: layer0Filter,
    onEachFeature: (feature, layer) => {
        const properties = feature?.properties || layer?.feature?.properties;
        const nombre = getFieldValue(properties, ['nombre', 'NOMBRE']);
        const tipoRecorrido = Number(getFieldValue(properties, ['tipo_recorrido', 'TIPO_RECORRIDO']));

        if (nombre === null || nombre === '') {
            return;
        }

        const prefix = tipoRecorrido === 1 ? 'ini: ' : (tipoRecorrido === 2 ? 'fin: ' : '');

        layer.bindTooltip(`${prefix}${String(nombre)}`, {
            direction: 'top',
            offset: [0, -8],
            permanent: true,
            className: 'map-label'
        });
    }
}).addTo(map);

const esriLayer1 = L.esri.featureLayer({
    url: 'https://ws.mineco.gob.pe/serverdf/rest/services/pruebas/inspeccion_ocular/MapServer/1',
    where: layer1Filter,
    style: () => arancelStyle,
    onEachFeature: (feature, layer) => {
        bindLineLabel(layer, feature, ['val_act', 'VAL_ACT'], {
            fill: '#ff8c00'
        });
    },
    pointToLayer: (_, latlng) => L.circleMarker(latlng, {
        radius: 6,
        color: '#ff8c00',
        fillColor: '#ff8c00',
        fillOpacity: 0.9,
        weight: 1.5
    })
}).addTo(map);

const esriLayer2 = L.esri.featureLayer({
    url: 'https://ws.mineco.gob.pe/serverdf/rest/services/pruebas/inspeccion_ocular/MapServer/2',
    where: layer2Filter,
    onEachFeature: (feature, layer) => {
        bindLineLabel(layer, feature, ['nombre', 'NOMBRE'], {
            fill: '#2f6db3'
        });
    },
    style: () => ({
        color: '#2f6db3',
        weight: 4
    })
}).addTo(map);

function getGeometryBounds(feature) {
    if (!feature || !feature.geometry) {
        return null;
    }

    const geometryLayer = L.geoJSON(feature);
    const bounds = geometryLayer.getBounds();
    return bounds && bounds.isValid() ? bounds : null;
}

function setRecorridosEmptyState(message) {
    if (!recorridosListElement) {
        return;
    }

    recorridosListElement.innerHTML = `<div class="recorridos-empty">${message}</div>`;
}

function getFeatureProperties(feature) {
    return feature?.properties || feature?.attributes || null;
}

function renderRecorridosList(features) {
    if (!recorridosListElement) {
        return;
    }

    if (!features || features.length === 0) {
        setRecorridosEmptyState('No hay recorridos para los filtros actuales.');
        return;
    }

    const sortedFeatures = [...features].sort((a, b) => {
        const aValue = Number(getFieldValue(getFeatureProperties(a), ['id_recorrido', 'ID_RECORRIDO']) || 0);
        const bValue = Number(getFieldValue(getFeatureProperties(b), ['id_recorrido', 'ID_RECORRIDO']) || 0);
        return aValue - bValue;
    });

    const html = sortedFeatures
        .map((feature, index) => {
            const nombre = getFieldValue(getFeatureProperties(feature), ['nombre', 'NOMBRE']) || 'Sin nombre';
            const idRecorrido = getFieldValue(getFeatureProperties(feature), ['id_recorrido', 'ID_RECORRIDO']);
            const bounds = getGeometryBounds(feature);

            if (!bounds) {
                return '';
            }

            const southWest = bounds.getSouthWest();
            const northEast = bounds.getNorthEast();
            const boundsPayload = [southWest.lat, southWest.lng, northEast.lat, northEast.lng].join(',');
            const idRecorridoPayload = idRecorrido !== null && idRecorrido !== undefined ? String(idRecorrido) : '';

            return `<button type="button" class="recorrido-item" data-bounds="${boundsPayload}" data-id-recorrido="${idRecorridoPayload}">Recorrido ${index + 1}: ${String(nombre)}</button>`;
        })
        .join('');

    recorridosListElement.innerHTML = html || '<div class="recorridos-empty">No hay recorridos para los filtros actuales.</div>';

    recorridosListElement.querySelectorAll('.recorrido-item').forEach((item) => {
        const ensureSelectedState = () => {
            recorridosListElement.querySelectorAll('.recorrido-item').forEach((row) => row.classList.remove('is-selected'));
            item.classList.add('is-selected');
        };

        const ensureLoadingState = () => {
            ensureSelectedState();

            if (item.classList.contains('is-loading')) {
                return Number(item.dataset.loadingToken || 0);
            }

            const requestToken = beginRecorridoSelectionLoading(item);
            item.dataset.loadingToken = String(requestToken);
            return requestToken;
        };

        const activateRecorridoItem = () => {
            const rawBounds = item.getAttribute('data-bounds');
            if (!rawBounds) {
                return;
            }

            const requestToken = ensureLoadingState();
            const bounds = parseBoundsPayload(rawBounds);
            if (bounds && bounds.isValid()) {
                    if (!KEEP_RECORRIDO_LOADER_DURING_ZOOM) {
                        finishRecorridoSelectionLoadingOnMapMove(item, requestToken);
                    }
                map.fitBounds(bounds.pad(0.2), { maxZoom: 19 });
                return;
            }

            finishRecorridoSelectionLoading(item, requestToken);
        };

        item.addEventListener('touchstart', (event) => {
            const touch = event.touches[0];
            item.dataset.touchStartX = String(touch.clientX);
            item.dataset.touchStartY = String(touch.clientY);
            item.dataset.touchMoved = '0';
        }, { passive: true });

        item.addEventListener('touchmove', () => {
            item.dataset.touchMoved = '1';
        }, { passive: true });

        item.addEventListener('touchend', (event) => {
            if (item.dataset.touchMoved === '1') {
                delete item.dataset.touchStartX;
                delete item.dataset.touchStartY;
                delete item.dataset.touchMoved;
                return;
            }

            event.preventDefault();
            delete item.dataset.touchStartX;
            delete item.dataset.touchStartY;
            delete item.dataset.touchMoved;
            item.dataset.touchActivatedAt = String(Date.now());
            ensureLoadingState();
            activateRecorridoItem();
        }, { passive: false });

        item.addEventListener('touchcancel', () => {
            delete item.dataset.touchStartX;
            delete item.dataset.touchStartY;
            delete item.dataset.touchMoved;

            const requestToken = Number(item.dataset.loadingToken || 0);
            if (requestToken) {
                finishRecorridoSelectionLoading(item, requestToken);
            }
        });

        item.addEventListener('mousedown', () => {
            ensureLoadingState();
        });

        item.addEventListener('click', () => {
            const touchActivatedAt = Number(item.dataset.touchActivatedAt || 0);
            if (touchActivatedAt && (Date.now() - touchActivatedAt) < 900) {
                return;
            }

            activateRecorridoItem();
        });
    });
}

let activeRecorridoSelectionRequestToken = 0;
const KEEP_RECORRIDO_LOADER_DURING_ZOOM = false;

function parseBoundsPayload(rawBounds) {
    if (!rawBounds) {
        return null;
    }

    const [south, west, north, east] = rawBounds.split(',').map(Number);
    const bounds = L.latLngBounds([south, west], [north, east]);
    return bounds.isValid() ? bounds : null;
}

function beginRecorridoSelectionLoading(item) {
    activeRecorridoSelectionRequestToken += 1;
    const requestToken = activeRecorridoSelectionRequestToken;

    if (recorridosListElement) {
        recorridosListElement.classList.add('is-loading');
        recorridosListElement.setAttribute('aria-busy', 'true');
    }

    if (item) {
        item.classList.add('is-loading');
        item.setAttribute('aria-busy', 'true');
    }

    return requestToken;
}

function finishRecorridoSelectionLoading(item, requestToken) {
    if (item) {
        item.classList.remove('is-loading');
        item.removeAttribute('aria-busy');
        delete item.dataset.loadingToken;
    }

    if (requestToken !== activeRecorridoSelectionRequestToken) {
        return;
    }

    if (recorridosListElement) {
        recorridosListElement.classList.remove('is-loading');
        recorridosListElement.removeAttribute('aria-busy');
    }
}

function finishRecorridoSelectionLoadingOnMapMove(item, requestToken) {
    const completeLoading = () => {
        map.off('moveend', onMoveEnd);
        if (fallbackTimer) {
            window.clearTimeout(fallbackTimer);
        }
        finishRecorridoSelectionLoading(item, requestToken);
    };

    const onMoveEnd = () => {
        completeLoading();
    };

    let fallbackTimer = window.setTimeout(() => {
        completeLoading();
    }, 1500);

    map.once('moveend', onMoveEnd);
}

function loadRecorridosList() {
    if (!recorridosListElement) {
        return;
    }

    setRecorridosEmptyState('Cargando recorridos...');

    esriLayer2
        .query()
        .where(layer2Filter)
        .run((error, featureCollection) => {
            if (error) {
                setRecorridosEmptyState('No se pudo cargar la lista de recorridos.');
                return;
            }

            const features = featureCollection?.features || [];
            renderRecorridosList(features);
        });
}

const limitesLayer = L.esri.featureLayer({
    url: 'https://ws.mineco.gob.pe/serverdf/rest/services/pruebas/limites_nacional/MapServer/2',
    where: limitesFilter,
    style: () => ({
        color: '#37474f',
        weight: 2,
        fillColor: '#90a4ae',
        fillOpacity: 0.08
    })
}).addTo(map);

if (ubigeoParam) {
    limitesLayer.query().where(limitesFilter).bounds((error, bounds) => {
        if (!error && bounds && bounds.isValid()) {
            homeBounds = bounds.pad(0.15);
            map.fitBounds(homeBounds);
        }
    });
}

loadRecorridosList();

function getFieldValue(properties, candidateFields) {
    if (!properties) {
        return null;
    }

    for (const field of candidateFields) {
        if (properties[field] !== undefined && properties[field] !== null) {
            return properties[field];
        }

        const matchedKey = Object.keys(properties).find((key) => key.toLowerCase() === field.toLowerCase());
        if (matchedKey && properties[matchedKey] !== undefined && properties[matchedKey] !== null) {
            return properties[matchedKey];
        }
    }

    return null;
}

function bindFeatureLabel(layer, feature, candidateFields, tooltipOptions) {
    const properties = feature?.properties || layer?.feature?.properties;
    const value = getFieldValue(properties, candidateFields);

    if (value === null || value === '') {
        return;
    }

    layer.bindTooltip(String(value), {
        permanent: true,
        className: 'map-label',
        ...tooltipOptions
    });
}

function bindLineLabel(layer, feature, candidateFields, textStyle = {}) {
    const properties = feature?.properties || layer?.feature?.properties;
    const value = getFieldValue(properties, candidateFields);

    if (value === null || value === '') {
        return;
    }

    if (layer instanceof L.Polyline && typeof layer.setText === 'function') {
        layer.setText(String(value), {
            center: true,
            repeat: false,
            orientation: 0,
            offset: 0,
            attributes: {
                'font-size': '16px',
                'font-weight': '700',
                stroke: '#ffffff',
                'stroke-width': 3,
                'paint-order': 'stroke',
                ...textStyle
            }
        });
        return;
    }

    bindFeatureLabel(layer, feature, candidateFields, {
        direction: 'center'
    });
}

L.control.layers(
    {
        'OpenStreetMap': baseLayer,
        'Satelital (Esri)': satelliteBaseLayer
    },
    {
        'Puntos de inicio y fin': esriLayer0,
        'Aranceles': esriLayer1,
        'Recorrido': esriLayer2,
        'Limites Nacional': limitesLayer
    }
).addTo(map);

let marker;
let circle;
let watchId;
let isTracking = false;
let homeControlButton;
let trackingControlButton;
const homeIconUrl = 'lib/images/home.png';
const trackingIconUrl = 'lib/images/my-location.svg';
const liveLocationIcon = L.divIcon({
    className: 'live-location-icon',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: '<span class="live-location-core"></span><span class="live-location-pulse"></span>'
});

const HomeControl = L.Control.extend({
    options: {
        position: 'bottomright'
    },
    onAdd: function onAddHomeControl() {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-home');
        homeControlButton = L.DomUtil.create('a', '', container);
        homeControlButton.href = '#';
        homeControlButton.title = 'Volver a vista inicial';
        homeControlButton.setAttribute('role', 'button');
        homeControlButton.setAttribute('aria-label', 'Volver a vista inicial');
        homeControlButton.innerHTML = `<img src="${homeIconUrl}" alt="" class="leaflet-control-icon" />`;

        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.on(homeControlButton, 'click', (event) => {
            L.DomEvent.preventDefault(event);

            if (homeBounds && homeBounds.isValid()) {
                map.fitBounds(homeBounds);
                return;
            }

            map.setView(defaultHomeView.center, defaultHomeView.zoom);
        });

        return container;
    }
});

const TrackingControl = L.Control.extend({
    options: {
        position: 'bottomright'
    },
    onAdd: function onAddControl() {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-tracking');
        trackingControlButton = L.DomUtil.create('a', '', container);
        trackingControlButton.href = '#';
        trackingControlButton.title = 'Iniciar seguimiento';
        trackingControlButton.setAttribute('role', 'button');
        trackingControlButton.setAttribute('aria-label', 'Iniciar seguimiento');
        updateTrackingControlUI();

        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.on(trackingControlButton, 'click', (event) => {
            L.DomEvent.preventDefault(event);
            if (!isTracking) {
                startTracking();
            } else {
                stopTracking();
            }
        });

        return container;
    }
});

map.addControl(new TrackingControl());
map.addControl(new HomeControl());

function updateTrackingControlUI() {
    if (!trackingControlButton) {
        return;
    }

    trackingControlButton.classList.toggle('is-active', isTracking);

    if (isTracking) {
        trackingControlButton.innerHTML = '<span class="leaflet-control-stop-icon" aria-hidden="true"></span>';
    } else {
        trackingControlButton.innerHTML = `<img src="${trackingIconUrl}" alt="" class="leaflet-control-icon leaflet-control-location-icon" />`;
    }

    trackingControlButton.title = isTracking ? 'Detener seguimiento' : 'Iniciar seguimiento';
    trackingControlButton.setAttribute('aria-label', trackingControlButton.title);
}

function onLocationSuccess(position) {
    const { latitude, longitude, accuracy } = position.coords;
    const latlng = [latitude, longitude];

    if (!marker) {
        marker = L.marker(latlng, { icon: liveLocationIcon }).addTo(map);
        circle = L.circle(latlng, {
            radius: accuracy,
            color: '#1b8f3a',
            weight: 1.5,
            fillColor: '#2fbf56',
            fillOpacity: 0.12
        }).addTo(map);
        map.setView(latlng, 16);
    } else {
        marker.setLatLng(latlng);
        circle.setLatLng(latlng);
        circle.setRadius(accuracy);
    }

    map.panTo(latlng);
}

function onLocationError(error) {
    alert('Error al obtener ubicacion: ' + error.message);
    stopTracking();
}

function startTracking() {
    if ('geolocation' in navigator) {
        isTracking = true;
        updateTrackingControlUI();

        watchId = navigator.geolocation.watchPosition(onLocationSuccess, onLocationError, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        });
    } else {
        alert('Tu navegador no soporta geolocalizacion');
    }
}

function stopTracking() {
    isTracking = false;
    updateTrackingControlUI();

    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
}
