// AI Engine Ported to JS
class GameState {
    constructor() {
        this.grid = Array(8).fill().map(() => Array(8).fill(0));
    }
    can_place(block, row, col, grid) {
        if (!grid) grid = this.grid;
        for (let r = 0; r < block.length; r++) {
            for (let c = 0; c < block[0].length; c++) {
                if (block[r][c] === 1) {
                    if (row + r >= 8 || col + c >= 8) return false;
                    if (grid[row + r][col + c] === 1) return false;
                }
            }
        }
        return true;
    }
    place_block(block, row, col, grid) {
        if (!grid) grid = this.grid;
        let new_grid = grid.map(r => [...r]);
        for (let r = 0; r < block.length; r++) {
            for (let c = 0; c < block[0].length; c++) {
                if (block[r][c] === 1) new_grid[row + r][col + c] = 1;
            }
        }
        let rows_to_clear = [], cols_to_clear = [];
        for (let i = 0; i < 8; i++) {
            if (new_grid[i].every(val => val === 1)) rows_to_clear.push(i);
            let col_full = true;
            for (let j = 0; j < 8; j++) if (new_grid[j][i] === 0) col_full = false;
            if (col_full) cols_to_clear.push(i);
        }
        let lines_cleared = rows_to_clear.length + cols_to_clear.length;
        for (let r of rows_to_clear) for (let c = 0; c < 8; c++) new_grid[r][c] = 0;
        for (let c of cols_to_clear) for (let r = 0; r < 8; r++) new_grid[r][c] = 0;
        return {new_grid, lines_cleared};
    }
    get_touching_edges(block, row, col, grid) {
        if (!grid) grid = this.grid;
        let edges = 0;
        for (let br = 0; br < block.length; br++) {
            for (let bc = 0; bc < block[0].length; bc++) {
                if (block[br][bc] === 1) {
                    let r = row + br, c = col + bc;
                    if (r === 0 || grid[r-1][c] === 1) edges++;
                    if (r === 7 || grid[r+1][c] === 1) edges++;
                    if (c === 0 || grid[r][c-1] === 1) edges++;
                    if (c === 7 || grid[r][c+1] === 1) edges++;
                }
            }
        }
        return edges;
    }
}

class AIEngine {
    find_best_move(state, available_blocks) {
        let valid_blocks = [];
        for (let i = 0; i < available_blocks.length; i++) {
            if (available_blocks[i] && available_blocks[i].length > 0) {
                valid_blocks.push({idx: i, block: available_blocks[i]});
            }
        }
        if (valid_blocks.length === 0) return null;
        
        const dfs = (current_grid, remaining_blocks, current_score, path) => {
            if (remaining_blocks.length === 0) return { score: current_score, path: path };
            
            let best_future = { score: -999999, path: path };
            let placed_any = false;
            
            for (let i = 0; i < remaining_blocks.length; i++) {
                let item = remaining_blocks[i];
                for (let r = 0; r < 8; r++) {
                    for (let c = 0; c < 8; c++) {
                        if (state.can_place(item.block, r, c, current_grid)) {
                            placed_any = true;
                            let {new_grid, lines_cleared} = state.place_block(item.block, r, c, current_grid);
                            let touching = state.get_touching_edges(item.block, r, c, current_grid);
                            let step_score = (lines_cleared * 2000) + touching;
                            
                            // Heuristik tambahan: Open 3x3 dan 5-block bonus
                            if (remaining_blocks.length === 1) { // di akhir langkah
                                step_score += this.countOpen3x3(new_grid) * 500;
                                step_score += this.countOpen5x1(new_grid) * 400; // Prioritas tinggi untuk balok 5
                            }
                            
                            let next_remaining = remaining_blocks.filter((_, index) => index !== i);
                            let current_step = { row: r, col: c, block_idx: item.idx, block: item.block, resulting_grid: new_grid };
                            let future = dfs(new_grid, next_remaining, current_score + step_score, [...path, current_step]);
                            
                            if (future.score > best_future.score) best_future = future;
                        }
                    }
                }
            }
            if (!placed_any) return { score: current_score - 100000, path: path };
            return best_future;
        };
        
        let result = dfs(state.grid, valid_blocks, 0, []);
        if (result.path && result.path.length > 0) return result;
        return null;
    }

