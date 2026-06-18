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
    getBlockDifficulty(block) {
        let rows = block.length;
        let cols = block[0].length;
        let count = block.flat().reduce((s, v) => s + v, 0);
        
        if (rows === 3 && cols === 3 && count === 9) return 100;
        if (count === 5 && (rows === 1 || cols === 1)) return 90;
        if (rows === 3 && cols === 3 && count === 5) return 85;
        if (count === 4 && (rows === 1 || cols === 1)) return 60;
        if (count === 4 && ((rows === 2 && cols === 3) || (rows === 3 && cols === 2))) return 55;
        if (count === 3 && rows === 2 && cols === 2) return 40;
        if (count === 3 && (rows === 1 || cols === 1)) return 30;
        if (count === 2) return 15;
        if (count === 1) return 5;
        return count * 10;
    }
    
    getDeadZonesScore(grid) {
        let penalty = 0;
        let visited = Array(8).fill(0).map(() => Array(8).fill(false));
        
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (grid[r][c] === 0 && !visited[r][c]) {
                    let areaSize = 0;
                    let queue = [[r, c]];
                    visited[r][c] = true;
                    
                    while (queue.length > 0) {
                        let [cr, cc] = queue.shift();
                        areaSize++;
                        
                        let neighbors = [[cr-1, cc], [cr+1, cc], [cr, cc-1], [cr, cc+1]];
                        for (let [nr, nc] of neighbors) {
                            if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && grid[nr][nc] === 0 && !visited[nr][nc]) {
                                visited[nr][nc] = true;
                                queue.push([nr, nc]);
                            }
                        }
                    }
                    // REVISI: NERAKA JAHANAM UNTUK LUBANG KECIL
                    if (areaSize === 1) {
                        penalty -= 500000;
                    } else if (areaSize === 2) {
                        penalty -= 300000;
                    } else if (areaSize === 3) {
                        penalty -= 200000;
                    } else if (areaSize < 9) {
                        penalty -= (9 - areaSize) * 20000;
                    }
                }
            }
        }
        return penalty;
    }

    countNearCompleteLines(grid) {
        let count = 0;
        for (let r = 0; r < 8; r++) {
            let filled = grid[r].filter(v => v === 1).length;
            if (filled === 7) count++;
        }
        for (let c = 0; c < 8; c++) {
            let filled = 0;
            for (let r = 0; r < 8; r++) if (grid[r][c] === 1) filled++;
            if (filled === 7) count++;
        }
        return count;
    }
    
    getGridRoughness(grid) {
        let roughness = 0;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 7; c++) {
                if (grid[r][c] !== grid[r][c+1]) roughness++;
            }
        }
        for (let c = 0; c < 8; c++) {
            for (let r = 0; r < 7; r++) {
                if (grid[r][c] !== grid[r+1][c]) roughness++;
            }
        }
        return roughness;
    }
    
    clearLinesOnGrid(grid) {
        let g = grid.map(r => [...r]);
        let rows_to_clear = [], cols_to_clear = [];
        for (let i = 0; i < 8; i++) {
            if (g[i].every(v => v === 1)) rows_to_clear.push(i);
            let col_full = true;
            for (let j = 0; j < 8; j++) if (g[j][i] === 0) col_full = false;
            if (col_full) cols_to_clear.push(i);
        }
        let count = rows_to_clear.length + cols_to_clear.length;
        for (let r of rows_to_clear) for (let c = 0; c < 8; c++) g[r][c] = 0;
        for (let c of cols_to_clear) for (let r = 0; r < 8; r++) g[r][c] = 0;
        return { grid: g, count };
    }
    
    find_best_move(state, available_blocks) {
        let valid_blocks = [];
        for (let i = 0; i < available_blocks.length; i++) {
            if (available_blocks[i] && available_blocks[i].length > 0) {
                valid_blocks.push({idx: i, block: available_blocks[i]});
            }
        }
        if (valid_blocks.length === 0) return null;
        
        valid_blocks.sort((a, b) => this.getBlockDifficulty(b.block) - this.getBlockDifficulty(a.block));
        
        const dfs = (current_grid, remaining_blocks, current_score, path) => {
            if (remaining_blocks.length === 0) {
                let final_score = current_score;
                
                let can3x3 = false, can5x1 = false, can1x5 = false;
                for (let r = 0; r <= 5; r++) {
                    for (let c = 0; c <= 5; c++) {
                        let ok = true;
                        for (let br = 0; br < 3 && ok; br++) {
                            for (let bc = 0; bc < 3 && ok; bc++) {
                                if (current_grid[r+br][c+bc] !== 0) ok = false;
                            }
                        }
                        if (ok) { can3x3 = true; break; }
                    }
                    if (can3x3) break;
                }
                for (let r = 0; r <= 3; r++) {
                    for (let c = 0; c < 8; c++) {
                        let ok = true;
                        for (let br = 0; br < 5 && ok; br++) {
                            if (current_grid[r+br][c] !== 0) ok = false;
                        }
                        if (ok) { can5x1 = true; break; }
                    }
                    if (can5x1) break;
                }
                for (let r = 0; r < 8; r++) {
                    for (let c = 0; c <= 3; c++) {
                        let ok = true;
                        for (let bc = 0; bc < 5 && ok; bc++) {
                            if (current_grid[r][c+bc] !== 0) ok = false;
                        }
                        if (ok) { can1x5 = true; break; }
                    }
                    if (can1x5) break;
                }
                
                if (!can3x3) final_score -= 500000;
                if (!can5x1) final_score -= 100000;
                if (!can1x5) final_score -= 100000;
                
                final_score += this.getDeadZonesScore(current_grid);
                
                // REVISI: Kembalikan hukuman bergerigi sedikit lebih pedas biar gak ngacak
                final_score -= this.getGridRoughness(current_grid) * 350;
                
                // REVISI: Kurangi sedikit iming-iming jebakan biar dia gak "Pengejar Tiang"
                final_score += this.countNearCompleteLines(current_grid) * 10000;
                
                return { score: final_score, path: path };
            }
            
            let best_future = { score: -9999999, path: path };
            let placed_any = false;
            
            for (let i = 0; i < remaining_blocks.length; i++) {
                let item = remaining_blocks[i];
                
                for (let r = 0; r < 8; r++) {
                    for (let c = 0; c < 8; c++) {
                        if (state.can_place(item.block, r, c, current_grid)) {
                            placed_any = true;
                            let {new_grid, lines_cleared} = state.place_block(item.block, r, c, current_grid);
                            
                            let touching_edges = state.get_touching_edges(item.block, r, c, current_grid);
                            
                            // REVISI: Bonus Nempel Dinaikkan 3x Lipat (Jadi 1500)
                            // Kalau AI gak bisa hancurin baris, dia dipaksa naruh se-mepet mungkin!
                            let step_score = (lines_cleared * 75000) + (touching_edges * 1500);
                            
                            let max_outer_edges = 0;
                            for (let br = 0; br < item.block.length; br++) {
                                for (let bc = 0; bc < item.block[0].length; bc++) {
                                    if (item.block[br][bc] === 1) {
                                        if (br === 0 || item.block[br-1][bc] === 0) max_outer_edges++;
                                        if (br === item.block.length - 1 || item.block[br+1][bc] === 0) max_outer_edges++;
                                        if (bc === 0 || item.block[br][bc-1] === 0) max_outer_edges++;
                                        if (bc === item.block[0].length - 1 || item.block[br][bc+1] === 0) max_outer_edges++;
                                    }
                                }
                            }
                            if (touching_edges >= (max_outer_edges * 0.8)) {
                                step_score += 25000;
                            }
                            
                            let next_remaining = remaining_blocks.filter((_, index) => index !== i);
                            let current_step = { row: r, col: c, block_idx: item.idx, block: item.block, resulting_grid: new_grid };
                            let future = dfs(new_grid, next_remaining, current_score + step_score, [...path, current_step]);
                            
                            if (future.score > best_future.score) best_future = future;
                        }
                    }
                }
            }
            
            if (!placed_any) {
                return { score: current_score - 90000000 - (remaining_blocks.length * 1000000), path: path };
            }
            
            return best_future;
        };
        
        let result = dfs(state.grid, valid_blocks, 0, []);
        if (result.path && result.path.length > 0) return result;
        return null;
    }

    tryItems(currentGrid, validBlocks, availabilities) {
        let best_item = null;
        let max_item_score = -Infinity;
        
        const simulate_all_placements = (grid, blocks, current_score = 0) => {
            if (blocks.length === 0) {
                let final_score = current_score;
                let can3x3 = false, can5x1 = false, can1x5 = false;
                for (let r = 0; r <= 5; r++) { for (let c = 0; c <= 5; c++) { let ok = true; for (let br = 0; br < 3 && ok; br++) { for (let bc = 0; bc < 3 && ok; bc++) { if (grid[r+br][c+bc] !== 0) ok = false; } } if (ok) { can3x3 = true; break; } } if (can3x3) break; }
                for (let r = 0; r <= 3; r++) { for (let c = 0; c < 8; c++) { let ok = true; for (let br = 0; br < 5 && ok; br++) { if (grid[r+br][c] !== 0) ok = false; } if (ok) { can5x1 = true; break; } } if (can5x1) break; }
                for (let r = 0; r < 8; r++) { for (let c = 0; c <= 3; c++) { let ok = true; for (let bc = 0; bc < 5 && ok; bc++) { if (grid[r][c+bc] !== 0) ok = false; } if (ok) { can1x5 = true; break; } } if (can1x5) break; }
                if (!can3x3) final_score -= 500000;
                if (!can5x1) final_score -= 100000;
                if (!can1x5) final_score -= 100000;
                
                final_score += this.getDeadZonesScore(grid);
                final_score -= this.getGridRoughness(grid) * 350;
                final_score += this.countNearCompleteLines(grid) * 10000;
                
                return final_score;
            }
            
            let best_score = null;
            for (let i = 0; i < blocks.length; i++) {
                let block = blocks[i].block;
                for (let r = 0; r <= 8 - block.length; r++) {
                    for (let c = 0; c <= 8 - block[0].length; c++) {
                        if (state.can_place(block, r, c, grid)) {
                            let {new_grid, lines_cleared} = state.place_block(block, r, c, grid);
                            let touching_edges = state.get_touching_edges(block, r, c, grid);
                            
                            // Samakan dengan otak utama
                            let step_score = (lines_cleared * 75000) + (touching_edges * 1500);
                            
                            let max_outer_edges = 0;
                            for (let br = 0; br < block.length; br++) {
                                for (let bc = 0; bc < block[0].length; bc++) {
                                    if (block[br][bc] === 1) {
                                        if (br === 0 || block[br-1][bc] === 0) max_outer_edges++;
                                        if (br === block.length - 1 || block[br+1][bc] === 0) max_outer_edges++;
                                        if (bc === 0 || block[br][bc-1] === 0) max_outer_edges++;
                                        if (bc === block[0].length - 1 || block[br][bc+1] === 0) max_outer_edges++;
                                    }
                                }
                            }
                            if (touching_edges >= (max_outer_edges * 0.8)) {
                                step_score += 25000;
                            }
                            
                            let remaining = blocks.filter((_, idx) => idx !== i);
                            let future = simulate_all_placements(new_grid, remaining, current_score + step_score);
                            
                            if (future !== null) {
                                if (best_score === null || future > best_score) best_score = future;
                            }
                        }
                    }
                }
            }
            return best_score;
        };

        if (availabilities.can1x1) {
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    if (currentGrid[r][c] === 0) {
                        let simGrid = currentGrid.map(row => [...row]);
                        simGrid[r][c] = 1;
                        let {grid: clearedGrid, count: lines_cleared} = this.clearLinesOnGrid(simGrid);
                        let testGrid = lines_cleared > 0 ? clearedGrid : simGrid;
                        let bonus = lines_cleared > 0 ? 1000000 : 10000;
                        
                        let score = simulate_all_placements(testGrid, validBlocks);
                        if (score !== null) {
                            let final_score = score + bonus;
                            if (final_score > max_item_score) {
                                max_item_score = final_score;
                                best_item = { type: '1x1', r, c, score: final_score };
                            }
                        }
                    }
                }
            }
        }
        
        if (availabilities.canTrash) {
            for (let i = 0; i < validBlocks.length; i++) {
                let remainingAfterDiscard = validBlocks.filter((_, idx) => idx !== i);
                
                if (remainingAfterDiscard.length === 0) {
                    let final_score = 500000;
                    if (final_score > max_item_score) {
                        max_item_score = final_score;
                        best_item = { type: 'trash', queue_idx: validBlocks[i].idx, score: final_score };
                    }
                } else {
                    let score = simulate_all_placements(currentGrid, remainingAfterDiscard);
                    if (score !== null) {
                        let final_score = score + 500000;
                        if (final_score > max_item_score) {
                            max_item_score = final_score;
                            best_item = { type: 'trash', queue_idx: validBlocks[i].idx, score: final_score };
                        }
                    }
                }
            }
        }
        
        if (availabilities.canBomb) {
            const offsets = [[0,0], [-1,0], [1,0], [0,-1], [0,1]];
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    let simGrid = currentGrid.map(row => [...row]);
                    let blasted = 0;
                    offsets.forEach(off => {
                        let nr = r + off[0], nc = c + off[1];
                        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && simGrid[nr][nc] === 1) {
                            simGrid[nr][nc] = 0;
                            blasted++;
                        }
                    });
                    if (blasted > 0) {
                        let score = simulate_all_placements(simGrid, validBlocks);
                        if (score !== null) {
                            let final_score = score + 100000;
                            if (final_score > max_item_score) {
                                max_item_score = final_score;
                                best_item = { type: 'bomb', r, c, score: final_score };
                            }
                        }
                    }
                }
            }
        }
        
        return best_item;
    }
}

