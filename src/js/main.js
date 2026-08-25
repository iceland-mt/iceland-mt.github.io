var map = L.map('map', {
    zoom: 9,
    minZoom: 7,      // (optional) prevents zooming in beyond level 19
    center: L.latLng([63.93, -21.86]), // Reykjanes peninsula, Iceland
    attributionControl: true,
    contextmenu: true,
    contextmenuWidth: 180,
    contextmenuItems: [{
        text: 'Copy coordinates (Lat, Long)',
        callback: copyCoordinates
    }],
    fullscreenControl: true,
    fullscreenControlOptions: {
        position: 'topleft',
    },
});

function copyCoordinates(event) {
    const coordinates = `${event.latlng.lat.toFixed(6)}, ${event.latlng.lng.toFixed(6)}`;

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(coordinates)
            .then(function () {
                notification.success('Copied', coordinates);
            })
            .catch(function () {
                copyCoordinatesFallback(coordinates);
            });
        return;
    }

    copyCoordinatesFallback(coordinates);
}

function copyCoordinatesFallback(coordinates) {
    const textArea = document.createElement('textarea');
    textArea.value = coordinates;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();

    try {
        if (document.execCommand('copy')) {
            notification.success('Copied', coordinates);
        } else {
            notification.alert('Copy failed', 'Unable to copy coordinates');
        }
    } catch (error) {
        notification.alert('Copy failed', 'Unable to copy coordinates');
    }

    document.body.removeChild(textArea);
}

L.control.locate().addTo(map);

map.attributionControl.setPrefix('<a href="https://leafletjs.com" title="A JavaScript library for interactive maps">Leaflet ' + L.version + '</a>');

map.addControl(new L.Control.LinearMeasurement({
    unitSystem: 'metric',
    color: '#FF0080',
    type: 'line'
}));

// var hash = new L.Hash(map);

var notification = L.control
    .notifications({
        className: 'pastel',
        timeout: 5000,
        position: 'topleft',
        closable: true,
        dismissable: true,
    })
    .addTo(map);

L.Control.geocoder({ position: "topleft", showResultIcons: true }).addTo(map);

L.Control.betterFileLayer({
    fileSizeLimit: 60240, // File size limit in kb (10 MB)),
    text: { // If you need translate
        title: "Import a file (Max 60 MB)", // Plugin Button Text
    },
}).addTo(map);


L.control.scale(
    {
        imperial: false,
    }).addTo(map);


// var browserControl = L.control.browserPrint({ position: 'topleft', title: 'Print Map' }).addTo(map);

map.on("bfl:layerloaded", function () { notification.success('Success', 'Data loaded successfully'); })
map.on("bfl:layerloaderror", function () { notification.alert('Error', 'Unable to load file'); })
map.on("bfl:filenotsupported", function () { notification.alert('Error', 'File type not supported'); })
map.on("bfl:layerisempty", function () { notification.warning('Error', 'No features in file'); })
map.on("bfl:filesizelimit", function () { notification.alert('Error', 'Maximun file size allowed is 60 MB'); })


var routingControl = null;


L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

var layers = [];
for (var providerId in providers) {
    layers.push(providers[providerId]);
}

//  Add navigation
map.on('popupopen', function (e) {
    const link = e.popup._contentNode.querySelector('.navigate-link');
    if (link) {
        link.addEventListener('click', function (event) {
            event.preventDefault();

            const lat = parseFloat(this.dataset.lat);
            const lng = parseFloat(this.dataset.lng);
            const destination = L.latLng(lat, lng);

            if (routingControl !== null) {
                map.removeControl(routingControl);
            }

            navigator.geolocation.getCurrentPosition(function (pos) {
                const userLatLng = L.latLng(pos.coords.latitude, pos.coords.longitude);

                routingControl = L.Routing.control({
                    waypoints: [
                        userLatLng,
                        destination
                    ],
                    routeWhileDragging: false,
                    show: false,
                    addWaypoints: false,
                    lineOptions: {
                        styles: [
                            {
                                color: '#0077ff',      // route color
                                weight: 4,             // line thickness
                                opacity: 0.8,
                                dashArray: '8, 8'      // ✅ dashed line: 8px dash, 8px gap
                            }
                        ]
                    },
                    createMarker: () => null  // optional: no default markers
                }).addTo(map);

            }, function (err) {
                alert("Geolocation failed: " + err.message);
            });
        });
    }
});


