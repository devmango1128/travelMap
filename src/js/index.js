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
        layers: [],
        preferCanvas: true
    });

    const whiteBackground = L.tileLayer('', { attribution: '', maxZoom: 18 });

    whiteBackground.getContainer = () => {
        const container = document.createElement('div');
        container.style.background = '#fff';
        container.style.width = '100%';
        container.style.height = '100%';
        return container;
    };

    whiteBackground.addTo(map);

    map.on('zoomend', updateLabelSizes);
}

const excludedRegionCodes = [
    "11", // 서울특별시
    "26", // 부산광역시
    "27", // 대구광역시
    "28", // 인천광역시
    "29", // 광주광역시
    "30", // 대전광역시
    "31", // 울산광역시
    "36"  // 세종특별자치시
];

const sigunguList = {
    11: "서울특별시",
    26: "부산광역시",
    27: "대구광역시",
    28: "인천광역시",
    29: "광주광역시",
    30: "대전광역시",
    31: "울산광역시",
    36: "세종특별자치시",
    41: "경기도",
    43: "충청북도",
    44: "충청남도",
    46: "전라남도",
    47: "경상북도",
    48: "경상남도",
    50: "제주특별자치도",
    42: "강원특별자치도",
    45: "전북특별자치도"
};

const cityCenters = {
    "서울특별시": [37.5665, 126.9780],
    "부산광역시": [35.1796, 129.0756],
    "대구광역시": [35.8722, 128.6025],
    "인천광역시": [37.4563, 126.7052],
    "광주광역시": [35.1595, 126.8526],
    "대전광역시": [36.3504, 127.3845],
    "울산광역시": [35.5384, 129.3114],
    "세종특별자치시": [36.4800, 127.2890]
};

function loadGeoJSON() {

    const mapName = localStorage.getItem("mapName");

    $.getJSON(sigunguJsonUrl, async function(data) {
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
                weight: 0.5,
                fillColor: "#ffffff",
                fillOpacity: 1
            }),
            onEachFeature: (feature, layer) => {
                layer.on({
                    click: (e) => {

                        const sigCd = feature.properties.SIG_CD;
                        const siNm = sigunguList[sigCd.substring(0, 2)];
                        const data = mapNames[mapName];
                        let popupContent = `<b class="label-tit">${feature.properties.SIG_KOR_NM} <button class="map-reg-btn" onclick="registerLocation('${mapName}','${sigCd}', event)"><img src="src/images/plus_icon_w.png" class="plus-img">추가</button></b>`;
                        let popupOptions = {
                            minWidth: 230,
                            maxWidth: 280
                        };

                        let imgURL = '';

                        if(data) {
                            popupContent += '<div class="lable-area" style="overflow-y:auto; max-height:200px; width:100%;">';
                            if (Array.isArray(data)) {
                                data.forEach(async (map, index) => {
                                    if (map.sigunguCd.substring(2, 8) === sigCd) {

                                        popupContent += '<hr>';

                                        const formattedStrDate = formatDateToYYMMDD(map.strDate);
                                        const formattedEndDate = formatDateToYYMMDD(map.endDate);

                                        popupContent += `<div style="display: flex">`;
                                        popupContent += (map ? `<div class="label-date">${formattedStrDate}~${formattedEndDate}</div>` : "");
                                        popupContent += `<div style="margin-left:auto; padding-right:10px; font-size:0.7rem; align-self: center; color:#b6b4b4;">`;
                                        popupContent += `<div class="label-upt" style="float:right; color:#f86b84;" onclick="popupDelete(${index}, '${escapeHtml(JSON.stringify(data))}',event)"> 삭제</div>`;
                                        popupContent += `<div class="label-upt" style="float:right;" onclick="popupUpdate(${index}, '${siNm}', '${feature.properties.SIG_KOR_NM}', '${escapeHtml(JSON.stringify(data))}',event)">수정&nbsp;•&nbsp;</div>`;
                                        popupContent += `</div>`;
                                        popupContent += `</div>`;

                                        if (map.image) {
                                            imgURL = URL.createObjectURL(base64ToBlob(map.image));
                                            popupContent += `<div id="mapImage" class="label-image" style="margin-bottom:5px;"><img src="${imgURL}" style="width: 50px; display: block; margin-top: 10px;"></div>`;
                                        }

                                        const formattedDescription = map.description.replace(/\n/g, '<br>');
                                        popupContent += (map ? `<div class="label-desc">${formattedDescription}</div>` : "");
                                        if (map.tags && map.tags.length > 0) {
                                            popupContent += `<div class="hash-area">${map.tags.map(tag => `<span class="hash">#</span>${tag}`).join(' ')}</div>`;
                                        }
                                    }
                                });
                            }
                            popupContent += '</div>';
                        }

                        layer.bindPopup(popupContent, popupOptions).openPopup();

                        setTimeout(() => {
                            const mapImageElement = document.getElementById('mapImage');
                            if (mapImageElement) {
                                mapImageElement.addEventListener('click', () => showImagePreview(imgURL));
                            }
                        }, 100);

                        layer.on('popupopen', () => {
                            const mapImageElement = document.getElementById('mapImage');
                            if (mapImageElement) {
                                mapImageElement.addEventListener('click', () => showImagePreview(imgURL));
                            }
                        });
                    }
                });

                const cityName = feature.properties.SIG_KOR_NM;
                const center = layer.getBounds().getCenter();
                const regionCode = feature.properties.SIG_CD.substring(0, 2);

                const isExcludedRegion = excludedRegionCodes.includes(regionCode);
                if (!isExcludedRegion) {
                    const districtLabel = L.marker(center, {
                        icon: L.divIcon({
                            className: 'label',
                            html: cityName,
                            iconSize: adjustLabelSize(map)
                        })
                    }).addTo(map);
                }
            }
        }).addTo(map);

        await updateLabelSizes();

        await loadRegions(mapName);
    });
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t')
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"');
}