// UI State & Logic
const state = new GameState();
const ai = new AIEngine();
let spawnerQueues = [null, null, null];
let currentRecommendation = null;
let itemRecommendation = null;

const defaultShapes = [
    [[1]],[[1,1]],[[1],[1]],[[1,1,1]],[[1],[1],[1]],[[1,1,1,1,1]],[[1],[1],[1],[1],[1]],[[1,1],[1,1]],[[1,1,1],[1,1,1],[1,1,1]],[[1,0],[1,1]],[[0,1],[1,1]],[[1,1],[1,0]],[[1,1],[0,1]],[[1,1,1],[0,1,0]],[[0,1,0],[1,1,1]],[[1,1,1],[0,0,1]],[[1,0,0],[1,1,1]],[[1,1,1],[1,0,0]],[[0,0,1],[1,1,1]],[[0,1,1],[1,1,0]],[[1,1,0],[0,1,1]],[[1,0],[1,1],[1,0]],[[0,1],[1,1],[0,1]],[[0,1],[1,1],[1,0]],[[1,0],[1,0],[1,1]],[[1,0],[1,1],[0,1]],[[0,1],[0,1],[1,1]],[[1,1],[0,1],[0,1]],[[1,1],[1,0],[1,0]],[[1,0,0],[1,0,0],[1,1,1]],[[0,0,1],[0,0,1],[1,1,1]],[[1,1,1],[1,0,0],[1,0,0]],[[1,1,1],[0,0,1],[0,0,1]],[[1,0,0],[1,1,1],[1,0,0]],[[0,0,1],[1,1,1],[0,0,1]],[[0,1,0],[0,1,0],[1,1,1]],[[1,1,1],[0,1,0],[0,1,0]],[[1,0],[0,1]],[[0,1],[1,0]],[[1,0,0],[0,1,0],[0,0,1]],[[0,0,1],[0,1,0],[1,0,0]],[[1,1],[1,0],[1,1]],[[1,1],[0,1],[1,1]],[[1,1,1],[1,1,1]],[[1,1],[1,1],[1,1]]
];
let library = [];