var ctrl = L.control.iconLayers(layers).addTo(map);


function addTouchTarget(layer, latlng, popupContent) {
    const touchTarget = L.circleMarker(latlng, {
        radius: 14,
        stroke: false,
        fill: true,
        fillColor: '#000',
        fillOpacity: 0,
        interactive: true,
        bubblingMouseEvents: false
    });

    touchTarget.bindPopup(popupContent);
    touchTarget.on('click', function () {
        layer.openPopup();
    });

    return touchTarget;
}

function getVisiblePointLayer(layer) {
    return layer.getLayers ? layer.getLayers()[1] : layer;
}

function getFeatureLatLng(layer) {
    return getVisiblePointLayer(layer).getLatLng();
}

function openFeaturePopup(layer) {
    getVisiblePointLayer(layer).openPopup();
}

function createSiteLayer(data, options) {
    const settings = Object.assign({ color: '#e31a1c', radius: 6, label: 'Site' }, options || {});
    return L.geoJson(data, {
        pointToLayer: function (feature, latlng) {
            const visibleMarker = L.circleMarker(latlng, {
                radius: settings.radius,
                fillColor: settings.color,
                color: '#000',
                weight: 1,
                opacity: 1,
                fillOpacity: 0.85
            });
            const name = (feature.properties && feature.properties.Name) || settings.label;
            if (settings.showLabels) {
                const labelText = name.replace(/[^0-9]/g, '') || name;
                visibleMarker.bindTooltip(labelText, { permanent: true, direction: 'top', className: 'mt-label' });
            }
            return L.layerGroup([addTouchTarget(visibleMarker, latlng, ""), visibleMarker]);
        },
        onEachFeature: function (feature, layer) {
            const visibleMarker = getVisiblePointLayer(layer);
            const latLng = visibleMarker.getLatLng();
            const name = (feature.properties && feature.properties.Name) || settings.label;
            const description = feature.properties && feature.properties.description;

            let popupContent = `<b>${settings.label}:</b> ${name}<br>`;
            if (description) {
                popupContent += `${description}<br>`;
            }
            popupContent += `<hr style="margin: 4px 0; border-top: 3px solid #aaa;">`;
            popupContent += `<a href="#" class="navigate-link" data-lat="${latLng.lat}" data-lng="${latLng.lng}">📍 Navigate here</a>`;

            layer.eachLayer(function (targetLayer) {
                targetLayer.bindPopup(popupContent);
            });
        }
    });
}

function createXSiteLayer(data, options) {
    const settings = Object.assign({ color: '#000', label: 'Site' }, options || {});
    return L.geoJson(data, {
        pointToLayer: function (feature, latlng) {
            const marker = L.marker(latlng, {
                icon: L.divIcon({
                    className: 'mt-x-marker',
                    html: `<span style="color:${settings.color};">&times;</span>`,
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                })
            });
            if (settings.showLabels) {
                const name = (feature.properties && feature.properties.Name) || settings.label;
                const labelText = name.replace(/[^0-9]/g, '') || name;
                marker.bindTooltip(labelText, { permanent: true, direction: 'top', className: 'mt-label' });
            }
            return marker;
        },
        onEachFeature: function (feature, layer) {
            const latLng = layer.getLatLng();
            const name = (feature.properties && feature.properties.Name) || settings.label;
            const description = feature.properties && feature.properties.description;

            let popupContent = `<b>${settings.label}:</b> ${name}<br>`;
            if (description) {
                popupContent += `${description}<br>`;
            }
            popupContent += `<hr style="margin: 4px 0; border-top: 3px solid #aaa;">`;
            popupContent += `<a href="#" class="navigate-link" data-lat="${latLng.lat}" data-lng="${latLng.lng}">📍 Navigate here</a>`;

            layer.bindPopup(popupContent);
        }
    });
}