async function popupUpdate(index, siNm, gigunguNm, filteredItems, evnet) {
    event.preventDefault();

    const filteredData = JSON.parse(filteredItems);
    const newData = filteredData.splice(index, 1);
    localStorage.setItem('sigunguNm', siNm + ' ' + gigunguNm);

    // 이미지 압축 처리
    if(newData[0].image) {
        const compressedBase64 = await compressImage2(newData[0].image);
        newData[0].image = compressedBase64;
    }

    localStorage.setItem('updateItem', JSON.stringify(newData));
    window.location.href = 'mapInfo.html';
}


function compressImage2(base64Image) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = base64Image;

        img.onload = function () {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            const width = img.width * 0.5;
            const height = img.height * 0.5;
            canvas.width = width;
            canvas.height = height;

            ctx.drawImage(img, 0, 0, width, height);

            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7); // 0.7은 압축 품질 (0.0 ~ 1.0)
            resolve(compressedBase64);
        };

        img.onerror = function () {
            reject(new Error('이미지 로드 실패'));
        };
    });
}

function popupDelete(index, filteredItems, event) {

    event.preventDefault();

    const filteredData = JSON.parse(filteredItems);

    filteredData.splice(index, 1);
    updateIndexedDB(filteredData).then(() => {
        location.reload();
    }).catch((error) => {
        console.error("데이터 삭제 중 오류 발생", error);
    });
}


async function updateIndexedDB(updatedItem) {

    const db = await openIndexedDB('MapColorDB', 1);
    const tx = db.transaction('mapNames', 'readwrite');
    const store = tx.objectStore('mapNames');
    const mapName = localStorage.getItem("mapName");

    const request = store.get(mapName);

    request.onsuccess = function(event) {
        const data = event.target.result;

        if (data) {
            data.data = updatedItem;
            store.put(data);

            console.log("IndexedDB에 업데이트 완료", data);
        } else {
            console.error("데이터를 찾을 수 없습니다.");
        }
    };

    request.onerror = function(event) {
        console.error("IndexedDB 요청 오류", event);
    };

    await tx.complete;
}

function formatDateToYYMMDD(dateString) {

    const date = new Date(dateString);
    const year = String(date.getFullYear()).slice(-2); // 연도의 마지막 두 자리
    const month = String(date.getMonth() + 1).padStart(2, '0'); // 월 (0부터 시작하므로 +1), 두 자리로 맞추기
    const day = String(date.getDate()).padStart(2, '0'); // 일, 두 자리로 맞추기
    return `${year}.${month}.${day}`;
}