function loadLibrary() {
    const saved = localStorage.getItem('blockzi_pwa_lib');
    if (saved) { 
        library = JSON.parse(saved); 
        if (library.length !== 45) library = [];
    }
    if (!library || library.length === 0) {
        library = JSON.parse(JSON.stringify(defaultShapes));
        localStorage.setItem('blockzi_pwa_lib', JSON.stringify(library));
    }
    renderLibrary();
}

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

const shapeOrder = [
    [[1]], 
    [[1,1],[1,1]], 
    [[1,1,1],[1,1,1],[1,1,1]], [[1,1,1],[1,1,1]], [[1,1],[1,1],[1,1]],
    [[1,1]], [[1],[1]],
    [[1,1,1]], [[1],[1],[1]],
    [[1,1,1,1,1]], [[1],[1],[1],[1],[1]],
    [[1,0],[0,1]], [[0,1],[1,0]],
    [[1,0,0],[0,1,0],[0,0,1]], [[0,0,1],[0,1,0],[1,0,0]],
    [[1,0],[1,1]], [[0,1],[1,1]], [[1,1],[1,0]], [[1,1],[0,1]],
    [[1,0],[1,0],[1,1]], [[0,1],[0,1],[1,1]], [[1,1],[1,0],[1,0]], [[1,1],[0,1],[0,1]],
    [[1,1,1],[1,0,0]], [[1,1,1],[0,0,1]], [[1,0,0],[1,1,1]], [[0,0,1],[1,1,1]],
    [[1,0,0],[1,0,0],[1,1,1]], [[0,0,1],[0,0,1],[1,1,1]], [[1,1,1],[1,0,0],[1,0,0]], [[1,1,1],[0,0,1],[0,0,1]],
    [[1,1,1],[0,1,0]], [[0,1,0],[1,1,1]], [[1,0],[1,1],[1,0]], [[0,1],[1,1],[0,1]],
    [[1,0,0],[1,1,1],[1,0,0]], [[0,0,1],[1,1,1],[0,0,1]], [[0,1,0],[0,1,0],[1,1,1]], [[1,1,1],[0,1,0],[0,1,0]],
    [[0,1,1],[1,1,0]], [[1,1,0],[0,1,1]],
    [[1,0],[1,1],[0,1]], [[0,1],[1,1],[1,0]],
    [[1,1],[1,0],[1,1]], [[1,1],[0,1],[1,1]]
];