// Status overlays: completed/running sites are looked up by number (the digits in
// "Name", e.g. "REK-681" -> 681) across the 2026 planned sites and yearly repeat sites.
// Those same sites are excluded from the underlying layers below so a site only ever
// shows once, as its status marker rather than its original planned/repeat marker.
var siteSourceCollections = [plannedSites2026All, plannedSites2026Difficult, yearlyRepeatSites];
var statusSiteNumbers = (completedSites || []).concat(runningSites || []);

function findSiteFeatureByNumber(number, collections) {
    const target = String(number).trim();
    for (const collection of collections) {
        const features = (collection && collection.features) || [];
        for (const feature of features) {
            const name = feature.properties && feature.properties.Name;
            if (!name) continue;
            if (String(name).replace(/[^0-9]/g, '') === target) {
                return feature;
            }
        }
    }
    return null;
}

function excludeSitesByNumber(data, numbers) {
    const excluded = new Set((numbers || []).map(function (n) { return String(n).trim(); }));
    if (!excluded.size || !data || !data.features) return data;
    return Object.assign({}, data, {
        features: data.features.filter(function (feature) {
            const name = feature.properties && feature.properties.Name;
            const digits = name ? String(name).replace(/[^0-9]/g, '') : '';
            return !excluded.has(digits);
        })
    });
}

// Create site layers
// 2026 planned sites: circles (blue = all, red = difficult access), names always visible
var plannedSites2026AllLayer = createSiteLayer(excludeSitesByNumber(plannedSites2026All, statusSiteNumbers), { color: '#1f78b4', radius: 7, label: '2026 Planned Site', showLabels: true });
var plannedSites2026DifficultLayer = createSiteLayer(excludeSitesByNumber(plannedSites2026Difficult, statusSiteNumbers), { color: '#e31a1c', radius: 7, label: 'Difficult Access Site', showLabels: true });

// All other sites: X symbols, each a different color
var sites2024Layer = createXSiteLayer(sites2024, { color: '#33a02c', label: '2024 Site' });
var yearlyRepeatSitesLayer = createXSiteLayer(excludeSitesByNumber(yearlyRepeatSites, statusSiteNumbers), { color: '#b15928', label: 'Yearly Repeat Site', showLabels: true });
var permanentSitesLayer = createXSiteLayer(permanentSites, { color: '#6a3d9a', label: 'Permanent Site' });
var hsOrkaExistingSitesLayer = createXSiteLayer(hsOrkaExistingSites, { color: '#ff7f00', label: 'HS Orka Existing Site' });

function createStatusSiteLayer(numbers, collections, options) {
    const settings = Object.assign({ color: '#000', radius: 8, label: 'Site' }, options || {});
    const layer = L.layerGroup();

    (numbers || []).forEach(function (number) {
        const feature = findSiteFeatureByNumber(number, collections);
        if (!feature) {
            console.warn(settings.label + ': no matching site found for number ' + number);
            return;
        }

        const coords = feature.geometry.coordinates;
        const latlng = L.latLng(coords[1], coords[0]);
        const name = feature.properties.Name;

        const visibleMarker = L.circleMarker(latlng, {
            radius: settings.radius,
            fillColor: settings.color,
            color: '#000',
            weight: 1,
            opacity: 1,
            fillOpacity: 0.9
        });

        let popupContent = `<b>${settings.label}:</b> ${name}<br>`;
        popupContent += `<hr style="margin: 4px 0; border-top: 3px solid #aaa;">`;
        popupContent += `<a href="#" class="navigate-link" data-lat="${latlng.lat}" data-lng="${latlng.lng}">📍 Navigate here</a>`;

        visibleMarker.bindPopup(popupContent);

        layer.addLayer(addTouchTarget(visibleMarker, latlng, popupContent));
        layer.addLayer(visibleMarker);
    });

    return layer;
}