function registerLocation(mapName, sigunguCd, event) {

    event.stopPropagation();

    let sigunguNm =  sigunguList[sigunguCd.substring(0, 2)];

    localStorage.setItem('sigunguCd', sigunguCd.substring(0, 2) + sigunguCd);
    localStorage.setItem('mapName', mapName);

    $.getJSON(sigunguJsonUrl, function(data) {
        data.features.forEach(function(feature) {
            if (feature.properties.SIG_CD === sigunguCd) {
                sigunguNm += " (0/0) " + feature.properties.SIG_KOR_NM;
                localStorage.setItem('sigunguNm', sigunguNm);
                window.location.href = 'mapInfo.html';
                return;
            }
        });
    });
}

function updateLabelSizes() {

    const newSize = adjustLabelSize(map);

    map.eachLayer(marker => {
        if (marker instanceof L.Marker && marker.getIcon && marker.getIcon().options.className === 'label') {
            const icon = marker.getIcon();

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = icon.options.html;
            const textContent = tempDiv.textContent || tempDiv.innerText;

            const htmlContent = `<div style="font-size: ${newSize[0]}px; line-height: ${newSize[1]}px; white-space: nowrap;">${textContent}</div>`;

            const newIcon = L.divIcon({
                html: htmlContent,
                className: icon.options.className,
                iconSize: [newSize[0] * 4, newSize[1] * 1.2],
                iconAnchor: [newSize[0] * 2, newSize[1] * 0.6]
            });

            marker.setIcon(newIcon);
        }
    });
}

function adjustLabelSize(map) {

    const zoom = map.getZoom();
    const baseFontSize = 5;
    const scaleFactor = 1.3;

    const fontSize = baseFontSize * Math.pow(scaleFactor, (zoom - 7));
    return [fontSize, fontSize * 1.2];
}

function geoLayer() {

    const sigunguCd = localStorage.getItem("sigunguCd");

    if (!sigunguCd) return;

    const subSigunguCd = sigunguCd.substring(2,  sigunguCd.length);

    if (geojsonLayer) {
        geojsonLayer.eachLayer(layer => {
            if (layer.feature.properties.SIG_CD === subSigunguCd) {
                const center = layer.getBounds().getCenter();
                map.setView(center, 10);
                layer.fire('click');

                //2초후 자동 닫힘 임시 삭제
                // setTimeout(() => {
                //     if (layer.getPopup() && map.hasLayer(layer.getPopup())) {
                //         map.closePopup(layer.getPopup());
                //     }
                // }, 2000);
            }
        });
    }
}

function loadRegions(mapName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(["mapNames"], "readonly");
        const objectStore = transaction.objectStore("mapNames");
        const request = objectStore.getAll();

        request.onsuccess = function(event) {
            const results = event.target.result;

            results.forEach(function(item) {
                if (item.mapName === mapName) {
                    mapNames[mapName] = item.data;
                }
            });

            if (geojsonLayer) {
                geojsonLayer.eachLayer(function(layer) {
                    const districtCode = layer.feature.properties.SIG_CD;
                    const sigunguCd = districtCode.substring(0, 2) + districtCode;

                    if (mapNames[mapName]) {
                        if (Array.isArray(mapNames[mapName])) {
                            mapNames[mapName].forEach(mapNm => {
                                if (mapNm.sigunguCd === sigunguCd && mapNm.color) {

                                    layer.setStyle({
                                        fillColor: mapNm.color,
                                        fillOpacity: 1
                                    });
                                }
                            });
                        }
                    }
                });
            }

            geoLayer(); // 데이터 로드 후 geoLayer() 호출
            resolve();  // Promise 완료
        };

        request.onerror = function(event) {
            console.error("LoadRegions Error loading regions from IndexedDB: " + event.target.errorCode);
            reject(event.target.errorCode);
        };
    });
}

function moveToCurrentLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLatLng = [position.coords.latitude, position.coords.longitude];
                map.setView(userLatLng, 12);
                let closestLayer = null;
                let minDistance = Infinity;

                if (geojsonLayer) {
                    geojsonLayer.eachLayer(layer => {
                        const center = layer.getBounds().getCenter();
                        const distance = map.distance(userLatLng, center);

                        if (distance < minDistance) {
                            minDistance = distance;
                            closestLayer = layer;
                        }
                    });
                }

                if (closestLayer) {
                    applyDotPattern(closestLayer);
                }
            },
            (error) => {
                console.error("Error Code =", error.code, "-", error.message);

                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        alert("위치 권한이 거부되었습니다. 설정에서 위치 권한을 허용해주세요.");
                        break;
                    case error.POSITION_UNAVAILABLE:
                        alert("위치 정보를 사용할 수 없습니다.");
                        break;
                    case error.TIMEOUT:
                        alert("위치 정보 요청이 시간 초과되었습니다.");
                        break;
                    default:
                        alert("위치 정보를 가져오는 중 오류가 발생했습니다.");
                        break;
                }

                // 오류 발생 시 기본 위치로 이동
                map.setView(center, 7); // 대한민국 중심 좌표로 이동
            }
        );
    } else {
        alert("이 브라우저에서는 위치 정보 기능을 지원하지 않습니다.");
        map.setView(center, 7); // 대한민국 중심 좌표로 이동
    }
}