function getShapeSortIndex(shape) {
    let str = JSON.stringify(shape);
    for(let i=0; i<shapeOrder.length; i++){
        if (JSON.stringify(shapeOrder[i]) === str) return i;
    }
    return 999;
}

function renderLibrary() {
    const pal = document.getElementById('palette');
    pal.innerHTML = '';
    
    library.sort((a, b) => {
        let idxA = getShapeSortIndex(a);
        let idxB = getShapeSortIndex(b);
        if (idxA !== idxB) return idxA - idxB;
        
        let countA = a.flat().reduce((s,v)=>s+v,0);
        let countB = b.flat().reduce((s,v)=>s+v,0);
        if (countA !== countB) return countA - countB;
        if (a.length !== b.length) return a.length - b.length;
        if (a[0].length !== b[0].length) return a[0].length - b[0].length;
        return JSON.stringify(b).localeCompare(JSON.stringify(a));
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
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            let cell = document.getElementById(`board-${r}-${c}`);
            cell.className = 'cell';
            cell.innerText = '';
            if (state.grid[r][c] === 1) cell.classList.add('filled');
        }
    }
    
    document.querySelectorAll('.item-bomb, .item-1x1, .item-hammer').forEach(e => e.className = e.className.replace(/item-\S+/g, '').trim());
    document.querySelectorAll('.queue-slot').forEach(el => { 
        el.style.border = '';
        let badge = el.querySelector('.queue-badge');
        if (badge) badge.remove();
    });
    
    if (currentRecommendation && currentRecommendation.length > 0) {
        currentRecommendation.forEach((step, index) => {
            let stepNum = index + 1;
            
            for (let r = 0; r < step.block.length; r++) {
                for (let c = 0; c < step.block[0].length; c++) {
                    if (step.block[r][c] === 1) {
                        let cell = document.getElementById(`board-${step.row + r}-${step.col + c}`);
                        if (cell) {
                            cell.classList.remove('filled');
                            let layer = document.createElement('div');
                            layer.className = `preview-layer step-${stepNum}`;
                            layer.innerText = stepNum;
                            cell.appendChild(layer);
                        }
                    }
                }
            }
            
            let qSlot = document.querySelector(`.queue-slot[data-idx="${step.block_idx}"]`);
            if (qSlot) {
                let colors = ["#eab308", "#06b6d4", "#ef4444"];
                qSlot.style.border = `2px solid ${colors[index]}`;
                
                let badge = document.createElement('div');
                badge.className = `queue-badge badge-${stepNum}`;
                badge.innerText = stepNum;
                qSlot.appendChild(badge);
            }
        });
        
    } else if (itemRecommendation) {
        if (itemRecommendation.type === '1x1') {
            let cell = document.getElementById(`board-${itemRecommendation.r}-${itemRecommendation.c}`);
            if (cell) cell.classList.add('item-1x1');
        } else if (itemRecommendation.type === 'trash') {
            let qSlot = document.querySelector(`.queue-slot[data-idx="${itemRecommendation.queue_idx}"]`);
            if (qSlot) qSlot.classList.add('item-trash');
        } else if (itemRecommendation.type === 'bomb') {
            const offsets = [[0,0], [-1,0], [1,0], [0,-1], [0,1]];
            offsets.forEach(off => {
                let nr = itemRecommendation.r + off[0], nc = itemRecommendation.c + off[1];
                if(nr>=0 && nr<8 && nc>=0 && nc<8) document.getElementById(`board-${nr}-${nc}`).classList.add('item-bomb');
            });
        }
    }
}

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