var completedSitesLayer = createStatusSiteLayer(completedSites, siteSourceCollections, { color: '#888888', radius: 8, label: 'Completed Site' });
var runningSitesLayer = createStatusSiteLayer(runningSites, siteSourceCollections, { color: '#ffe119', radius: 8, label: 'Running Site' });

function countMatchedSites(numbers, collections) {
    return (numbers || []).reduce(function (count, number) {
        return count + (findSiteFeatureByNumber(number, collections) ? 1 : 0);
    }, 0);
}

(function updateSiteStatsBar() {
    // "Difficult Access" sites are a marked subset of "All" (not a separate site group),
    // so total is counted by unique site number rather than summed feature-list lengths.
    const uniqueSiteNumbers = new Set();
    siteSourceCollections.forEach(function (collection) {
        ((collection && collection.features) || []).forEach(function (feature) {
            const name = feature.properties && feature.properties.Name;
            if (name) uniqueSiteNumbers.add(String(name).replace(/[^0-9]/g, ''));
        });
    });
    const totalCount = uniqueSiteNumbers.size;
    const completedCount = countMatchedSites(completedSites, siteSourceCollections);
    const runningCount = countMatchedSites(runningSites, siteSourceCollections);
    const remainingCount = Math.max(totalCount - completedCount - runningCount, 0);

    const statValues = {
        statTotal: totalCount,
        statRunning: runningCount,
        statCompleted: completedCount,
        statRemaining: remainingCount
    };

    Object.keys(statValues).forEach(function (id) {
        const el = document.getElementById(id);
        if (el) el.textContent = statValues[id];
    });

    // Just for fun: a one-time, dismissable "halfway there" toast once completed sites
    // cross 50%. Doesn't block anything - it's a notification like any other, and won't
    // reappear on reload within the same tab.
    if (totalCount > 0 && completedCount / totalCount >= 0.5) {
        let alreadyCelebrated = false;
        try {
            alreadyCelebrated = sessionStorage.getItem('mt-halfway-celebrated') === '1';
        } catch (e) { /* sessionStorage unavailable - just show it */ }

        if (!alreadyCelebrated) {
            notification.success(
                'Halfway there!',
                `<div class="celebration-row">
                    <span class="celebration-emoji">🎉</span><span class="celebration-emoji">🎊</span><span class="celebration-emoji">🥳</span><span class="celebration-emoji">🎊</span><span class="celebration-emoji">🎉</span>
                </div><div>${completedCount} of ${totalCount} sites completed - nice work!</div>`,
                { timeout: 8000 }
            );
            try { sessionStorage.setItem('mt-halfway-celebrated', '1'); } catch (e) { /* ignore */ }
        }
    }
})();

function normalizeSearchText(value) {
    return String(value || "").trim().toLowerCase();
}