    countOpen3x3(gridArr) {
        let count = 0;
        for (let r = 0; r <= 5; r++) {
            for (let c = 0; c <= 5; c++) {
                let isClean = true;
                checkLoop: for (let i = 0; i < 3; i++) {
                    for (let j = 0; j < 3; j++) {
                        if (gridArr[r + i][c + j] === 1) { isClean = false; break checkLoop; }
                    }
                }
                if (isClean) count++;
            }
        }
        return count;
    }

    countOpen5x1(gridArr) {
        let count = 0;
        // Horizontal
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c <= 3; c++) {
                if (gridArr[r][c]===0 && gridArr[r][c+1]===0 && gridArr[r][c+2]===0 && gridArr[r][c+3]===0 && gridArr[r][c+4]===0) {
                    count++;
                }
            }
        }
        // Vertical
        for (let c = 0; c < 8; c++) {
            for (let r = 0; r <= 3; r++) {
                if (gridArr[r][c]===0 && gridArr[r+1][c]===0 && gridArr[r+2][c]===0 && gridArr[r+3][c]===0 && gridArr[r+4][c]===0) {
                    count++;
                }
            }
        }
        return count;
    }

    // ITEM FALLBACK LOGIC
    tryItems(currentGrid, allShapes) {
        // 1. Cek 1x1
        for(let r=0; r<8; r++) {
            for(let c=0; c<8; c++) {
                if(currentGrid[r][c] === 0) {
                     let simGrid = currentGrid.map(row => [...row]); 
                     simGrid[r][c]=1;
                     let clear = false;
                     for(let k=0; k<8; k++) if(simGrid[k].every(x=>x===1)) clear=true;
                     for(let k=0; k<8; k++) { let cf=true; for(let m=0; m<8; m++) if(simGrid[m][k]===0) cf=false; if(cf) clear=true; }
                     if(clear) return { type: '1x1', r, c }; 
                }
            }
        }
        // 2. Cek Bomb
        let bestR=-1, bestC=-1, maxClear=0;
        const offsets = [[0,0], [-1,0], [1,0], [0,-1], [0,1], [-1,-1], [-1,1], [1,-1], [1,1]]; // 3x3 area
        for(let r=0; r<8; r++) {
            for(let c=0; c<8; c++) {
                let cleared = 0;
                offsets.forEach(off => {
                    let nr=r+off[0], nc=c+off[1];
                    if(nr>=0 && nr<8 && nc>=0 && nc<8 && currentGrid[nr][nc]) cleared++;
                });
                if(cleared >= 4 && cleared > maxClear) { maxClear = cleared; bestR=r; bestC=c; }
            }
        }
        if(bestR !== -1) return { type: 'bomb', r: bestR, c: bestC };
        // 3. Cek Trash
        if(allShapes.length > 0) return { type: 'trash', block_idx: allShapes[0].idx };
        return null;
    }
}

// UI State & Logic
const state = new GameState();
const ai = new AIEngine();
let spawnerQueues = [null, null, null]; // holds arrays (shapes)
let currentRecommendation = null;
let itemRecommendation = null;
let animationInterval = null;
let currentAnimationStep = 0;

