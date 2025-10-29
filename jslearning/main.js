// main.js

// --- Biến Toàn cục ---
let scene, camera, renderer, controls;
const container = document.getElementById('container');
const points = []; 
const selectedIndices = new Set(); 
const AXIS_LIMIT = 5; 
const FONT_PATH = 'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json'; 
const EPSILON = 1e-4; 

let verticalAxis = 'Y'; 
let axisObjects = []; 

let triangleCalcData = null; 
let altitudeCount = { A: 0, B: 0, C: 0 }; 

// HÀM HÌNH HỌC PHỤ TRỢ 

function vectorMagnitude(vec) {
    return Math.sqrt(vec.x * vec.x + vec.y * vec.y + vec.z * vec.z);
}

function crossProduct(vecA, vecB) {
    const x = vecA.y * vecB.z - vecA.z * vecB.y;
    const y = vecA.z * vecB.x - vecA.x * vecB.z;
    const z = vecA.x * vecB.y - vecA.y * vecB.z;
    return new THREE.Vector3(x, y, z);
}

function dotProduct(vecA, vecB) {
    return vecA.x * vecB.x + vecA.y * vecB.y + vecA.z * vecB.z;
}

function getProjectionPoint(P, A, B) {
    const vectorAP = new THREE.Vector3().subVectors(P, A);
    const vectorAB = new THREE.Vector3().subVectors(B, A);

    const dotP = dotProduct(vectorAP, vectorAB);
    const lengthSqAB = vectorAB.lengthSq();

    if (lengthSqAB < EPSILON) {
        return A.clone(); 
    }

    const t = dotP / lengthSqAB;
    
    const vectorAH = vectorAB.clone().multiplyScalar(t);
    const H = A.clone().add(vectorAH);

    return H;
}

function getVectorFromIndices(startIndex, endIndex) {
    const startIdx = parseInt(startIndex);
    const endIdx = parseInt(endIndex);

    if (isNaN(startIdx) || isNaN(endIdx) || startIdx === endIdx || !points[startIdx] || !points[endIdx]) {
        return null;
    }
    
    const pStart = new THREE.Vector3(points[startIdx].x, points[startIdx].y, points[startIdx].z);
    const pEnd = new THREE.Vector3(points[endIdx].x, points[endIdx].y, points[endIdx].z);

    const vector = new THREE.Vector3().subVectors(pEnd, pStart);
    const startName = points[startIdx].name;
    const endName = points[endIdx].name;

    return { 
        u: vector, 
        name: `\\vec{${startName}${endName}}` 
    };
}


// --- LOGIC ÁNH XẠ TỌA ĐỘ ---

function getMappedPosition(x, y, z) {
    switch (verticalAxis) {
        case 'X':
            return new THREE.Vector3(y, x, z); 
        case 'Z':
            return new THREE.Vector3(x, z, y); 
        case 'Y':
        default:
            return new THREE.Vector3(x, y, z); 
    }
}

function getAxisVectors(axis) {
    const L = AXIS_LIMIT;
    
    let pX_idx = 0, pY_idx = 1, pZ_idx = 2; 
    
    if (verticalAxis === 'X') {
        pX_idx = 1; 
        pY_idx = 0; 
        pZ_idx = 2; 
    } else if (verticalAxis === 'Z') {
        pX_idx = 0; 
        pY_idx = 2; 
        pZ_idx = 1; 
    }

    const v = [0, 0, 0]; 
    
    if (axis === 'X') v[pX_idx] = 1;
    if (axis === 'Y') v[pY_idx] = 1;
    if (axis === 'Z') v[pZ_idx] = 1;

    return {
        start: new THREE.Vector3(-L * v[0], -L * v[1], -L * v[2]),
        end: new THREE.Vector3(L * v[0], L * v[1], L * v[2]),
        labelPos: new THREE.Vector3((L + 0.1) * v[0], (L + 0.1) * v[1], (L + 0.1) * v[2])
    };
}

// HÀM VẼ VÀ CẬP NHẬT SCENE 

function clearAxisObjects() {
    axisObjects.forEach(obj => scene.remove(obj));
    axisObjects = [];
}

function redrawSceneAxes() {
    clearAxisObjects();
    
    let cameraPos;
    switch (verticalAxis) {
        case 'X':
            cameraPos = new THREE.Vector3(AXIS_LIMIT * 2, AXIS_LIMIT * 3, AXIS_LIMIT * 3); 
            break;
        case 'Z':
            cameraPos = new THREE.Vector3(AXIS_LIMIT * 3, AXIS_LIMIT * 3, AXIS_LIMIT * 2); 
            break;
        case 'Y':
        default:
            cameraPos = new THREE.Vector3(AXIS_LIMIT * 3, AXIS_LIMIT * 2, AXIS_LIMIT * 3); 
            break;
    }
    camera.position.copy(cameraPos);
    camera.lookAt(0, 0, 0);

    const axesToDraw = ['X', 'Y', 'Z'];
    const colors = { 'X': 0xff0000, 'Y': 0x00ff00, 'Z': 0x0000ff };
    
    axesToDraw.forEach(axis => {
        const { start, end } = getAxisVectors(axis);
        const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: colors[axis] }));
        scene.add(line);
        axisObjects.push(line);
    });

    const loader = new THREE.FontLoader();
    loader.load(FONT_PATH, function (font) {
        const textParams = {
            font: font,
            size: 0.3, 
            height: 0.05,
        };
        
        const createLabel = (text, color, position) => {
            let geometry = new THREE.TextGeometry(text, textParams);
            let material = new THREE.MeshBasicMaterial({ color: color });
            let mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(position);
            scene.add(mesh);
            axisObjects.push(mesh);
        };

        axesToDraw.forEach(axis => {
            const { labelPos } = getAxisVectors(axis);
            createLabel(axis, colors[axis], labelPos); 
        });
    });
}