function createSiteSearchControl(siteLayer, options) {
    const settings = Object.assign({
        label: 'Search sites',
        layerName: 'site',
        datalistId: 'site-search-options'
    }, options || {});
    const stations = [];

    siteLayer.eachLayer(function (layer) {
        const name = layer.feature && layer.feature.properties && layer.feature.properties.Name;
        if (name) {
            stations.push({
                name: name,
                key: normalizeSearchText(name),
                layer: layer
            });
        }
    });

    const SiteSearchControl = L.Control.extend({
        options: {
            position: 'topright'
        },

        onAdd: function () {
            const container = L.DomUtil.create('div', 'leaflet-bar mt-search-control');
            const form = L.DomUtil.create('form', 'mt-search-form', container);
            const input = L.DomUtil.create('input', 'mt-search-input', form);
            const datalist = L.DomUtil.create('datalist', '', form);
            const button = L.DomUtil.create('button', 'mt-search-button', form);

            datalist.id = settings.datalistId;
            input.type = 'search';
            input.placeholder = settings.label;
            input.setAttribute('aria-label', 'Search ' + settings.layerName);
            input.setAttribute('list', datalist.id);
            button.type = 'submit';
            button.title = 'Search ' + settings.layerName;
            button.setAttribute('aria-label', 'Search ' + settings.layerName);
            button.innerHTML = '<i class="fa fa-search" aria-hidden="true"></i>';

            stations.forEach(function (station) {
                const option = L.DomUtil.create('option', '', datalist);
                option.value = station.name;
            });

            L.DomEvent.disableClickPropagation(container);
            L.DomEvent.disableScrollPropagation(container);

            L.DomEvent.on(button, 'click', function (event) {
                if (!container.classList.contains('is-expanded')) {
                    L.DomEvent.preventDefault(event);
                    container.classList.add('is-expanded');
                    input.focus();
                }
            });

            L.DomEvent.on(form, 'submit', function (event) {
                L.DomEvent.preventDefault(event);

                const query = normalizeSearchText(input.value);
                if (!query) {
                    container.classList.add('is-expanded');
                    input.focus();
                    return;
                }

                const match = stations.find(function (station) {
                    return station.key === query;
                }) || stations.find(function (station) {
                    return station.key.includes(query);
                });

                if (!match) {
                    notification.warning('Not found', 'No ' + settings.layerName + ' matches "' + input.value + '"');
                    return;
                }

                if (!map.hasLayer(siteLayer)) {
                    siteLayer.addTo(map);
                }

                const latLng = getFeatureLatLng(match.layer);
                map.setView(latLng, Math.max(map.getZoom(), 14), {
                    animate: true
                });
                openFeaturePopup(match.layer);
            });

            return container;
        }
    });

    return new SiteSearchControl();
}

L.easyButton({
    states: [{
        stateName: 'clearRoute',
        icon: 'fa-times-circle', // Font Awesome icon
        title: 'Clear Route',
        onClick: function (btn, map) {
            if (routingControl !== null) {
                map.removeControl(routingControl);
                routingControl = null;
            }
        }
    }]
}).addTo(map);

const popupTitle = (title) => `<div style="font-weight:bold; margin-bottom:4px; border-bottom:1px solid #aaa; padding-bottom:2px;">${title}</div>`;

const powerMajorLayer = L.geoJSON(powerMajor, {
    style: {
        color: '#e31a1c',
        weight: 3
    },
    onEachFeature: function (feature, layer) {
        const p = feature.properties;
        layer.bindPopup(`${popupTitle('Major Powerline')}<b>Name:</b> ${p.name || "-"}<br><b>Voltage:</b> ${p.voltage || "-"} V<br><b>Operator:</b> ${p.operator || "-"}`);
    }
});

const powerMinorLayer = L.geoJSON(powerMinor, {
    style: {
        color: '#1f78b4',
        weight: 2
    },
    onEachFeature: function (feature, layer) {
        const p = feature.properties;
        layer.bindPopup(`${popupTitle('Minor Powerline')}<b>Name:</b> ${p.name || "-"}<br><b>Voltage:</b> ${p.voltage || "-"} V<br><b>Operator:</b> ${p.operator || "-"}`);
    }
});

const powerUndergroundLayer = L.geoJSON(powerUnderground, {
    style: {
        color: '#6a3d9a',
        weight: 2
    },
    onEachFeature: function (feature, layer) {
        const p = feature.properties;
        layer.bindPopup(`${popupTitle('Underground Powerline')}<b>Name:</b> ${p.name || "-"}<br><b>Type:</b> ${p.power || "-"}<br><b>Operator:</b> ${p.operator || "-"}`);
    }
});

