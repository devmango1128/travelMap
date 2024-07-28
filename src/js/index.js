let db;
let transaction;
let objectStore;

const request = indexedDB.open("MapColorDB", 1);

request.onerror = (event) => console.error("Start Database error:", event.target.errorCode);

request.onsuccess = (event) => {

    db = event.target.result;

    transaction = db.transaction("mapNames", "readwrite");
    objectStore = transaction.objectStore("mapNames");

    if (gubun === 3) loadGeoJSON();
};

request.onupgradeneeded = (event) => {
    db = event.target.result;
    db.createObjectStore("mapNames", { keyPath: "mapName" });
};

const sigunguJsonUrl = "src/data/sigungu_new.json";
const center = [35.9665, 127.6780];
const mapNames = {};
let geojsonLayer;
let gubun;
let map;

function initMap() {
    map = L.map('map', {
        center: center,
        zoom: 7,
        crs: L.CRS.EPSG3857,
        zoomControl: true,
        attributionControl: false,
        layers: []
    });

    const whiteBackground = L.tileLayer('', { attribution: '', maxZoom: 18 });

    whiteBackground.getContainer = () => {
        const container = document.createElement('div');
        container.style.background = '#75c8f3';
        container.style.width = '100%';
        container.style.height = '100%';
        return container;
    };

    whiteBackground.addTo(map);
}

function loadGeoJSON() {

    const mapName = localStorage.getItem("mapName");

    $.getJSON(sigunguJsonUrl, function(data) {
        const mergedFeatures = data.features.reduce((acc, feature) => {
            const sgg = feature.properties.SIG_CD;
            if (!acc[sgg]) {
                acc[sgg] = {
                    type: "Feature",
                    properties: feature.properties,
                    geometry: { type: "MultiPolygon", coordinates: [] }
                };
            }
            acc[sgg].geometry.coordinates.push(feature.geometry.coordinates);
            return acc;
        }, {});

        const filteredData = { type: "FeatureCollection", features: Object.values(mergedFeatures) };

        geojsonLayer = L.geoJson(filteredData, {
            style: () => ({
                color: "#282727",
                weight: 1,
                fillColor: "#ffffff",
                fillOpacity: 1
            }),
            onEachFeature: (feature, layer) => {
                layer.on({
                    click: (e) => {
                        const sigCd = feature.properties.SIG_CD;
                        const data = mapNames[mapName];
                        const popupContent = `<b>${feature.properties.SIG_KOR_NM}</b><br>` +
                            (data ? `${data.strDate}~${data.endDate}` : "") + "<br>" +
                            (data ? data.description : "");
                        layer.bindPopup(popupContent).openPopup();
                    }
                });
            }
        }).addTo(map);

        loadRegions(mapName);
    });
}

function geoLayer() {
    const sigunguCd = localStorage.getItem("sigunguCd");

    if (geojsonLayer) {
        geojsonLayer.eachLayer(layer => {
            if (layer.feature.properties.SIG_CD === sigunguCd.substring(2, region.length - 1)) {
                layer.setStyle({ fillColor: color, fillOpacity: 1 });
            }
        });
    }
}

function loadRegions(mapName) {

    const transaction = db.transaction(["mapNames"], "readonly");
    const objectStore = transaction.objectStore("mapNames");
    const request = objectStore.getAll();

    request.onsuccess = function(event) {

        const results = event.target.result;

        results.forEach(function(item) {
            if(item.mapName === mapName) {
                mapNames[mapName] = item.data;
            }
        });

        if (geojsonLayer) {
            geojsonLayer.eachLayer(function(layer) {
                const districtCode = layer.feature.properties.SIG_CD; // 구 코드 가져오기
                const sigunguCd = districtCode.substring(0, 2) + districtCode; // 시 + 구 이름으로 key 생성

                if (mapNames[mapName].sigunguCd === sigunguCd && mapNames[mapName].color) {
                    layer.setStyle({
                        fillColor: mapNames[mapName].color,
                        fillOpacity: 1
                    });
                }
            });
        }
    };

    request.onerror = function(event) {
        console.error("LoadRegions Error loading regions from IndexedDB: " + event.target.errorCode);
    };
}

function moveToCurrentLocation() {
    navigator.geolocation.getCurrentPosition(
        (position) => map.setView([position.coords.latitude, position.coords.longitude], 12),
        (error) => {
            console.error("Error Code =", error.code, "-", error.message);
            map.setView(center, 7); // 대한민국 중심 좌표로 이동
        }
    );
}

function saveMapName(db, mapName) {

    const transaction = db.transaction(["mapNames"], "readwrite");
    const objectStore = transaction.objectStore("mapNames");

    const mapNameObject = { mapName: mapName };

    const request = objectStore.put(mapNameObject);

    request.onsuccess = function(event) {
        console.log("Map name saved successfully.");
        nextPage(0, mapName);
    };

    request.onerror = function(event) {
        console.error("Error saving map name:", event.target.errorCode);
    };
}

function saveMapInfo() {
    const mapName = localStorage.getItem("mapName");
    const sigunguCd = localStorage.getItem("sigunguCd");
    const color = document.getElementById('selectedColor').value;
    const strDate = document.getElementById('strDatePicker').value;
    const endDate = document.getElementById('endDatePicker').value;
    const description = document.getElementById('description').value;

    const data = {
        sigunguCd: sigunguCd,
        color: color,
        strDate: strDate,
        endDate: endDate,
        description: description
    }
    saveMapInfos(mapName, data);

    nextPage(3);
}