function updatePointPositions() {
    points.forEach(point => {
        const newPos = getMappedPosition(point.x, point.y, point.z);
        point.mesh.position.copy(newPos);

        if (point.labelMesh) {
            point.labelMesh.position.set(newPos.x + 0.3, newPos.y + 0.3, newPos.z);
        }
    });

    points.forEach(point => {
        point.lines.forEach(line => {
            const [indexA, indexB] = line.userData.pointIndices;
            
            const posA = points[indexA].mesh.position;
            const posB = points[indexB].mesh.position;

            line.geometry.setFromPoints([posA, posB]);
            line.geometry.attributes.position.needsUpdate = true;
        });
    });
    
    document.getElementById('triangleResults').innerHTML += '<p class="error-message">Đã thay đổi trục. Vui lòng nhấn lại nút "Thêm Chân Đường cao" để thêm điểm chính xác.</p>';
}

function createPointLabel(name, position) {
    const loader = new THREE.FontLoader();
    loader.load(FONT_PATH, function (font) {
        const textParams = {
            font: font,
            size: 0.25, 
            height: 0.05,
        };
        let geometry = new THREE.TextGeometry(name, textParams);
        let material = new THREE.MeshBasicMaterial({ color: 0xffffff }); 
        let mesh = new THREE.Mesh(geometry, material);
        
        mesh.position.set(position.x + 0.3, position.y + 0.3, position.z);
        
        mesh.name = 'label'; 
        scene.add(mesh);
        
        points[points.length - 1].labelMesh = mesh;
    });
}

// HÀM CẬP NHẬT GIAO DIỆN CHỌN VECTOR

function updateVectorSelectors() {
    const allSelects = document.querySelectorAll('.point-select');
    
    const optionsHtml = points.map((point, index) => {
        const name = point.isAutoGenerated ? `${point.name}*` : point.name;
        return `<option value="${index}">${name} (${point.x.toFixed(2)}, ${point.y.toFixed(2)}, ${point.z.toFixed(2)})</option>`;
    }).join('');

    allSelects.forEach(select => {
        const currentValue = select.value; 
        select.innerHTML = '<option value="">-- Chọn Điểm --</option>' + optionsHtml;
        
        if (currentValue && optionsHtml.includes(`value="${currentValue}"`)) {
             select.value = currentValue;
        } else {
             select.value = ""; 
        }
    });
}


// LOGIC TẠO ĐIỂM MỚI

function isPointExists(name) {
    return points.some(point => point.name === name);
}

function addVisualPoint(name, x, y, z, isAutoGenerated = false) {
    points.push({ name, x, y, z, mesh: null, lines: [], isAutoGenerated, labelMesh: null }); 

    const mappedPos = getMappedPosition(x, y, z);
    const index = points.length - 1;
    
    const color = isAutoGenerated ? 0x0000ff : 0x00ff00; 

    const geometry = new THREE.SphereGeometry(0.2, 32, 32); 
    const material = new THREE.MeshBasicMaterial({ color: color });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(mappedPos);
    mesh.userData = { index: index }; 

    scene.add(mesh);
    points[index].mesh = mesh; 
    
    createPointLabel(name, mappedPos);
    updateVectorSelectors();
    return index;
}

function handleAddBatchPoints() {
    const data = document.getElementById('batch_coords').value;
    const lines = data.trim().split('\n');
    let addedCount = 0;
    const errors = [];

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine === '') continue;

        const parts = trimmedLine.replace(/\s+/g, ' ').split(' ');

        if (parts.length < 4) {
            errors.push(`Dòng không hợp lệ (thiếu giá trị): "${trimmedLine}".`);
            continue; 
        }

        const name = parts[0];
        const x = parseFloat(parts[1]);
        const y = parseFloat(parts[2]);
        const z = parseFloat(parts[3]);

        if (isNaN(x) || isNaN(y) || isNaN(z)) {
            errors.push(`Dòng có tọa độ không phải là số: "${trimmedLine}".`);
            continue;
        }
        
        if (isPointExists(name)) {
            errors.push(`Điểm "${name}" đã tồn tại. Bỏ qua.`);
            continue;
        }

        addVisualPoint(name, x, y, z, false); 
        addedCount++;
    }

    if (addedCount > 0) {
        updatePointsList();
        updateVectorSelectors(); 
        document.getElementById('batch_coords').value = '';
        let message = `Đã thêm thành công ${addedCount} điểm.`;
        if (errors.length > 0) {
             message += `\nLƯU Ý: Có ${errors.length} vấn đề. Kiểm tra Console log để biết chi tiết.`;
             errors.forEach(err => console.error(err));
        }
        alert(message);
    } else {
        alert("Không có điểm hợp lệ nào được thêm vào.");
    }
}


// Xử lý sự kiện điểm

function updatePointsList() {
    const listElement = document.getElementById('pointsList');
    listElement.innerHTML = '';
    points.forEach((point, index) => {
        const item = document.createElement('div');
        item.className = 'point-item';
        if (selectedIndices.has(index)) {
            item.classList.add('selected-point');
        }
        const nameDisplay = point.isAutoGenerated ? `${point.name}*` : point.name;
        item.innerHTML = `<span class="point-index">${nameDisplay}</span><span class="point-coords">(${point.x.toFixed(4)}, ${point.y.toFixed(4)}, ${point.z.toFixed(4)})</span>`;
        item.onclick = () => togglePointSelection(index);
        listElement.appendChild(item);
    });
}