// Default Library
const defaultShapes = [
    [[1]], // Dot
    [[1,1]], [[1],[1]], [[1,1,1]], [[1],[1],[1]], [[1,1,1,1]], [[1],[1],[1],[1]], [[1,1,1,1,1]], [[1],[1],[1],[1],[1]], // Lines
    [[1,1],[1,1]], [[1,1,1],[1,1,1],[1,1,1]], // Squares
    [[1,0],[1,1]], [[0,1],[1,1]], [[1,1],[1,0]], [[1,1],[0,1]], // 2x2 L
    [[1,1,1],[0,1,0]], [[0,1,0],[1,1,1]], [[1,0],[1,1],[1,0]], [[0,1],[1,1],[0,1]], // T
    [[1,0,0],[1,0,0],[1,1,1]], [[0,0,1],[0,0,1],[1,1,1]], [[1,1,1],[1,0,0],[1,0,0]], [[1,1,1],[0,0,1],[0,0,1]] // 3x3 L
];
let library = [];

// Init LocalStorage Library
function loadLibrary() {
    const saved = localStorage.getItem('blockzi_pwa_lib');
    if (saved) { library = JSON.parse(saved); }
    if (!library || library.length === 0) {
        library = JSON.parse(JSON.stringify(defaultShapes));
        localStorage.setItem('blockzi_pwa_lib', JSON.stringify(library));
    }
    renderLibrary();
}

// Draw Mini Grid HTML
function createMiniGrid(shape, cssClass = 'mini-cell') {
    const mini = document.createElement('div');
    mini.className = 'mini-grid';
    mini.style.gridTemplateColumns = `repeat(${shape[0].length}, 1fr)`;
    let cellSize = Math.min(8, 30 / Math.max(shape.length, shape[0].length));
    shape.forEach(row => { 
        row.forEach(val => { 
            const d = document.createElement('div'); 
            d.className = val ? cssClass : cssClass + ' trans'; 
            d.style.width = `${cellSize}px`;
            d.style.height = `${cellSize}px`;
            if (val && cssClass !== 'mini-cell') d.style.background = 'currentColor';
            mini.appendChild(d); 
        }); 
    });
    return mini;
}

// Shape Categorization for perfect sorting
function getShapeCategory(shape) {
    let rows = shape.length;
    let cols = shape[0].length;
    let count = shape.flat().reduce((s,v)=>s+v,0);
    
    if (count === 1) return 1; // Dot
    if (rows === 1 || cols === 1) return 2; // Lines
    if (rows === cols && count === rows * cols) return 3; // Squares
    if (count === 3 && rows === 2 && cols === 2) return 4; // Small L
    if (count === 4 && ((rows===2 && cols===3) || (rows===3 && cols===2))) return 5; // T Shapes
    if (count === 5 && rows === 3 && cols === 3) return 6; // Large L
    return 7; // Others
}

// Render Library Palette
function renderLibrary() {
    const pal = document.getElementById('palette');
    pal.innerHTML = '';
    
    // Intelligent sorting
    library.sort((a, b) => {
        let catA = getShapeCategory(a);
        let catB = getShapeCategory(b);
        if (catA !== catB) return catA - catB; // Sort by category first
        
        let countA = a.flat().reduce((s,v)=>s+v,0);
        let countB = b.flat().reduce((s,v)=>s+v,0);
        if (countA !== countB) return countA - countB; // Then by block count
        
        // If same category and count, sort Horizontal before Vertical
        let ratioA = a[0].length / a.length;
        let ratioB = b[0].length / b.length;
        return ratioB - ratioA; 
    });
    
    library.forEach((shape, index) => {
        const item = document.createElement('div');
        item.className = 'p-item';
        item.appendChild(createMiniGrid(shape));
        item.onclick = () => addToSpawner(shape);
        item.oncontextmenu = (e) => {
            e.preventDefault();
            if (confirm("Hapus balok ini dari Koleksi?")) {
                library.splice(index, 1);
                localStorage.setItem('blockzi_pwa_lib', JSON.stringify(library));
                renderLibrary();
            }
        };
        pal.appendChild(item);
    });
}

// Spawner Logic
function addToSpawner(shape) {
    let emptyIdx = spawnerQueues.indexOf(null);
    if (emptyIdx === -1) {
        document.getElementById('ai-status').textContent = "Antrean penuh (Maks 3)!";
        return;
    }
    spawnerQueues[emptyIdx] = shape;
    clearRecommendation();
    updateSpawnerVisuals();
}