const powerplantsLayer = L.geoJSON(powerplants, {
    style: {
        color: '#333',
        weight: 1,
        fillColor: '#fdbf6f',
        fillOpacity: 0.6
    },
    onEachFeature: function (feature, layer) {
        const p = feature.properties;
        const name = p.name || p['name:is'] || p['name:en'] || 'Power plant';
        layer.bindPopup(`${popupTitle('Power Plant')}<b>Name:</b> ${name}<br><b>Type:</b> ${p.power || "-"}<br><b>Source:</b> ${p['plant:source'] || "-"}<br><b>Operator:</b> ${p.operator || "-"}`);
    }
});

const pipelinesLayer = L.geoJSON(pipelines, {
    style: {
        color: '#006064',
        weight: 2,
        dashArray: '6, 4'
    },
    onEachFeature: function (feature, layer) {
        const p = feature.properties;
        layer.bindPopup(`${popupTitle('Pipeline')}<b>Name:</b> ${p.name || "-"}<br><b>Substance:</b> ${p.substance || "-"}<br><b>Operator:</b> ${p.operator || "-"}`);
    }
});

// Step 1: Create a color palette based on unique geology categories (FLOKKUR)
const colorMap = {};
const colorList = [
    '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
    '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe',
    '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000',
    '#aaffc3', '#808000'
];
let colorIndex = 0;

map.createPane('geologyPane');
// Between the tile pane (200) and the default overlay pane (400): visible above the
// basemap, but always underneath every other data layer (sites, faults, powerlines...).
map.getPane('geologyPane').style.zIndex = 250;

// Step 2: Create the GeoJSON layer
const geologyLayer = L.geoJSON(geology, {
    pane: 'geologyPane',

    style: function (feature) {
        const unit = feature.properties.FLOKKUR || "Unknown";
        if (!colorMap[unit]) {
            colorMap[unit] = colorList[colorIndex % colorList.length];
            colorIndex++;
        }
        return {
            color: colorMap[unit],
            weight: 1,
            fillOpacity: 0.5
        };
    },
    onEachFeature: function (feature, layer) {
        const p = feature.properties;
        const popupContent = `
        <table style="width:100%; font-size: 13px;">
            <tr><th>Category</th><td>${p.FLOKKUR || "-"}</td></tr>
            <tr><th>Lithology</th><td>${p.jardmLandm || "-"}</td></tr>
            <tr><th>Age unit</th><td>${p.jardsogule || "-"}</td></tr>
            <tr><th>Silica content</th><td>${p.magnKisilo || "-"}</td></tr>
            <tr><th>Surface</th><td>${p.yfirbordsv || "-"}</td></tr>
            <tr><th>Source</th><td>${p.heimild || "-"}</td></tr>
        </table>
    `;
        layer.bindPopup(popupContent);
    }
});

const faultLayer = L.geoJSON(faults, {
    style: {
        color: '#000',
        weight: 1,
        opacity: 0.8
    },
    onEachFeature: function (feature, layer) {
        const p = feature.properties;
        const typeLabel = p.jardhnik === 'jspr' ? 'Fissure' : 'Fault';
        const popupContent = `
            <table style="width:100%; font-size: 13px;">
                <tr><th>Type</th><td>${typeLabel}</td></tr>
                <tr><th>Age unit</th><td>${p.jardsogule || "-"}</td></tr>
                <tr><th>Source</th><td>${p.heimild || "-"}</td></tr>
                <tr><th>Length (m)</th><td>${p.Shape_Leng ? Math.round(p.Shape_Leng) : "-"}</td></tr>
            </table>
        `;
        layer.bindPopup(popupContent);
    }
});