function togglePointSelection(index) {
    if (!points[index]) return;

    const mesh = points[index].mesh;
    const defaultColor = points[index].isAutoGenerated ? 0x0000ff : 0x00ff00;

    if (selectedIndices.has(index)) {
        selectedIndices.delete(index);
        mesh.material.color.set(defaultColor); 
    } else {
        selectedIndices.add(index);
        mesh.material.color.set(0xff0000); 
    }
    updatePointsList();
}

function handleConnectPoints() {
    if (selectedIndices.size < 2) {
        alert("Vui lòng chọn ít nhất 2 điểm để nối.");
        return;
    }

    const indices = Array.from(selectedIndices).sort((a, b) => a - b);
    
    handleDeleteSelectedLines(true);
    
    for (let i = 0; i < indices.length; i++) {
        const indexA = indices[i];
        const indexB = indices[(i + 1) % indices.length];
        const startPoint = points[indexA];
        const endPoint = points[indexB]; 

        const material = new THREE.LineBasicMaterial({ color: 0xffff00 }); 
        const geometry = new THREE.BufferGeometry().setFromPoints([
            startPoint.mesh.position, 
            endPoint.mesh.position
        ]);

        const line = new THREE.Line(geometry, material);
        line.userData.pointIndices = [indexA, indexB]; 

        scene.add(line);

        startPoint.lines.push(line);
        endPoint.lines.push(line);
    }
    
    selectedIndices.clear();
    points.forEach(p => p.mesh.material.color.set(p.isAutoGenerated ? 0x0000ff : 0x00ff00));
    updatePointsList();
}

function handleDeleteSelectedLines(silent = false) {
    if (selectedIndices.size < 2) {
        if (!silent) alert("Vui lòng chọn ít nhất 2 điểm để xóa các đường nối giữa chúng.");
        return;
    }

    const indices = Array.from(selectedIndices);
    let linesRemovedCount = 0;

    indices.forEach(pointIndex => {
        const point = points[pointIndex];
        const linesToKeep = [];

        point.lines.forEach(line => {
            const lineIndices = line.userData.pointIndices;
            if (!lineIndices) {
                linesToKeep.push(line);
                return;
            }
            
            const otherPointIndex = lineIndices.find(i => i !== pointIndex);
            
            if (otherPointIndex !== undefined && indices.includes(otherPointIndex)) {
                scene.remove(line);
                linesRemovedCount++;

                const otherPoint = points[otherPointIndex];
                if (otherPoint) {
                    otherPoint.lines = otherPoint.lines.filter(l => l !== line);
                }
            } else {
                linesToKeep.push(line);
            }
        });
        
        point.lines = linesToKeep;
    });
    
    if (!silent && linesRemovedCount > 0) {
         alert(`Đã xóa ${linesRemovedCount / 2} đường nối giữa các điểm đã chọn.`);
    }
    
    selectedIndices.clear();
    points.forEach(p => p.mesh.material.color.set(p.isAutoGenerated ? 0x0000ff : 0x00ff00));
    updatePointsList();
}

function handleDeleteSelected() {
    if (selectedIndices.size === 0) {
        alert("Vui lòng chọn ít nhất 1 điểm để xóa.");
        return;
    }

    const indicesToDelete = Array.from(selectedIndices);
    const newPoints = [];
    
    points.forEach((point, index) => {
        if (indicesToDelete.includes(index)) {
            scene.remove(point.mesh);
            if (point.labelMesh) scene.remove(point.labelMesh); 
            
            point.lines.forEach(line => scene.remove(line));
            
            if (point.isAutoGenerated && point.name.startsWith('H_')) {
                const prefix = point.name.split('_')[1].substring(0, 1);
                if (altitudeCount[prefix] > 0) {
                    altitudeCount[prefix]--;
                }
            }
            
        } else {
            newPoints.push(point);
        }
    });

    newPoints.forEach(point => {
        point.lines = point.lines.filter(line => {
            const lineIndices = line.userData.pointIndices;
            return lineIndices && !indicesToDelete.includes(lineIndices[0]) && !indicesToDelete.includes(lineIndices[1]);
        });
    });

    points.length = 0; 
    newPoints.forEach(point => points.push(point)); 

    points.forEach((point, newIndex) => {
        const oldIndex = point.mesh.userData.index;

        point.mesh.userData.index = newIndex; 
        
        point.lines.forEach(line => {
             const lineIndices = line.userData.pointIndices;
             if (lineIndices) {
                 if (lineIndices[0] === oldIndex) lineIndices[0] = newIndex;
                 if (lineIndices[1] === oldIndex) lineIndices[1] = newIndex;
             }
        });
    });

    selectedIndices.clear();
    updatePointsList();
    updateVectorSelectors(); 
    
    alert(`Đã xóa ${indicesToDelete.length} điểm.`);
}

/**
 * Hàm chính để xóa toàn bộ scene.
 * Đã kiểm tra và đảm bảo xóa point.labelMesh.
 */