function applyDotPattern(layer) {

    const canvas = document.createElement('canvas');
    canvas.width = 20;
    canvas.height = 20;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(0, 0, 255, 0.1)'; // 파란색 배경
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(52, 150, 255, 0.5)'; // 반투명 점
    ctx.beginPath();
    ctx.arc(10, 10, 3, 0, Math.PI * 2); // 점의 위치와 크기
    ctx.fill();

    layer.setStyle({
        fillPattern: ctx.createPattern(canvas, 'repeat'),
        fillOpacity: 0.8,
        color: '#3496ff',
        weight: 2,
        opacity: 1
    });
}

function saveMapName(db, mapName) {

    const transaction = db.transaction(["mapNames"], "readwrite");
    const objectStore = transaction.objectStore("mapNames");
    const mapNameObject = { mapName: mapName, createDate : Date.now() };
    const request = objectStore.put(mapNameObject);

    request.onsuccess = function(event) {
        console.log("Map name saved successfully.");
        nextPage(0, mapName);
    };

    request.onerror = function(event) {
        console.error("Error saving map name:", event.target.errorCode);
    };
}

async function saveMapInfo() {
    const updateItem = JSON.parse(localStorage.getItem('updateItem'));
    const type = updateItem ? 'U' : 'R';
    const mapName = localStorage.getItem("mapName");
    const sigunguCd = localStorage.getItem("sigunguCd");
    const color = document.getElementById('selectedColor').value;
    const strDate = document.getElementById('strDatePicker').value;
    const endDate = document.getElementById('endDatePicker').value;
    const description = document.getElementById('description').value;
    const tags = [];
    document.querySelectorAll('#tag-container .tag').forEach(tagElement => {
        tags.push(tagElement.textContent.replace('#', '').trim());
    });

    document.getElementById('date-error').textContent = '';
    document.getElementById('desc-error').textContent = '';
    document.getElementById('color-error').textContent = '';

    let valid = true;

    if (!strDate || !endDate) {
        document.getElementById('date-error').textContent = '여행기간을 입력해주세요.';
        valid = false;
    }

    if (!description) {
        document.getElementById('desc-error').textContent = '메모를 입력해주세요.';
        valid = false;
    }

    if (!color) {
        document.getElementById('color-error').textContent = '색상을 선택해주세요.';
        valid = false;
    }

    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    let base64Image = null;

    if (file) {
        const imageBlob = await compressImage(file, 350, 300, 1.0);
        base64Image = await blobToBase64(imageBlob);
    } else if (type === 'U' && updateItem[0].image) {
        if(localStorage.getItem('imageRemove') !== 'Y') {
            base64Image = updateItem[0].image;
        } else {
            base64Image = null;
            localStorage.removeItem('imageRemove');
        }
    }

    if (valid) {
        const data = {
            sigunguCd: sigunguCd,
            color: color,
            strDate: strDate,
            endDate: endDate,
            description: description,
            tags: tags,
            image: base64Image
        }

        type === 'R' ? await saveMapInfos(mapName, data) : await uptMapInfos(updateItem, mapName, data)
        if(type === 'U') localStorage.removeItem('updateItem');
        nextPage(3);
    }
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result); // Base64 데이터 반환
        reader.onerror = reject;
        reader.readAsDataURL(blob); // Blob을 Base64로 변환
    });
}

function base64ToBlob(base64, mimeType) {
    if (!base64) return undefined;
    const byteCharacters = atob(base64.split(',')[1]);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
}

function base64ToBlob2(base64Data, contentType = '', sliceSize = 512) {
    const byteCharacters = atob(base64Data);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
        const slice = byteCharacters.slice(offset, offset + sliceSize);

        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }

        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }

    return new Blob(byteArrays, { type: contentType });
}