function legendSwatch(type, colors) {
    const colorList = Array.isArray(colors) ? colors : [colors];
    const background = colorList.length > 1
        ? `linear-gradient(90deg, ${colorList.join(', ')})`
        : colorList[0];

    if (type === 'x') {
        return `<span class="legend-swatch legend-x" style="color:${colorList[0]};">&times;</span>`;
    }

    if (type === 'dashed-line') {
        return `<span class="legend-swatch legend-line legend-line-dashed" style="border-top-color:${colorList[0]};"></span>`;
    }

    const shapeClass = type === 'line' ? 'legend-line' : (type === 'square' ? 'legend-square' : 'legend-dot');
    return `<span class="legend-swatch ${shapeClass}" style="background:${background};"></span>`;
}

var baseLayers = []; // (optional)

var groupedOverlays = [
    {
        group: "Survey Sites",
        collapsed: true,
        layers: [
            { name: "2026 Planned Sites - All", layer: plannedSites2026AllLayer, icon: legendSwatch('dot', '#1f78b4') },
            { name: "2026 Planned - Difficult Access", layer: plannedSites2026DifficultLayer, icon: legendSwatch('dot', '#e31a1c') },
            { name: "2024 Sites", layer: sites2024Layer, icon: legendSwatch('x', '#33a02c') },
            { name: "Yearly Repeat Sites", layer: yearlyRepeatSitesLayer, icon: legendSwatch('x', '#b15928') },
            { name: "Permanent Sites", layer: permanentSitesLayer, icon: legendSwatch('x', '#6a3d9a') },
            { name: "HS Orka Existing Sites", layer: hsOrkaExistingSitesLayer, icon: legendSwatch('x', '#ff7f00') },
            { name: "Running Sites", layer: runningSitesLayer, icon: legendSwatch('dot', '#ffe119') },
            { name: "Completed Sites", layer: completedSitesLayer, icon: legendSwatch('dot', '#888888') }
        ]
    },
    {
        group: "Infrastructure",
        collapsed: true,
        layers: [
            { name: "Major powerline", layer: powerMajorLayer, icon: legendSwatch('line', '#e31a1c') },
            { name: "Minor powerline", layer: powerMinorLayer, icon: legendSwatch('line', '#1f78b4') },
            { name: "Underground powerline", layer: powerUndergroundLayer, icon: legendSwatch('line', '#6a3d9a') },
            { name: "Power plants", layer: powerplantsLayer, icon: legendSwatch('square', '#fdbf6f') },
            { name: "Pipelines", layer: pipelinesLayer, icon: legendSwatch('dashed-line', '#006064') }
        ]
    },
    {
        group: "Geology",
        collapsed: true,
        layers: [
            { name: "Geology", layer: geologyLayer },
            { name: "Faults", layer: faultLayer, icon: legendSwatch('line', '#000') }
        ]
    }
];

// The 2026 planned sites, yearly repeat sites, and status overlays are visible by default;
// everything else is opt-in via the layer panel
plannedSites2026AllLayer.addTo(map);
plannedSites2026DifficultLayer.addTo(map);
yearlyRepeatSitesLayer.addTo(map);
completedSitesLayer.addTo(map);
runningSitesLayer.addTo(map);

L.control.panelLayers(baseLayers, groupedOverlays, {
    compact: true, // true = collapsed groups by default
    collapsibleGroups: true,
    selectorGroup: true, // adds a group checkbox that toggles every layer in that group at once
    position: 'topright'
}).addTo(map);

// The plugin applies selectorGroup to every group; drop it for "Survey Sites" only
// (2026 sites should stay visible by default, not get bulk-toggled with the rest).
document.querySelectorAll('.leaflet-panel-layers-selector[name="Survey Sites"]').forEach(function (el) {
    el.remove();
});

createSiteSearchControl(plannedSites2026AllLayer, {
    label: 'Search sites',
    layerName: '2026 planned site',
    datalistId: 'site-search-options'
}).addTo(map);