function handleClearScene() {
    points.forEach(point => {
        scene.remove(point.mesh);
        // LỆNH CẦN THIẾT ĐÃ ĐƯỢC XÁC NHẬN: Xóa nhãn tên điểm
        if (point.labelMesh) {
            scene.remove(point.labelMesh);
        }
        point.lines.forEach(line => scene.remove(line));
    });
    
    points.length = 0;
    selectedIndices.clear();
    triangleCalcData = null; 
    altitudeCount = { A: 0, B: 0, C: 0 }; 
    
    document.getElementById('batch_coords').value = ''; 
    updatePointsList();
    updateVectorSelectors(); 
    document.getElementById('triangleResults').innerHTML = '<p>Chọn 3 điểm và nhấn nút "Tính" ở trên.</p>';
    document.getElementById('planeResults').innerHTML = '<p>Chọn 3 điểm và nhấn nút để tìm mặt phẳng.</p>';
    document.getElementById('vectorDistanceResults').innerHTML = '<p>Chọn 2 điểm và nhấn nút.</p>';
    document.getElementById('vectorDotAngleResults').innerHTML = '<p>Chọn 4 điểm để xác định 2 vector.</p>';
    document.getElementById('resultantVectorResults').innerHTML = '<p>Chọn các vector lực từ danh sách và nhấn nút.</p>';
    
    // Đặt lại giao diện chọn Vector Lực
    const container = document.getElementById('force_vectors_select_container');
    container.innerHTML = `
        <div class="input-group force-vector-group">
            <label>Lực 1:</label>
            <select class="force-start-select point-select"></select>
            $\rightarrow$   
            <select class="force-end-select point-select"></select>
            <button class="remove-vector-btn"></button>
        </div>
    `;
    // Gán lại sự kiện xóa cho nút đầu tiên
    attachRemoveVectorEvent(document.querySelector('#force_vectors_select_container .remove-vector-btn'));
}

// Hàm tiện ích để gán sự kiện xóa vector lực
function attachRemoveVectorEvent(button) {
    button.addEventListener('click', (event) => {
        const container = document.getElementById('force_vectors_select_container');
        if (container.children.length > 1) {
            container.removeChild(event.target.closest('.force-vector-group'));
            // Cập nhật lại tên label
            Array.from(container.children).forEach((child, index) => {
                child.querySelector('label').textContent = `Lực ${index + 1}:`;
            });
        }
    });
}

// --- CÁC HÀM TÍNH TOÁN KHÁC (Không thay đổi) ---

function handleAddAltitude(vertex) {
    if (!triangleCalcData) { 
        alert("Vui lòng tính toán tam giác trước."); 
        return; 
    }
    
    let H_coords;
    let namePrefix;
    
    if (vertex === 'A') {
        H_coords = triangleCalcData.H_BC; 
        namePrefix = 'H_A';
    } else if (vertex === 'B') {
        H_coords = triangleCalcData.H_AC;
        namePrefix = 'H_B';
    } else if (vertex === 'C') {
        H_coords = triangleCalcData.H_AB;
        namePrefix = 'H_C';
    } else {
        return;
    }

    altitudeCount[vertex] += 1;
    const footName = `${namePrefix}_${altitudeCount[vertex]}`;
    
    if (isPointExists(footName)) {
        altitudeCount[vertex] -= 1; 
        alert(`Điểm chân đường cao ${footName.substring(0, footName.lastIndexOf('_'))}_x đã tồn tại. Bỏ qua.`);
        return;
    }

    addVisualPoint(footName, H_coords.x, H_coords.y, H_coords.z, true); 

    updatePointsList();
    updateVectorSelectors(); 
    alert(`Đã thêm chân đường cao ${footName} vào danh sách điểm. Bạn có thể chọn điểm này để nối đường hoặc thao tác khác.`);
}


function handleAddAltitudeA() { handleAddAltitude('A'); }
function handleAddAltitudeB() { handleAddAltitude('B'); }
function handleAddAltitudeC() { handleAddAltitude('C'); }