function saveMapInfos(mapName, data) {
    const transaction = db.transaction(["mapNames"], "readwrite");
    const objectStore = transaction.objectStore("mapNames");
    const request = objectStore.getAll();

    request.onsuccess = function(event) {
        const allData = event.target.result;
        const resultMapInfo = allData.filter(item => item.mapName === mapName);

        if (resultMapInfo.length > 0) {
            const itemToUpdate = resultMapInfo[0];
            itemToUpdate.data = data;

            const updateRequest = objectStore.put(itemToUpdate);

            updateRequest.onsuccess = function() {
                console.log("saveMapInfos Data updated successfully:", itemToUpdate);
            };

            updateRequest.onerror = function(event) {
                console.error("saveMapInfos infos Update error: " + event.target.errorCode);
            };
        }
    };

    request.onerror = function(event) {
        console.error("saveMapInfos Request error: " + event.target.errorCode);
    };

    transaction.onerror = function(event) {
        console.error("saveMapInfos Transaction error: " + event.target.errorCode);
    };
}

function deleteMapInfo() {
    const request = indexedDB.open("MapColorDB", 1);

    request.onerror = (event) => console.error("Database error:", event.target.errorCode);

    request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction(["mapNames"], "readwrite");
        const objectStore = transaction.objectStore("mapNames");

        const clearRequest = objectStore.clear();

        clearRequest.onsuccess = () => {
            console.log("All data cleared successfully.");
            alert("All data has been cleared from the database.");
        };

        clearRequest.onerror = (event) => console.error("Error clearing data:", event.target.errorCode);
    };

    request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains("mapNames")) {
            db.createObjectStore("mapNames", { keyPath: "mapName" });
        }
    };
}

function nextPage(reqGubun, data) {
    gubun = reqGubun;

    switch (gubun) {
        case 0:
            if (document.getElementById('mapName').value === '') {
                alert('땅따먹기 주제를 입력해주세요.');
                document.getElementById('mapName').focus();
                return;
            }
            window.location.href = "mapNames.html";
            break;
        case 1:
            localStorage.setItem("mapName", data);
            window.location.href = "sigungu.html";
            break;
        case 2:
            detailSave(data);
            window.location.href = "mapInfo.html";
            break;
        case 3:
            window.location.href = "map.html";
            break;
        default:
            break;
    }
}

function detailSave(data) {
    localStorage.setItem("sigunguCd", data.sigunguCd);
    localStorage.setItem("sigunguNm", data.sigunguNm);
}

function goMenu(url) {
    window.location.href = url;
}

function openIndexedDB(name, version) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(name, version);

        request.onsuccess = function(event) {
            resolve(event.target.result);
        };

        request.onerror = function(event) {
            reject("openIndexedDB Database error: " + event.target.errorCode);
        };
    });
}

function getAllData(db, storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readonly");
        const objectStore = transaction.objectStore(storeName);
        const request = objectStore.getAll();

        request.onsuccess = function(event) {
            resolve(event.target.result);
        };

        request.onerror = function(event) {
            reject("getAllReginons Transaction error: " + event.target.errorCode);
        };
    });
}

function fetchJSON() {
    return new Promise((resolve, reject) => {
        $.getJSON(sigunguJsonUrl).done(resolve).fail((jqxhr, textStatus, error) => {
            reject(`Request Failed: ${textStatus}, ${error}`);
        });
    });
}

function updateSigunguList(allData, mapName, sigunguData) {

    console.log(allData);
    document.querySelectorAll(".sigunguList li").forEach((li) => {
        const sgg = li.getAttribute('data-sgg');
        const cnt = allData.filter(item => {
            if (item.mapName === mapName) {
                return item.data && item.data.sigungu.startsWith(sgg);
            }
            return false;
        }).length;
        const text = li.textContent.replace(/\s\(\d+\/\d+\)$/, '');

        const totCnt = sigunguData.features.filter(feature => feature.properties.SIG_CD.startsWith(sgg)).length;
        li.innerText = `${text} (${cnt}/${totCnt})`;
    });
}

function goSidoDetail(obj, code) {
    let element = document.getElementById('detailList');

    if (element) {
        element.parentNode.removeChild(element);
    }

    const ul = document.createElement('ul');
    ul.id = 'detailList';
    ul.classList.add('detailList');

    $.getJSON(sigunguJsonUrl, function(data) {
        data.features.forEach(function(feature) {
            if (feature.properties.SIG_CD.startsWith(code)) {
                const li = document.createElement('li');
                li.textContent = feature.properties.SIG_KOR_NM;

                const sigunguCd = code + feature.properties.SIG_CD;

                function handleEvent() {
                    localStorage.setItem('sigunguCd', sigunguCd);
                    localStorage.setItem('sigunguNm', obj.innerText + ' ' + feature.properties.SIG_KOR_NM);
                    nextPage(2, { sigunguCd, sigunguNm : obj.innerText + ' ' + feature.properties.SIG_KOR_NM });
                }

                //TODO.수정필요
                if (mapNames[sigunguCd]) {
                    li.classList.add('point');
                }

                li.addEventListener('click', handleEvent);
                ul.appendChild(li);
            }
        });

        obj.parentNode.insertBefore(ul, obj.nextSibling);

        const dlUl = document.getElementById('detailList');
        const lis = dlUl.querySelectorAll('li');

        if (lis.length % 2 !== 0) {
            lis[lis.length - 1].classList.add('full-width');
        }
    });
}