function compressImage(file, maxWidth, maxHeight, quality) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.src = event.target.result;

            img.onload = function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                let width = img.width;
                let height = img.height;

                // 비율 유지하며 크기 조정 임시 삭제
                // if (width > maxWidth || height > maxHeight) {
                //     if (width > height) {
                //         height = Math.round((height *= maxWidth / width));
                //         width = maxWidth;
                //     } else {
                //         width = Math.round((width *= maxHeight / height));
                //         height = maxHeight;
                //     }
                // }

                canvas.width = width;
                canvas.height = height;

                ctx.drawImage(img, 0, 0, width, height);

                // 압축된 이미지 생성
                canvas.toBlob(
                    (blob) => {
                        resolve(blob);
                    },
                    file.type, // 파일의 원본 타입
                    quality // 품질 (0.0 ~ 1.0)
                );
            };

            img.onerror = function() {
                reject(new Error('이미지 로딩에 실패했습니다.'));
            };
        };

        reader.onerror = function(event) {
            reject(event.target.error);
        };

        reader.readAsDataURL(file); // 이미지 데이터를 읽어옴
    });
}

async function uptMapInfos(updateItem, mapName, data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(["mapNames"], "readwrite");
        const objectStore = transaction.objectStore("mapNames");
        const request = objectStore.getAll();

        request.onsuccess = function (event) {
            const allData = event.target.result;
            const resultMapInfo = allData.filter(item => item.mapName === mapName);

            if (resultMapInfo.length > 0) {
                const itemToUpdate = resultMapInfo[0];

                if (!Array.isArray(itemToUpdate.data)) {
                    itemToUpdate.data = [];
                }

                const existingIndex = itemToUpdate.data.findIndex(existingData =>
                    deepEqual(
                        { ...existingData, image: undefined },
                        { ...updateItem[0], image: undefined }
                    )
                );

                if (existingIndex !== -1) {
                    itemToUpdate.data.splice(existingIndex, 1);
                }

                itemToUpdate.data.push(data);

                const updateRequest = objectStore.put(itemToUpdate);

                updateRequest.onsuccess = function () {
                    localStorage.removeItem('updateItem');
                    console.log("saveMapInfos Data updated successfully:", itemToUpdate);
                };

                updateRequest.onerror = function (event) {
                    console.error("saveMapInfos infos Update error: " + event.target.errorCode);
                };
            }
        };

        request.onerror = function (event) {
            console.error("saveMapInfos Request error: " + event.target.errorCode);
        };

        transaction.onerror = function (event) {
            console.error("saveMapInfos Transaction error: " + event.target.errorCode);
            reject(event.target.errorCode);
        };

        // 트랜잭션 완료 후 resolve 호출
        transaction.oncomplete = function() {
            console.log("Transaction completed successfully.");
            resolve();
        };
    });
}

function deepEqual(obj1, obj2) {

    if (obj1 === obj2) {
        return true;
    }

    if (typeof obj1 !== 'object' || typeof obj2 !== 'object' || obj1 === null || obj2 === null) {
        return false;
    }

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) {
        return false;
    }

    for (let key of keys1) {
        if (!keys2.includes(key) || !deepEqual(obj1[key], obj2[key])) {
            return false;
        }
    }

    return true;
}


async function saveMapInfos(mapName, data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(["mapNames"], "readwrite");
        const objectStore = transaction.objectStore("mapNames");

        const request = objectStore.getAll();

        request.onsuccess = function(event) {
            const allData = event.target.result;
            const resultMapInfo = allData.filter(item => item.mapName === mapName);

            if (resultMapInfo.length > 0) {
                const itemToUpdate = resultMapInfo[0];

                if (!Array.isArray(itemToUpdate.data)) {
                    itemToUpdate.data = [];
                }

                itemToUpdate.data.push(data);

                const updateRequest = objectStore.put(itemToUpdate);

                updateRequest.onsuccess = function() {
                    console.log("saveMapInfos Data updated successfully:", itemToUpdate);
                };

                updateRequest.onerror = function(event) {
                    console.error("saveMapInfos infos Update error: " + event.target.errorCode);
                    reject(event.target.error);
                };
            }
        };

        request.onerror = function(event) {
            console.error("saveMapInfos Request error: " + event.target.errorCode);
            reject(event.target.error);
        };

        // 트랜잭션 완료 후 resolve 호출
        transaction.oncomplete = function() {
            console.log("Transaction completed successfully.");
            resolve();
        };

        transaction.onerror = function(event) {
            console.error("Transaction error: " + event.target.errorCode);
            reject(event.target.errorCode);
        };
    });
}

