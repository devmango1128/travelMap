
let db;
let gubun;
const request = indexedDB.open("RegionsDB", 1);
const center = [35.9665, 127.6780];

request.onerror = function(event) {
    console.error("Database error: " + event.target.errorCode);
};

request.onsuccess = function(event) {
    db = event.target.result;
    if(gubun === 2) loadGeoJSON();
};

request.onupgradeneeded = function(event) {
    db = event.target.result;
    db.createObjectStore("regions", { keyPath: "region" });
};

function initMap() {
    map = L.map('map', {
        center: center, // 대한민국 중심 좌표
        zoom: 7,
        crs: L.CRS.EPSG3857, // 좌표 참조 시스템 설정
        zoomControl: true, // 줌 컨트롤 활성화
        attributionControl: false, // 저작권 정보 비활성화
        layers: [] // 빈 타일 레이어 제거
    });

    // 흰색 배경 설정
    const whiteBackground = L.tileLayer('', {
        attribution: '',
        maxZoom: 18
    });

    whiteBackground.getContainer = function() {
        const container = document.createElement('div');
        container.style.background = '#75c8f3'; // 배경을 파란색으로 설정
        container.style.width = '100%';
        container.style.height = '100%';
        return container;
    };

    whiteBackground.addTo(map);
}

let regions = {}; // 지역별 정보 저장
let geojsonLayer;

function loadGeoJSON() {

    $.getJSON("src/data/sigungu_new.json", function(data) {
        // 시군구 단위로 필터링된 GeoJSON 데이터 생성
        const mergedFeatures = {};

        data.features.forEach(function(feature) {
            let sgg = feature.properties.SIG_CD;
            if (!mergedFeatures[sgg]) {
                mergedFeatures[sgg] = {
                    type: "Feature",
                    properties: feature.properties,
                    geometry: {
                        type: "MultiPolygon",
                        coordinates: []
                    }
                };
            }
            mergedFeatures[sgg].geometry.coordinates.push(feature.geometry.coordinates);
        });

        const filteredData = {
            type: "FeatureCollection",
            features: Object.values(mergedFeatures)
        };

        geojsonLayer = L.geoJson(filteredData, {
            style: function (feature) {
                return {
                    color: "#282727",
                    weight: 1,
                    fillColor: "#ffffff", // 지도 영역을 흰색으로 설정
                    fillOpacity: 1
                };
            },
            onEachFeature: function (feature, layer) {
                layer.on({
                    click: function (e) {
                        const region = regions[feature.properties.SIG_CD.substring(0, 2) +feature.properties.SIG_CD];
                        const popupContent = "<b>" + feature.properties.SIG_KOR_NM + "</b><br>"
                            + (region ? region[0].date : "") + "<br>"
                            + (region ? region[0].description : "");
                        layer.bindPopup(popupContent).openPopup();
                    }
                });
            }
        }).addTo(map);

        loadRegions();
    });
}

function saveRegion() {

    const transaction = db.transaction(["regions"], "readonly");
    const objectStore = transaction.objectStore("regions");
    const request = objectStore.getAll();

    request.onsuccess = function(event) {
        const results = event.target.result;
        results.forEach(function(item) {
            regions[item.region] = item.data;
        });
    };

    const mapName = localStorage.getItem("mapName");
    const region = localStorage.getItem("sigunguCd");
    const color = document.getElementById('colorPicker').value;
    const date = document.getElementById('datePicker').value;
    const description = document.getElementById('description').value;

    if (!regions[region]) {
        regions[region] = [];
    }

    regions[region].push({ mapName: mapName, color: color, date: date, description: description });
    saveRegions();

    nextPage(2);
}

function geoLayer() {

    const region = localStorage.getItem("sigunguCd");

    if(geojsonLayer) {
        geojsonLayer.eachLayer(function(layer) {
            if (layer.feature.properties.SIG_CD === region.substring(2, region.length - 1)) {
                layer.setStyle({
                    fillColor: color,
                    fillOpacity: 0.7
                });
            }
        });
    }
}