function removeFromSpawner(idx) {
    spawnerQueues[idx] = null;
    clearRecommendation();
    updateSpawnerVisuals();
}

function updateSpawnerVisuals() {
    for (let i = 0; i < 3; i++) {
        let slot = document.querySelector(`.queue-slot[data-idx="${i}"]`);
        slot.innerHTML = '';
        slot.className = 'queue-slot';
        if (spawnerQueues[i]) {
            slot.appendChild(createMiniGrid(spawnerQueues[i], 'mini-cell'));
            slot.onclick = () => removeFromSpawner(i);
        } else {
            slot.classList.add('empty');
            slot.textContent = "Kosong";
            slot.onclick = null;
        }
    }
}

// Board Init
const boardEl = document.getElementById('main-board');
function initBoard() {
    boardEl.innerHTML = '';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            let cell = document.createElement('div');
            cell.className = 'cell';
            cell.id = `board-${r}-${c}`;
            
            const toggle = () => {
                state.grid[r][c] = state.grid[r][c] === 1 ? 0 : 1;
                clearRecommendation();
                updateBoardVisuals();
            };
            cell.onmousedown = toggle;
            cell.onmouseenter = (e) => { if (e.buttons === 1) toggle(); };
            
            cell.addEventListener('touchmove', (e) => {
                e.preventDefault();
                let touch = e.touches[0];
                let elem = document.elementFromPoint(touch.clientX, touch.clientY);
                if (elem && elem.id.startsWith('board-')) {
                    let parts = elem.id.split('-');
                    let tr = parseInt(parts[1]), tc = parseInt(parts[2]);
                    if (state.grid[tr][tc] === 0) {
                        state.grid[tr][tc] = 1;
                        clearRecommendation();
                        updateBoardVisuals();
                    }
                }
            }, {passive: false});
            
            boardEl.appendChild(cell);
        }
    }
}

function updateBoardVisuals() {
    // 1. Reset board
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            let cell = document.getElementById(`board-${r}-${c}`);
            cell.className = 'cell';
            cell.innerText = '';
            if (state.grid[r][c] === 1) cell.classList.add('filled');
        }
    }
    
    // 2. Clear item & queue styling
    document.querySelectorAll('.item-bomb, .item-1x1, .item-trash').forEach(e => e.className = e.className.replace(/item-\S+/g, '').trim());
    document.querySelectorAll('.queue-slot').forEach(el => { 
        el.style.border = '';
        let badge = el.querySelector('.queue-badge');
        if (badge) badge.remove();
    });
    
    // 3. Render AI Steps statically
    if (currentRecommendation && currentRecommendation.length > 0) {
        currentRecommendation.forEach((step, index) => {
            let stepNum = index + 1;
            
            // Render on board
            for (let r = 0; r < step.block.length; r++) {
                for (let c = 0; c < step.block[0].length; c++) {
                    if (step.block[r][c] === 1) {
                        let cell = document.getElementById(`board-${step.row + r}-${step.col + c}`);
                        if (cell) {
                            cell.classList.remove('filled'); // hide original block so preview is clear
                            let layer = document.createElement('div');
                            layer.className = `preview-layer step-${stepNum}`;
                            layer.innerText = stepNum;
                            cell.appendChild(layer);
                        }
                    }
                }
            }
            
            // Decorate queue slot
            let qSlot = document.querySelector(`.queue-slot[data-idx="${step.block_idx}"]`);
            if (qSlot) {
                let colors = ["#eab308", "#06b6d4", "#ef4444"]; // yellow, cyan, red
                qSlot.style.border = `2px solid ${colors[index]}`;
                
                let badge = document.createElement('div');
                badge.className = `queue-badge badge-${stepNum}`;
                badge.innerText = stepNum;
                qSlot.appendChild(badge);
            }
        });
        
    } else if (itemRecommendation) {
        // Render item visualizer
        if (itemRecommendation.type === '1x1') {
            document.getElementById(`board-${itemRecommendation.r}-${itemRecommendation.c}`).classList.add('item-1x1');
        } else if (itemRecommendation.type === 'bomb') {
            const offsets = [[0,0], [-1,0], [1,0], [0,-1], [0,1], [-1,-1], [-1,1], [1,-1], [1,1]];
            offsets.forEach(off => {
                let nr = itemRecommendation.r + off[0], nc = itemRecommendation.c + off[1];
                if(nr>=0 && nr<8 && nc>=0 && nc<8) document.getElementById(`board-${nr}-${nc}`).classList.add('item-bomb');
            });
        } else if (itemRecommendation.type === 'trash') {
            document.querySelector(`.queue-slot[data-idx="${itemRecommendation.block_idx}"]`).classList.add('item-trash');
        }
    }
}