function handleCalculateTriangleProps() {
    const resultsDiv = document.getElementById('triangleResults');
    triangleCalcData = null; 

    if (selectedIndices.size !== 3) {
        resultsDiv.innerHTML = '<p class="error-message">Vui lòng chọn chính xác 3 điểm để tính diện tích và chiều cao tam giác.</p>';
        return;
    }

    const indices = Array.from(selectedIndices);
    const pA_data = points[indices[0]];
    const pB_data = points[indices[1]];
    const pC_data = points[indices[2]];

    const pA = new THREE.Vector3(pA_data.x, pA_data.y, pA_data.z);
    const pB = new THREE.Vector3(pB_data.x, pB_data.y, pB_data.z);
    const pC = new THREE.Vector3(pC_data.x, pC_data.y, pC_data.z);

    const vectorAB = new THREE.Vector3().subVectors(pB, pA);
    const vectorAC = new THREE.Vector3().subVectors(pC, pA);

    const crossProd = crossProduct(vectorAB, vectorAC);
    const area = 0.5 * vectorMagnitude(crossProd);

    if (area < EPSILON) { 
        resultsDiv.innerHTML = '<p class="error-message">3 điểm đã chọn thẳng hàng hoặc quá gần nhau, không tạo thành tam giác.</p>';
        return;
    }

    const lengthAB = vectorMagnitude(vectorAB);
    const hc = (2 * area) / lengthAB;
    const H_AB = getProjectionPoint(pC, pA, pB);
    
    const lengthAC = vectorMagnitude(vectorAC);
    const hb = (2 * area) / lengthAC;
    const H_AC = getProjectionPoint(pB, pA, pC);

    const vectorBC = new THREE.Vector3().subVectors(pC, pB);
    const lengthBC = vectorMagnitude(vectorBC);
    const ha = (2 * area) / lengthBC;
    const H_BC = getProjectionPoint(pA, pB, pC);
    
    triangleCalcData = {
        indices, pA, pB, pC, pA_data, pB_data, pC_data,
        area, hc, hb, ha,
        H_AB, H_AC, H_BC 
    };
    

    let resultsHtml = `<p><strong>Diện tích tam giác ${pA_data.name}${pB_data.name}${pC_data.name}:</strong> ${area.toFixed(4)}</p>`;
    resultsHtml += `<h3>Chiều cao:</h3>`;

    resultsHtml += `<p>• Chiều cao từ đỉnh ${pC_data.name} xuống cạnh ${pA_data.name}${pB_data.name}: <strong>${hc.toFixed(4)}</strong><br> Chân đường cao tại: (${H_AB.x.toFixed(4)}, ${H_AB.y.toFixed(4)}, ${H_AB.z.toFixed(4)})</p>`;
    resultsHtml += `<p>• Chiều cao từ đỉnh ${pB_data.name} xuống cạnh ${pA_data.name}${pC_data.name}: <strong>${hb.toFixed(4)}</strong><br> Chân đường cao tại: (${H_AC.x.toFixed(4)}, ${H_AC.y.toFixed(4)}, ${H_AC.z.toFixed(4)})</p>`;
    resultsHtml += `<p>• Chiều cao từ đỉnh ${pA_data.name} xuống cạnh ${pB_data.name}${pC_data.name}: <strong>${ha.toFixed(4)}</strong><br> Chân đường cao tại: (${H_BC.x.toFixed(4)}, ${H_BC.y.toFixed(4)}, ${H_BC.z.toFixed(4)})</p>`;

    resultsDiv.innerHTML = resultsHtml;
}

function handleCalculatePlaneProps() {
    const resultsDiv = document.getElementById('planeResults');
    if (selectedIndices.size !== 3) {
        resultsDiv.innerHTML = '<p class="error-message">Vui lòng chọn chính xác 3 điểm để xác định mặt phẳng.</p>';
        return;
    }
    
    const indices = Array.from(selectedIndices);
    const pA_data = points[indices[0]];
    const pB_data = points[indices[1]];
    const pC_data = points[indices[2]];

    const pA = new THREE.Vector3(pA_data.x, pA_data.y, pA_data.z);
    const pB = new THREE.Vector3(pB_data.x, pB_data.y, pB_data.z);
    const pC = new THREE.Vector3(pC_data.x, pC_data.y, pC_data.z);

    const vectorAB = new THREE.Vector3().subVectors(pB, pA);
    const vectorAC = new THREE.Vector3().subVectors(pC, pA);

    const normalVector = crossProduct(vectorAB, vectorAC); 
    
    if (vectorMagnitude(normalVector) < EPSILON) {
        resultsDiv.innerHTML = '<p class="error-message">3 điểm đã chọn thẳng hàng. Không thể xác định một mặt phẳng duy nhất.</p>';
        return;
    }

    const a = normalVector.x;
    const b = normalVector.y;
    const c = normalVector.z;

    const d = - (a * pA.x + b * pA.y + c * pA.z); 

    const formatXYZCoefficient = (val, variable, isFirst) => {
        if (Math.abs(val) < EPSILON) return ''; 
        
        const sign = val > 0 ? (isFirst ? '' : ' + ') : ' - ';
        const absVal = Math.abs(val);
        let coeffStr = '';

        if (Math.abs(absVal - 1) < EPSILON) { 
            coeffStr = ''; 
        } else {
            coeffStr = absVal.toFixed(4); 
        }
        
        return `${sign}${coeffStr}${variable}`;
    };

    const formatDConstant = (val, isEquationEmpty) => {
        if (Math.abs(val) < EPSILON) return '';
        
        const sign = val > 0 ? (isEquationEmpty ? '' : ' + ') : ' - ';
        const absVal = Math.abs(val);
        return `${sign}${absVal.toFixed(4)}`;
    };

    let equation = '';
    let isFirstTerm = true;

    const termX = formatXYZCoefficient(a, 'x', isFirstTerm);
    if (termX) {
        equation += termX;
        isFirstTerm = false;
    }

    const termY = formatXYZCoefficient(b, 'y', isFirstTerm);
    if (termY) {
        equation += termY;
        isFirstTerm = false;
    }

    const termZ = formatXYZCoefficient(c, 'z', isFirstTerm);
    if (termZ) {
        equation += termZ;
        isFirstTerm = false;
    }
    
    equation += formatDConstant(d, equation.trim() === '');

    let resultsHtml = `
        <p><strong>Vector Pháp tuyến $\vec{n} = (a, b, c)$:</strong></p>
        <p>(${(a).toFixed(4)}, ${(b).toFixed(4)}, ${(c).toFixed(4)})</p>
        <hr style="margin: 8px 0;">
        <p><strong>Phương trình Mặt phẳng $ax + by + cz + d = 0$:</strong></p>
        <p class="math-equation">
            ${equation.trim()} = 0
        </p>
    `;

    resultsDiv.innerHTML = resultsHtml;
}