document.getElementById('clear-board-btn').onclick = () => {
    state.grid = Array(8).fill().map(() => Array(8).fill(0));
    clearRecommendation();
};

document.getElementById('calculate-btn').onclick = () => {
    let validBlocks = [];
    for(let i=0; i<3; i++) if(spawnerQueues[i]) validBlocks.push({idx: i, block: spawnerQueues[i]});
    
    if (validBlocks.length === 0) {
        document.getElementById('ai-status').textContent = "Isi antrean balok dulu!";
        return;
    }
    
    let result = ai.find_best_move(state, spawnerQueues);
    let isKiamat = result && result.score < -500000;
    let allPlaced = result && result.path && result.path.length === validBlocks.length;
    
    if (allPlaced) {
        currentRecommendation = result.path;
        document.getElementById('ai-status').textContent = `Berhasil! (Skor: ${result.score})`;
        if (isKiamat) document.getElementById('ai-status').textContent += " ⚠️ AWAS KIAMAT!";
        document.getElementById('ai-status').className = "status-badge" + (isKiamat ? " alert" : "");
        document.getElementById('apply-btn').disabled = false;
        
        updateBoardVisuals(); 
        
    } else {
        let availabilities = {
            can1x1: document.getElementById('use-1x1-toggle').checked,
            canTrash: document.getElementById('use-hammer-toggle').checked,
            canBomb: document.getElementById('use-bomb-toggle').checked
        };
        let itemsAllowed = availabilities.can1x1 || availabilities.canTrash || availabilities.canBomb;
        
        if (itemsAllowed) {
            document.getElementById('ai-status').textContent = "Evaluasi Masa Depan...";
            document.getElementById('ai-status').className = "status-badge alert";
            
            setTimeout(() => {
                let itemRec = ai.tryItems(state.grid, validBlocks, availabilities);
                if (itemRec) {
                    itemRecommendation = itemRec;
                    
                    if (itemRecommendation.type === '1x1' && itemRecommendation.score > 900000) {
                        document.getElementById('ai-status').innerHTML = "🌟 BINTANG 5: Gunakan <b>Tambah 1x1</b>";
                    } else if (itemRecommendation.type === '1x1') {
                        document.getElementById('ai-status').innerHTML = "⭐ BINTANG 3: Gunakan <b>Tambah 1x1</b>";
                    } else if (itemRecommendation.type === 'trash') {
                        document.getElementById('ai-status').innerHTML = "🌟 BINTANG 4: <b>Hapus Balok</b> di antrean";
                    } else if (itemRecommendation.type === 'bomb') {
                        document.getElementById('ai-status').innerHTML = "⚠️ BINTANG 2: Gunakan <b>Bomb '+'</b>";
                    }
                } else {
                    document.getElementById('ai-status').textContent = "😭 GAME OVER (Semua Mentok)";
                    if (result && result.path && result.path.length > 0) {
                        currentRecommendation = result.path;
                        document.getElementById('ai-status').textContent += " - Lihat langkah terakhir di papan";
                        document.getElementById('apply-btn').disabled = false;
                    }
                }
                updateBoardVisuals();
            }, 50);
        } else {
            document.getElementById('ai-status').textContent = "🛑 GAME OVER! (Mentok)";
            if (result && result.path && result.path.length > 0) {
                currentRecommendation = result.path;
                document.getElementById('ai-status').textContent += " - Lihat langkah terakhir";
                document.getElementById('apply-btn').disabled = false;
            }
            document.getElementById('ai-status').className = "status-badge alert";
            updateBoardVisuals();
        }
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

loadLibrary();
initBoard();
initBuilder();
updateBoardVisuals();
updateSpawnerVisuals();