async function deleteMapInfo() {

    if (confirm("정말 모든 데이터를 삭제하시겠습니까?")) {
        await realDeleteMapInfo();
        alert("데이터가 삭제되었습니다.");
    }
}

function realDeleteMapInfo() {
    const request = indexedDB.open("MapColorDB", 1);

    request.onerror = (event) => console.error("Database error:", event.target.errorCode);

    request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction(["mapNames"], "readwrite");
        const objectStore = transaction.objectStore("mapNames");

        const clearRequest = objectStore.clear();

        clearRequest.onsuccess = () => {
            console.log("All data cleared successfully.");
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
        case 4:
            localStorage.setItem("mapName", data);
            window.location.href = "timeLine.html";
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

    document.querySelectorAll(".sigunguList li").forEach((li) => {
        const sgg = li.getAttribute('data-sgg');
        const cnt = allData.reduce((total, item) => {
            if (item.mapName === mapName && Array.isArray(item.data)) {
                const uniqueSigunguCds = new Set();

                item.data.forEach(dataItem => {
                    if (dataItem.sigunguCd.startsWith(sgg)) {
                        uniqueSigunguCds.add(dataItem.sigunguCd);
                    }
                });
                return total + uniqueSigunguCds.size;
            }
            return total;
        }, 0);

        const text = li.textContent.replace(/\s\(\d+\/\d+\)$/, '');

        const totCnt = sigunguData.features.filter(feature => feature.properties.SIG_CD.startsWith(sgg)).length;
        li.innerText = `${text} (${cnt}/${totCnt})`;
    });
}

function goSidoDetail(obj, code) {

    const mapName = localStorage.getItem("mapName");
    const transaction = db.transaction(["mapNames"], "readonly");
    const objectStore = transaction.objectStore("mapNames");
    const request = objectStore.getAll();

    request.onsuccess = function(event) {

        const results = event.target.result;

        results.forEach(function (item) {
            if (item.mapName === mapName) {
                mapNames[mapName] = item.data;
            }
        });
    }

    const nextElement = obj.nextElementSibling;

    if (nextElement && nextElement.id === 'detailList') {
        nextElement.parentNode.removeChild(nextElement);
        return;
    }

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

                if(mapNames[mapName]) {
                    mapNames[mapName].forEach(data => {
                        if(data.sigunguCd.substring(2, 8) === feature.properties.SIG_CD) {
                            li.classList.add('point');
                        }
                    })
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

function daysSince(startDate) {
    const start = new Date(startDate);
    const now = new Date();

    start.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);

    const diffInMs = now - start;
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    return diffInDays;
}

function formatDate(date) {
    const year = String(date.getFullYear()).slice(-2); // 연도 가져오기
    const month = String(date.getMonth() + 1).padStart(2, '0'); // 월 가져오기 (0부터 시작하므로 +1 필요), 두 자리로 맞추기
    const day = String(date.getDate()).padStart(2, '0'); // 일 가져오기, 두 자리로 맞추기

    return `${year}.${month}.${day}`;
}

function mapNamesNextPage(mapName) {
    nextPage(1, mapName);
}

async function fnDelete(event, data) {

    const db = await openIndexedDB("MapColorDB", 1);
    const transaction = db.transaction("mapNames", "readwrite");
    const objectStore = transaction.objectStore("mapNames");
    const deleteRequest = objectStore.delete(data.mapName);

    deleteRequest.onsuccess = () => {
        location.reload();
    };
    deleteRequest.onerror = (event) => {
        console.error("Error deleting map:", event.target.error);
    };
}

function fnModify(event, data, index) {

    const div = event.target.closest('.name-box');

    if (!div) return;

    const titDiv = div.querySelector('.tit-name');
    const currentText = titDiv.textContent;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentText;
    input.className = 'tit-input';
    input.maxLength = 10;

    titDiv.replaceWith(input);

    const menuArea = div.querySelector('.menu-area');
    if (menuArea) {
        menuArea.style.display = 'none';
    }

    input.focus();
    input.addEventListener('blur', async () => {
        const newTitDiv = document.createElement('div');
        newTitDiv.className = 'tit-name';
        // 빈값일 경우 원래 텍스트 유지
        newTitDiv.textContent = input.value || currentText;
        input.replaceWith(newTitDiv);

        const db = await openIndexedDB("MapColorDB", 1);
        const allDatas = await getAllData(db, "mapNames");
        allDatas.sort((a, b) => b.createDate - a.createDate);

        // 동일한 mapName이 이미 존재하는지 확인
        const isDuplicate = allDatas.some((data2, index2) => index !== index2 && data2.mapName === newTitDiv.textContent);

        if (isDuplicate) {
            newTitDiv.textContent = currentText;
            input.replaceWith(newTitDiv);
            alert('이미 등록된 지도 주제예요.');
        } else {
            saveNewMapName(data, newTitDiv.textContent);
        }
    });

    // Enter 키를 누르면 tit-name으로 되돌리고 데이터 저장
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            input.blur();
        }
    });
}