function handleCalculateVectorDistance() {
    const resultsDiv = document.getElementById('vectorDistanceResults');
    const indices = Array.from(selectedIndices);
    
    if (indices.length !== 2) {
        resultsDiv.innerHTML = '<p class="error-message">Vui lòng chọn chính xác **2 điểm** để tính vector và khoảng cách.</p>';
        return;
    }

    const pA_data = points[indices[0]];
    const pB_data = points[indices[1]];

    const pA = new THREE.Vector3(pA_data.x, pA_data.y, pA_data.z);
    const pB = new THREE.Vector3(pB_data.x, pB_data.y, pB_data.z);

    const vectorAB = new THREE.Vector3().subVectors(pB, pA);
    const distanceAB = vectorMagnitude(vectorAB);

    const resultsHtml = `
        <p>Chọn: ${pA_data.name} **${pB_data.name}**</p>
        <hr style="margin: 8px 0;">
        <p><strong>Vector $\vec{${pA_data.name}${pB_data.name}}$:</strong></p>
        <p class="math-equation">(${(vectorAB.x).toFixed(4)}, ${(vectorAB.y).toFixed(4)}, ${(vectorAB.z).toFixed(4)})</p>
        <p><strong>Khoảng cách $|\vec{${pA_data.name}${pB_data.name}}|$:</strong></p>
        <p class="math-equation">${distanceAB.toFixed(4)}</p>
    `;
    
    resultsDiv.innerHTML = resultsHtml;
}

function handleCalculateVectorDotAngle() {
    const resultsDiv = document.getElementById('vectorDotAngleResults');
    
    const u_start_idx = document.getElementById('u_start_select').value;
    const u_end_idx = document.getElementById('u_end_select').value;
    const v_start_idx = document.getElementById('v_start_select').value;
    const v_end_idx = document.getElementById('v_end_select').value;

    const vectorUData = getVectorFromIndices(u_start_idx, u_end_idx);
    const vectorVData = getVectorFromIndices(v_start_idx, v_end_idx);

    if (!vectorUData || !vectorVData) {
        resultsDiv.innerHTML = '<p class="error-message">Vui lòng chọn 4 điểm hợp lệ (điểm đầu và điểm cuối khác nhau) để xác định 2 vector.</p>';
        return;
    }

    const vectorU = vectorUData.u;
    const vectorV = vectorVData.u;
    
    const magU = vectorMagnitude(vectorU);
    const magV = vectorMagnitude(vectorV);
    const dotUV = dotProduct(vectorU, vectorV);

    let angleDegrees = 'Không xác định';
    let resultsHtml;
    
    if (magU < EPSILON || magV < EPSILON) {
         resultsHtml = `<p class="error-message">Một trong hai vector có độ dài gần bằng 0. Không thể tính góc.</p>`;
    } else {
        const cosTheta = dotUV / (magU * magV);
        const angleRadians = Math.acos(Math.min(Math.max(cosTheta, -1), 1)); 
        angleDegrees = (angleRadians * 180 / Math.PI).toFixed(4);
        
        resultsHtml = `
            <p><strong>Vector $\vec{u}$:</strong> ${vectorUData.name} (${vectorU.x.toFixed(4)}, ${vectorU.y.toFixed(4)}, ${vectorU.z.toFixed(4)})</p>
            <p><strong>Vector $\vec{v}$:</strong> ${vectorVData.name} (${vectorV.x.toFixed(4)}, ${vectorV.y.toFixed(4)}, ${vectorV.z.toFixed(4)})</p>
            <hr style="margin: 8px 0;">
            <p><strong>Tích vô hướng $\vec{u} \cdot \vec{v}$:</strong></p>
            <p class="math-equation">${dotUV.toFixed(4)}</p>
            <p><strong>Góc giữa 2 vector ($\theta$):</strong></p>
            <p class="math-equation">${angleDegrees}°</p>
        `;
    }

    resultsDiv.innerHTML = resultsHtml;
}

function handleAddVectorToForceList() {
    const container = document.getElementById('force_vectors_select_container');
    const vectorIndex = container.children.length + 1;

    const newGroup = document.createElement('div');
    newGroup.className = 'input-group force-vector-group';
    newGroup.innerHTML = `
        <label>Lực ${vectorIndex}:</label>
        <select class="force-start-select point-select"></select>
        $\rightarrow$
        <select class="force-end-select point-select"></select>
        <button class="remove-vector-btn">🗑️</button>
    `;
    
    attachRemoveVectorEvent(newGroup.querySelector('.remove-vector-btn'));

    container.appendChild(newGroup);
    updateVectorSelectors(); 
}

function handleCalculateResultantVector() {
    const resultsDiv = document.getElementById('resultantVectorResults');
    const vectorGroups = document.querySelectorAll('#force_vectors_select_container .force-vector-group');
    
    const resultantVector = new THREE.Vector3(0, 0, 0);
    let vectorCount = 0;
    const vectorsUsed = [];
    
    if (vectorGroups.length === 0) {
        resultsDiv.innerHTML = '<p class="error-message">Vui lòng thêm ít nhất một vector lực.</p>';
        return;
    }
    
    vectorGroups.forEach(group => {
        const startSelect = group.querySelector('.force-start-select');
        const endSelect = group.querySelector('.force-end-select');
        
        const vectorData = getVectorFromIndices(startSelect.value, endSelect.value);
        
        if (vectorData) {
            resultantVector.add(vectorData.u);
            vectorCount++;
            vectorsUsed.push(vectorData.name);
        } 
    });
    
    if (vectorCount === 0) {
        resultsDiv.innerHTML = '<p class="error-message">Không có vector hợp lệ nào được chọn. Vui lòng chọn điểm đầu và điểm cuối khác nhau cho mỗi vector.</p>';
        return;
    }

    let vectorsListHtml = vectorsUsed.map(name => `<li>${name}</li>`).join('');

    let resultsHtml = `
        <p>Đã tính hợp lực của ${vectorCount} vector:</p>
        <p><strong>Vector Hợp lực:</strong></p>
        <p class="math-equation">
            (${(resultantVector.x).toFixed(4)}, ${(resultantVector.y).toFixed(4)}, ${(resultantVector.z).toFixed(4)})
        </p>
        <p><strong>Độ lớn:</strong></p>
        <p class="math-equation">${vectorMagnitude(resultantVector).toFixed(4)}</p>
    `;

    resultsDiv.innerHTML = resultsHtml;
}