function deleteRegions() {

    const dbName = "RegionsDB";
    const request = indexedDB.open(dbName, 1);

    request.onerror = function(event) {
        console.error("Database error: " + event.target.errorCode);
    };

    request.onsuccess = function(event) {
        const db = event.target.result;
        const transaction = db.transaction(["regions"], "readwrite");
        const objectStore = transaction.objectStore("regions");

        const clearRequest = objectStore.clear();

        clearRequest.onsuccess = function(event) {
            console.log("All data cleared successfully.");
            alert("All data has been cleared from the database.");
        };

        clearRequest.onerror = function(event) {
            console.error("Error clearing data: " + event.target.errorCode);
        };
    };

    request.onupgradeneeded = function(event) {
        const db = event.target.result;
        if (!db.objectStoreNames.contains("regions")) {
            db.createObjectStore("regions", { keyPath: "region" });
        }
    };
}

function saveRegions() {

    const transaction = db.transaction(["regions"], "readwrite");
    const objectStore = transaction.objectStore("regions");

    Object.keys(regions).forEach(function(region) {
        objectStore.put({ region: region, data: regions[region] });
    });

    transaction.oncomplete = function() {
        console.log("All regions have been saved successfully.");
    };

    transaction.onerror = function(event) {
        console.error("Transaction error: " + event.target.errorCode);
    };
}

function loadRegions() {

    const transaction = db.transaction(["regions"], "readonly");
    const objectStore = transaction.objectStore("regions");
    const request = objectStore.getAll();

    request.onsuccess = function(event) {

        const results = event.target.result;
        results.forEach(function(item) {
            regions[item.region] = item.data;
        });

        if (geojsonLayer) { // geojsonLayer가 정의된 후에 실행
            geojsonLayer.eachLayer(function(layer) {
                const districtCode = layer.feature.properties.SIG_CD; // 구 코드 가져오기
                const region = districtCode.substring(0, 2) + districtCode; // 시 + 구 이름으로 key 생성

                if (regions[region]) {
                    const color = regions[region][0].color;
                    layer.setStyle({
                        fillColor: color,
                        fillOpacity: 0.7
                    });
                }
            });
        }
    };

    request.onerror = function(event) {
        console.error("Error loading regions from IndexedDB: " + event.target.errorCode);
    };
}

function moveToCurrentLocation() {
    navigator.geolocation.getCurrentPosition(
        function(position) {
            map.setView([position.coords.latitude, position.coords.longitude], 12);
        },
        function(error) {
            console.error("Error Code = " + error.code + " - " + error.message);
            map.setView(center, 7); // 대한민국 중심 좌표로 이동
        }
    );
}

function nextPage(reqGubun) {

    gubun = reqGubun;

    switch(gubun) {
        case 0 :
            localStorage.setItem("mapName", document.getElementById('mapName').value);
            window.location.href = "sigungu.html";
            break;
        case 1 :
            detailSave();
            window.location.href = "colorDate.html";
            break;
        case 2 :
            window.location.href = "map.html";
            break;
        default : break;
    }
}

function detailSave() {
    localStorage.setItem("sigunguCd", document.getElementById('sigunguCd').value);
}

function goSidoDetail(obj, code) {

    let element = document.getElementById('detailList');

    if (element) {
        element.parentNode.removeChild(element);
    }

    const ul = document.createElement('ul');
    ul.id = 'detailList';

    $.getJSON("src/data/sigungu_new.json", function(data) {
        data.features.forEach(function (feature) {
            if (feature.properties.SIG_CD.startsWith(code)) {
                var li = document.createElement('li');
                li.textContent = feature.properties.SIG_KOR_NM;

                // 이벤트를 처리하는 함수
                function handleEvent(e) {
                    e.stopPropagation();
                    nextPage(1);
                    document.getElementById('sigunguCd').value = code + feature.properties.SIG_CD;
                }

                // click과 touchstart 이벤트 모두에 핸들러를 추가
                li.addEventListener('click', handleEvent);
                li.addEventListener('touchstart', handleEvent);

                ul.appendChild(li);
            }
        });

        // UL을 OBJ 아래에 추가
        obj.parentNode.insertBefore(ul, obj.nextSibling);
    });
}

function goMenu(url) {
    window.location.href = url;
}