async function saveNewMapName(data, newName) {

    try {

        const originalMapName = data.mapName;
        data.mapName = newName;

        const db = await openIndexedDB("MapColorDB", 1);
        const transaction = db.transaction("mapNames", "readwrite");
        const objectStore = transaction.objectStore("mapNames");

        const deleteRequest = objectStore.delete(originalMapName);

        deleteRequest.onsuccess = () => {

            const updateRequest = objectStore.put(data);

            updateRequest.onsuccess = () => {
                console.log(`Map name updated from ${originalMapName} to ${newName}`);
            };

            updateRequest.onerror = (event) => {
                console.error("Error updating map name:", event.target.error);
            };
        };

        deleteRequest.onerror = (event) => {
            console.error("Error deleting old map name:", event.target.error);
        };

    } catch (error) {
        console.error("Failed to update map name:", error);
    }
}

function clearLocalStorage() {
    localStorage.clear();
}

function startBackup() {
    const dbRequest = indexedDB.open('MapColorDB', 1);

    dbRequest.onsuccess = async function (event) {
        const db = event.target.result;
        const transaction = db.transaction('mapNames', 'readonly');
        const objectStore = transaction.objectStore('mapNames');

        const request = objectStore.getAll();
        request.onsuccess = async function (event) {
            const data = event.target.result;

            let totalItems = data.length;
            let backedUpItems = 0;

            const backup = [];

            for (const item of data) {
                if (item.image && item.image instanceof Blob) {
                    item.imageBase64 = await blobToBase64(item.image);
                }

                backup.push(item);

                backedUpItems++;

                const btn = document.getElementById('backup-btn-area');
                btn.style.display = 'none';
            }

            const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
            const fileName = `mapApp_backup_${fileFormatDate(new Date())}.json`;

            if (window.Android) {
                const base64Data = await blobToBase64Android(blob);
                window.Android.saveBackupFile(base64Data, fileName);
            } else {
                const base64Data = await blobToBase64(blob);
                await saveFile(blob, fileName);
            }
            saveBackupInfo(blob.size, fileName);
        };
    };
}

function fileFormatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // 월은 0부터 시작하므로 +1
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function blobToBase64Android(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64data = reader.result.split(',')[1];
            resolve(base64data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function saveFile(blob, fileName) {
    await saveAs(blob, fileName);
}

function saveBackupInfo(fileSize, fileName) {
    document.getElementById('backup-detail-area').style.display = 'flex';
    const backupInfo = {
        date: new Date().toLocaleString(),
        device: navigator.userAgent,
        fileSize: (fileSize / (1024 * 1024)).toFixed(2) + ' MB',
        fileName: fileName
    };

    localStorage.setItem('backupInfo', JSON.stringify(backupInfo));

    const date = document.getElementById('backup-date');
    date.innerText = `${backupInfo.date}`;
    const device = document.getElementById('backup-device');
    device.innerText = `${backupInfo.device}`;
    const capacity = document.getElementById('backup-capacity');
    capacity.innerText = `${backupInfo.fileSize}`;
    const path = document.getElementById('backup-path');
    path.innerText = `${backupInfo.fileName}`;
}

async function startRestored() {
    const fileInput = document.getElementById('restoreFileInput');
    const file = fileInput.files[0];

    if(file) {
        await realDeleteMapInfo();
    }

    const reader = new FileReader();

    reader.onload = async function(event) {
        const jsonData = JSON.parse(event.target.result);

        await restoreDataToIndexedDB(jsonData);

        const restoreInfo = {
            date: new Date().toISOString(),
            device: getDeviceType(),
            fileSize: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
            fileName: file.name
        };

        displayRestoreInfo(restoreInfo);
    };

    reader.readAsText(file);
}

async function restoreDataToIndexedDB(data) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("MapColorDB", 1);

        request.onsuccess = (event) => {
            const db = event.target.result;
            const transaction = db.transaction("mapNames", "readwrite");
            const objectStore = transaction.objectStore("mapNames");

            data.forEach(item => {
                objectStore.put(item); // 복원 데이터를 IndexedDB에 저장
            });

            transaction.oncomplete = () => {
                console.log('복원이 완료되었습니다!');
                resolve();
            };

            transaction.onerror = (event) => {
                console.error('IndexedDB 복원 오류:', event.target.errorCode);
                reject(event.target.error);
            };
        };

        request.onerror = (event) => {
            console.error('IndexedDB 열기 오류:', event.target.errorCode);
            reject(event.target.error);
        };
    });
}