// --- HÀM VẼ KHỐI HÌNH HỌC TỰ ĐỘNG (Chiều cao Z) ---

function resetSceneForNewShape() {
    handleClearScene(); 
}

function drawShape(pointsData, edges) {
    resetSceneForNewShape();
    
    const nameToIndexMap = {};
    pointsData.forEach(([name, x, y, z]) => {
        const index = addVisualPoint(name, x, y, z, false);
        nameToIndexMap[name] = index;
    });
    
    edges.forEach(([nameA, nameB]) => {
        const indexA = nameToIndexMap[nameA];
        const indexB = nameToIndexMap[nameB];
        
        if (indexA !== undefined && indexB !== undefined) {
            const startPoint = points[indexA];
            const endPoint = points[indexB]; 

            const material = new THREE.LineBasicMaterial({ color: 0xffff00 }); 
            const geometry = new THREE.BufferGeometry().setFromPoints([
                startPoint.mesh.position, 
                endPoint.mesh.position
            ]);

            const line = new THREE.Line(geometry, material);
            line.userData.pointIndices = [indexA, indexB]; 

            scene.add(line);
            startPoint.lines.push(line);
            endPoint.lines.push(line);
        }
    });

    updatePointsList();
    updateVectorSelectors();
}

/**
 * 3. Tứ Diện (Tetrahedron) - Chiều cao trên trục Z
 */
function handleDrawTetrahedron() {
    const a = parseFloat(document.getElementById('base_side_length').value) || 4;
    
    const A_x = -a / 2;
    const A_y = -Math.sqrt(3) * a / 6;
    const A_z = 0;

    const B_x = a / 2;
    const B_y = -Math.sqrt(3) * a / 6;
    const B_z = 0;

    const C_x = 0;
    const C_y = Math.sqrt(3) * a / 3;
    const C_z = 0;

    const h = a * Math.sqrt(6) / 3;
    const D_x = 0;
    const D_y = 0;
    const D_z = h; 

    const pointsData = [
        ['A', A_x, A_y, A_z],
        ['B', B_x, B_y, B_z],
        ['C', C_x, C_y, C_z],
        ['D', D_x, D_y, D_z]
    ];
    
    const edges = [
        ['A', 'B'], ['B', 'C'], ['C', 'A'], 
        ['D', 'A'], ['D', 'B'], ['D', 'C']  
    ];
    
    drawShape(pointsData, edges);
    alert('Đã vẽ Hình Tứ Diện (Đều) với cạnh = ' + a.toFixed(2) + '. Chiều cao nằm trên trục Z.');
}

/**
 * 4. Hình Lập Phương (Cube) - Chiều cao trên trục Z
 */