// Builder Logic
let builderData = Array(5).fill().map(() => Array(5).fill(0));
const builderEl = document.getElementById('builderGrid');
function initBuilder() {
    builderEl.innerHTML = '';
    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
            let cell = document.createElement('div');
            cell.className = 'b-cell';
            const toggle = () => {
                builderData[r][c] = builderData[r][c] === 1 ? 0 : 1;
                if (builderData[r][c]) cell.classList.add('active'); else cell.classList.remove('active');
            };
            cell.onmousedown = toggle;
            cell.onmouseenter = (e) => { if (e.buttons === 1) toggle(); };
            
            cell.addEventListener('touchmove', (e) => {
                e.preventDefault();
                let touch = e.touches[0];
                let elem = document.elementFromPoint(touch.clientX, touch.clientY);
                if (elem && elem.classList.contains('b-cell')) {
                    let idx = Array.from(builderEl.children).indexOf(elem);
                    let tr = Math.floor(idx / 5), tc = idx % 5;
                    if (builderData[tr][tc] === 0) {
                        builderData[tr][tc] = 1;
                        elem.classList.add('active');
                    }
                }
            }, {passive: false});
            
            builderEl.appendChild(cell);
        }
    }
}

document.getElementById('clear-builder-btn').onclick = () => {
    builderData = Array(5).fill().map(() => Array(5).fill(0));
    Array.from(builderEl.children).forEach(c => c.classList.remove('active'));
};

document.getElementById('save-lib-btn').onclick = () => {
    let rows = [], cols = [];
    for(let r=0; r<5; r++) for(let c=0; c<5; c++) if(builderData[r][c]) { rows.push(r); cols.push(c); }
    if(!rows.length) return alert("Gambar balok dulu!");
    const minR = Math.min(...rows), maxR = Math.max(...rows), minC = Math.min(...cols), maxC = Math.max(...cols);
    let trimmed = [];
    for(let r=minR; r<=maxR; r++) { 
        let row = []; 
        for(let c=minC; c<=maxC; c++) row.push(builderData[r][c]); 
        trimmed.push(row); 
    }
    
    // Check for duplicate in library
    let isDuplicate = library.some(existing => {
        if (existing.length !== trimmed.length) return false;
        if (existing[0].length !== trimmed[0].length) return false;
        for (let i = 0; i < existing.length; i++) {
            for (let j = 0; j < existing[0].length; j++) {
                if (existing[i][j] !== trimmed[i][j]) return false;
            }
        }
        return true;
    });
    
    if (isDuplicate) {
        alert("Balok ini sudah ada di Koleksi Anda!");
        return;
    }
    
    library.push(trimmed);
    localStorage.setItem('blockzi_pwa_lib', JSON.stringify(library));
    renderLibrary();
    document.getElementById('clear-builder-btn').click();
    document.getElementById('palette').scrollTop = document.getElementById('palette').scrollHeight;
};