function displayRestoreInfo(restoredInfo) {
    document.getElementById('restored-btn-area').style.display = 'none';
    document.getElementById('restored-detail-area').style.display = 'flex';
    document.getElementById('go-mapNames').style.display = 'flex';
    localStorage.setItem('restoredInfo', JSON.stringify(restoredInfo));

    if (restoredInfo) {
        const date = document.getElementById('restored-date');
        date.innerText = `${restoredInfo.date}`;
        const device = document.getElementById('restored-device');
        device.innerText = `${restoredInfo.device}`;
        const capacity = document.getElementById('restored-capacity');
        capacity.innerText = `${restoredInfo.fileSize}`;
        const path = document.getElementById('restored-path');
        path.innerText = `${restoredInfo.fileName}`;
    }
}

function getDeviceType() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    if (/android/i.test(userAgent)) {
        return "Android";
    }
    if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
        return "iOS";
    }
    return "PC";
}

function toDevMail() {
    const subject = encodeURIComponent('지도뿌셔 의견/문의글입니다.');
    const mailToLink = `mailto:devmango1128@gmail.com?subject=${subject}`;
    window.location.href = mailToLink;
}

function review() {
    window.location.href = 'https://play.google.com/store/apps/details?id=com.colormap.devmango1128';
}

async function recommend() {
    if (navigator.share) {
        try {
            await navigator.share({
                title: '지도뿌셔',
                text: '지도뿌셔 앱을 추천해요!',
                url: 'https://play.google.com/store/apps/details?id=com.colormap.devmango1128'
            });
            console.log('공유 성공!');
        } catch (error) {
            console.error('공유 실패:', error);
        }
    } else if (window.Android) {
        window.Android.share('지도뿌셔', '지도뿌셔 앱을 추천해요!', 'https://play.google.com/store/apps/details?id=com.colormap.devmango1128');
    } else {
        alert('이 브라우저는 추천기능을 지원하지 않습니다.');
        return;
    }
}

function goApp(div) {

    let url = '';

    switch (div) {
        case 'L' :
            url = 'https://play.google.com/store/apps/details?id=com.lotto.devmango1128';
            break;
        case 'P' :
            url = 'https://play.google.com/store/apps/details?id=com.pomodoro.devmango1128';
            break;
        case 'F' :
            url = 'https://play.google.com/store/apps/details?id=com.fartsound.devmango1128';
            break;
        case 'T' :
            url = 'https://play.google.com/store/apps/details?id=com.selectmenu.devmango1128';
            break;
    }

    window.location.href = url;
}

function showImagePreview(imgURL) {

    const existingPreview = document.querySelector('.image-preview-layer');
    if (existingPreview) {
        existingPreview.remove();
    }

    const previewLayer = document.createElement('div');
    previewLayer.className = 'image-preview-layer';
    previewLayer.style.position = 'fixed';
    previewLayer.style.top = '0';
    previewLayer.style.left = '0';
    previewLayer.style.width = '100vw';
    previewLayer.style.height = '100vh';
    previewLayer.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    previewLayer.style.display = 'flex';
    previewLayer.style.alignItems = 'center';
    previewLayer.style.justifyContent = 'center';
    previewLayer.style.zIndex = '9999';
    previewLayer.style.cursor = 'pointer';

    const largeImg = document.createElement('img');
    largeImg.src = imgURL;
    largeImg.style.maxWidth = '80vw';
    largeImg.style.maxHeight = '80vh';
    largeImg.style.borderRadius = '8px';
    largeImg.style.objectFit = 'contain';

    previewLayer.appendChild(largeImg);

    previewLayer.addEventListener('click', () => {
        document.body.removeChild(previewLayer);
    });

    document.body.appendChild(previewLayer);
}