function handleDrawCube() {
    const a = parseFloat(document.getElementById('base_side_length').value) || 4;
    const offset = a / 2;

    const pointsData = [
        // Đáy dưới (z = 0)
        ['A', -offset, -offset, 0],
        ['B', offset, -offset, 0],
        ['C', offset, offset, 0],
        ['D', -offset, offset, 0],
        // Đáy trên (z = a)
        ['E', -offset, -offset, a], 
        ['F', offset, -offset, a],
        ['G', offset, offset, a],
        ['H', -offset, offset, a]
    ];
    
    const edges = [
        ['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'A'],
        ['E', 'F'], ['F', 'G'], ['G', 'H'], ['H', 'E'],
        ['A', 'E'], ['B', 'F'], ['C', 'G'], ['D', 'H']
    ];
    
    drawShape(pointsData, edges);
    alert('Đã vẽ Hình Lập Phương với cạnh = ' + a + '. Chiều cao nằm trên trục Z.');
}

/**
 * 5. Hình Hộp Chữ Nhật (Cuboid) - Chiều cao trên trục Z
 */
function handleDrawCuboid() {
    const length = parseFloat(document.getElementById('base_side_length').value) || 4; 
    const width = parseFloat(document.getElementById('height_value').value) || 3;    
    const height = parseFloat(document.getElementById('height_value').value) || 3;   

    const l_offset = length / 2;
    const w_offset = width / 2;
    const h_value = height;

    const pointsData = [
        // Đáy dưới (z = 0)
        ['A', -l_offset, -w_offset, 0],
        ['B', l_offset, -w_offset, 0],
        ['C', l_offset, w_offset, 0],
        ['D', -l_offset, w_offset, 0],
        // Đáy trên (z = h)
        ['E', -l_offset, -w_offset, h_value], 
        ['F', l_offset, -w_offset, h_value],
        ['G', l_offset, w_offset, h_value],
        ['H', -l_offset, w_offset, h_value]
    ];
    
    const edges = [
        ['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'A'],
        ['E', 'F'], ['F', 'G'], ['G', 'H'], ['H', 'E'],
        ['A', 'E'], ['B', 'F'], ['C', 'G'], ['D', 'H']
    ];
    
    drawShape(pointsData, edges);
    alert(`Đã vẽ Hình Hộp Chữ Nhật (Dài=${length}, Rộng=${width}, Cao=${h_value}). Chiều cao nằm trên trục Z.`);
}

/**
 * 6. Hình Chóp Tứ Giác (Pyramid) - Chiều cao trên trục Z
 */
function handleDrawPyramid() {
    const length = parseFloat(document.getElementById('base_side_length').value) || 4; 
    const width = parseFloat(document.getElementById('height_value').value) || 3;    
    const height = parseFloat(document.getElementById('height_value').value) || 3;   

    const l_offset = length / 2;
    const w_offset = width / 2;
    
    const S_x = 0;
    const S_y = 0;
    const S_z = height; 

    const pointsData = [
        // Đáy (z = 0)
        ['A', -l_offset, -w_offset, 0],
        ['B', l_offset, -w_offset, 0],
        ['C', l_offset, w_offset, 0],
        ['D', -l_offset, w_offset, 0],
        // Đỉnh
        ['S', S_x, S_y, S_z]
    ];
    
    const edges = [
        ['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'A'],
        ['S', 'A'], ['S', 'B'], ['S', 'C'], ['S', 'D']
    ];
    
    drawShape(pointsData, edges);
    alert(`Đã vẽ Hình Chóp Tứ Giác (Đáy: ${length}x${width}, Cao: ${height}). Chiều cao nằm trên trục Z.`);
}

// Hình Chóp Tứ Giác Đều

function handleDrawRegPyramid() {
    const side = parseFloat(document.getElementById('base_side_length').value) || 4; 
    const height = parseFloat(document.getElementById('height_value').value) || 3;   

    const offset = side / 2;
    
    const S_x = 0;
    const S_y = 0;
    const S_z = height; 

    const pointsData = [
        // Đáy vuông (z = 0)
        ['A', -offset, -offset, 0],
        ['B', offset, -offset, 0],
        ['C', offset, offset, 0],
        ['D', -offset, offset, 0],
        // Đỉnh
        ['S', S_x, S_y, S_z]
    ];
    
    const edges = [
        ['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'A'],
        ['S', 'A'], ['S', 'B'], ['S', 'C'], ['S', 'D']
    ];
    
    drawShape(pointsData, edges);
    alert(`Đã vẽ Hình Chóp Tứ Giác Đều (Cạnh đáy: ${side}, Cao: ${height}). Chiều cao nằm trên trục Z.`);
}

function onWindowResize() {
    const aspect = container.clientWidth / container.clientHeight;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

// KHỞI TẠO VÀ VÒNG LẶP RENDER 

function animate() {
    requestAnimationFrame(animate);
    controls.update(); 
    renderer.render(scene, camera);
}

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);

    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; 
    controls.dampingFactor = 0.05;

    scene.add(new THREE.AmbientLight(0x404040));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    redrawSceneAxes();

    // Khởi tạo selector và gán sự kiện xóa cho nút đầu tiên
    updateVectorSelectors();
    const initialRemoveBtn = document.querySelector('#force_vectors_select_container .remove-vector-btn');
    if (initialRemoveBtn) {
        attachRemoveVectorEvent(initialRemoveBtn);
    }

    // Gán sự kiện cho các nút chức năng
    document.getElementById('addBatchPoints').addEventListener('click', handleAddBatchPoints);
    document.getElementById('connectPoints').addEventListener('click', handleConnectPoints);
    document.getElementById('deleteSelected').addEventListener('click', handleDeleteSelected); 
    document.getElementById('deleteLines').addEventListener('click', handleDeleteSelectedLines); 
    document.getElementById('clearScene').addEventListener('click', handleClearScene);
    
    // Nút Tam giác
    document.getElementById('calculateTriangleProps').addEventListener('click', handleCalculateTriangleProps); 
    document.getElementById('addAltitudeA').addEventListener('click', handleAddAltitudeA);
    document.getElementById('addAltitudeB').addEventListener('click', handleAddAltitudeB);
    document.getElementById('addAltitudeC').addEventListener('click', handleAddAltitudeC);
    
    // Nút Mặt phẳng
    document.getElementById('calculatePlaneProps').addEventListener('click', handleCalculatePlaneProps); 
    
    // Nút Vector 
    document.getElementById('calculateVectorDistance').addEventListener('click', handleCalculateVectorDistance);
    document.getElementById('calculateVectorDotAngle').addEventListener('click', handleCalculateVectorDotAngle);
    document.getElementById('addVectorToForceList').addEventListener('click', handleAddVectorToForceList);
    document.getElementById('calculateResultantVector').addEventListener('click', handleCalculateResultantVector);

    // GÁN SỰ KIỆN CHO CÁC NÚT VẼ HÌNH MỚI
    document.getElementById('drawTetrahedron').addEventListener('click', handleDrawTetrahedron);
    document.getElementById('drawCube').addEventListener('click', handleDrawCube);
    document.getElementById('drawCuboid').addEventListener('click', handleDrawCuboid);
    document.getElementById('drawPyramid').addEventListener('click', handleDrawPyramid);
    document.getElementById('drawRegPyramid').addEventListener('click', handleDrawRegPyramid);


    window.addEventListener('resize', onWindowResize, false);
    
    document.getElementById('axis-selector').addEventListener('change', (event) => {
        verticalAxis = event.target.value;
        redrawSceneAxes();
        updatePointPositions(); 
    });

    animate();
}

init();