function clearRecommendation() {
    currentRecommendation = null;
    itemRecommendation = null;
    
    document.getElementById('ai-status').textContent = "Menunggu Input...";
    document.getElementById('ai-status').className = "status-badge";
    document.getElementById('apply-btn').disabled = true;
    updateBoardVisuals();
}

// Event Listeners
document.getElementById('clear-board-btn').onclick = () => {
    state.grid = Array(8).fill().map(() => Array(8).fill(0));
    clearRecommendation();
};

document.getElementById('clear-queue-btn').onclick = () => {
    spawnerQueues = [null, null, null];
    clearRecommendation();
    updateSpawnerVisuals();
};

document.getElementById('calculate-btn').onclick = () => {
    let validBlocks = [];
    for(let i=0; i<3; i++) if(spawnerQueues[i]) validBlocks.push({idx: i, block: spawnerQueues[i]});
    
    if (validBlocks.length === 0) {
        document.getElementById('ai-status').textContent = "Isi antrean balok dulu!";
        return;
    }
    
    let t0 = performance.now();
    let result = ai.find_best_move(state, spawnerQueues);
    let t1 = performance.now();
    
    if (result) {
        currentRecommendation = result.path;
        document.getElementById('ai-status').textContent = `Berhasil! (Skor: ${result.score})`;
        document.getElementById('ai-status').className = "status-badge";
        document.getElementById('apply-btn').disabled = false;
        
        updateBoardVisuals(); 
        
    } else {
        // ITEM FALLBACK
        document.getElementById('ai-status').textContent = "GAME OVER! Cari Item...";
        document.getElementById('ai-status').className = "status-badge alert";
        
        itemRecommendation = ai.tryItems(state.grid, validBlocks);
        if (itemRecommendation) {
            if (itemRecommendation.type === '1x1') document.getElementById('ai-status').innerHTML = "🚑 MENTOK! Gunakan Item <b>1x1</b>";
            else if (itemRecommendation.type === 'bomb') document.getElementById('ai-status').innerHTML = "💣 MENTOK! Gunakan <b>BOM</b>";
            else if (itemRecommendation.type === 'trash') document.getElementById('ai-status').innerHTML = "🗑️ MENTOK! Gunakan <b>HAPUS</b>";
        } else {
            document.getElementById('ai-status').textContent = "😭 GAME OVER BENERAN!";
        }
        updateBoardVisuals();
    }
};

document.getElementById('apply-btn').onclick = () => {
    if (!currentRecommendation) return;
    
    let lastStep = currentRecommendation[currentRecommendation.length - 1];
    state.grid = lastStep.resulting_grid;
    
    for (let step of currentRecommendation) spawnerQueues[step.block_idx] = null;
    
    clearRecommendation();
    updateSpawnerVisuals();
};

document.getElementById('export-lib-btn').onclick = () => {
    let dataStr = JSON.stringify(library);
    navigator.clipboard.writeText(dataStr).then(() => {
        alert("Kode koleksi berhasil dicopy ke Clipboard!\n\nSimpan di Notes Anda untuk backup.");
    }).catch(() => {
        prompt("Gagal copy otomatis. Copy kode di bawah ini secara manual:", dataStr);
    });
};

document.getElementById('import-lib-btn').onclick = () => {
    let input = prompt("Paste kode JSON koleksi balok Anda di sini:");
    if (!input) return;
    try {
        let parsed = JSON.parse(input);
        if (Array.isArray(parsed)) {
            library = parsed;
            localStorage.setItem('blockzi_pwa_lib', JSON.stringify(library));
            renderLibrary();
            alert(`Sukses import ${library.length} balok!`);
        } else {
            alert("Format salah! Harus berupa Array JSON.");
        }
    } catch(e) {
        alert("Gagal membaca data. Pastikan itu adalah kode JSON dari Export.");
    }
};

// Initial Setup
loadLibrary();
initBoard();
initBuilder();
updateBoardVisuals();
updateSpawnerVisuals();
