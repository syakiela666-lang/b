// ==========================================
// GAME STATE & MECHANICS
// ==========================================
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

// ==========================================
// AI ENGINE (3 BRAIN MODES)
// ==========================================
class AIEngine {
    // Shared: block difficulty
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

    // Shared: dead zones (isolated small empty pockets)
    getDeadZonesScore(grid) {
        let penalty = 0;
        let visited = new Uint8Array(64);
        let q = new Uint8Array(64);
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                let idx = r * 8 + c;
                if (grid[r][c] === 0 && visited[idx] === 0) {
                    let areaSize = 0;
                    let head = 0, tail = 0;
                    q[tail++] = idx;
                    visited[idx] = 1;
                    while (head < tail) {
                        let curr = q[head++];
                        areaSize++;
                        let cr = Math.floor(curr / 8), cc = curr % 8;
                        if (cr > 0 && grid[cr-1][cc] === 0 && visited[(cr-1)*8+cc] === 0) { visited[(cr-1)*8+cc] = 1; q[tail++] = (cr-1)*8+cc; }
                        if (cr < 7 && grid[cr+1][cc] === 0 && visited[(cr+1)*8+cc] === 0) { visited[(cr+1)*8+cc] = 1; q[tail++] = (cr+1)*8+cc; }
                        if (cc > 0 && grid[cr][cc-1] === 0 && visited[cr*8+(cc-1)] === 0) { visited[cr*8+(cc-1)] = 1; q[tail++] = cr*8+(cc-1); }
                        if (cc < 7 && grid[cr][cc+1] === 0 && visited[cr*8+(cc+1)] === 0) { visited[cr*8+(cc+1)] = 1; q[tail++] = cr*8+(cc+1); }
                    }
                    if (areaSize === 1) penalty -= 500000;
                    else if (areaSize === 2) penalty -= 300000;
                    else if (areaSize === 3) penalty -= 200000;
                    else if (areaSize < 9) penalty -= (9 - areaSize) * 20000;
                }
            }
        }
        return penalty;
    }

    // Shared: near-complete lines
    countNearCompleteLines(grid) {
        let count = 0;
        for (let r = 0; r < 8; r++) {
            let filled = grid[r].filter(v => v === 1).length;
            if (filled >= 6) count++;
        }
        for (let c = 0; c < 8; c++) {
            let filled = 0;
            for (let r = 0; r < 8; r++) if (grid[r][c] === 1) filled++;
            if (filled >= 6) count++;
        }
        return count;
    }

    // Shared: grid roughness
    getGridRoughness(grid) {
        let roughness = 0;
        for (let r = 0; r < 8; r++) for (let c = 0; c < 7; c++) if (grid[r][c] !== grid[r][c+1]) roughness++;
        for (let c = 0; c < 8; c++) for (let r = 0; r < 7; r++) if (grid[r][c] !== grid[r+1][c]) roughness++;
        return roughness;
    }

    // Shared: can fit big blocks?
    canFitBlocks(grid) {
        let can3x3 = false, can5x1 = false, can1x5 = false;
        for (let r = 0; r <= 5 && !can3x3; r++) for (let c = 0; c <= 5 && !can3x3; c++) {
            let ok = true;
            for (let br = 0; br < 3 && ok; br++) for (let bc = 0; bc < 3 && ok; bc++) if (grid[r+br][c+bc] !== 0) ok = false;
            if (ok) can3x3 = true;
        }
        for (let r = 0; r <= 3 && !can5x1; r++) for (let c = 0; c < 8 && !can5x1; c++) {
            let ok = true;
            for (let br = 0; br < 5 && ok; br++) if (grid[r+br][c] !== 0) ok = false;
            if (ok) can5x1 = true;
        }
        for (let r = 0; r < 8 && !can1x5; r++) for (let c = 0; c <= 3 && !can1x5; c++) {
            let ok = true;
            for (let bc = 0; bc < 5 && ok; bc++) if (grid[r][c+bc] !== 0) ok = false;
            if (ok) can1x5 = true;
        }
        return { can3x3, can5x1, can1x5 };
    }

    // Shared: count empty cells
    countEmptyCells(grid) {
        let empty = 0;
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (grid[r][c] === 0) empty++;
        return empty;
    }

    // Shared: dead zone step penalty (fast check for isolated cells created by placement)
    getDeadZoneStepPenalty(grid, block, row, col) {
        let penalty = 0;
        let affected = new Set();
        for (let br = 0; br < block.length; br++) {
            for (let bc = 0; bc < block[0].length; bc++) {
                if (block[br][bc] === 1) {
                    let r = row + br, c = col + bc;
                    if (r > 0 && grid[r-1][c] === 0) affected.add((r-1)*8+c);
                    if (r < 7 && grid[r+1][c] === 0) affected.add((r+1)*8+c);
                    if (c > 0 && grid[r][c-1] === 0) affected.add(r*8+(c-1));
                    if (c < 7 && grid[r][c+1] === 0) affected.add(r*8+(c+1));
                }
            }
        }
        for (let idx of affected) {
            let cr = Math.floor(idx/8), cc = idx%8;
            let neighbors = 0;
            if (cr > 0 && grid[cr-1][cc] === 0) neighbors++;
            if (cr < 7 && grid[cr+1][cc] === 0) neighbors++;
            if (cc > 0 && grid[cr][cc-1] === 0) neighbors++;
            if (cc < 7 && grid[cr][cc+1] === 0) neighbors++;
            if (neighbors === 0) penalty -= 400000;
            else if (neighbors === 1) penalty -= 150000;
        }
        return penalty;
    }

    // ========== BRAIN 1: PREDIKTIF (Predictive) ==========
    // Strategy: Always save space for big blocks (3x3, 5-line) — anti game-over
    countBigBlockSlots(grid) {
        let slots3x3 = 0, slots5h = 0, slots5v = 0, slots2x2 = 0;
        for (let r = 0; r <= 5; r++) for (let c = 0; c <= 5; c++) {
            let ok = true;
            for (let br = 0; br < 3 && ok; br++) for (let bc = 0; bc < 3 && ok; bc++) if (grid[r+br][c+bc] !== 0) ok = false;
            if (ok) slots3x3++;
        }
        for (let r = 0; r < 8; r++) for (let c = 0; c <= 3; c++) {
            let ok = true;
            for (let bc = 0; bc < 5 && ok; bc++) if (grid[r][c+bc] !== 0) ok = false;
            if (ok) slots5h++;
        }
        for (let r = 0; r <= 3; r++) for (let c = 0; c < 8; c++) {
            let ok = true;
            for (let br = 0; br < 5 && ok; br++) if (grid[r+br][c] !== 0) ok = false;
            if (ok) slots5v++;
        }
        for (let r = 0; r <= 6; r++) for (let c = 0; c <= 6; c++) {
            if (grid[r][c]===0 && grid[r][c+1]===0 && grid[r+1][c]===0 && grid[r+1][c+1]===0) slots2x2++;
        }
        return { slots3x3, slots5h, slots5v, slots2x2 };
    }

    evaluate_brain1(grid, initial_score = 0) {
        let score = initial_score;
        let fit = this.canFitBlocks(grid);
        let slots = this.countBigBlockSlots(grid);

        // WAJIB bisa fit 3x3 — kalau gak bisa, penalty GEDE
        if (!fit.can3x3) score -= 2000000;
        if (!fit.can5x1) score -= 500000;
        if (!fit.can1x5) score -= 500000;

        // Reward BANYAK slot buat balok gede (bukan cuma bisa/tidak)
        score += slots.slots3x3 * 40000;  // tiap posisi 3x3 possible = bonus
        score += slots.slots5h * 15000;
        score += slots.slots5v * 15000;
        score += slots.slots2x2 * 8000;

        // Dead zones
        score += this.getDeadZonesScore(grid);

        // Roughness — keep board tidy
        score -= this.getGridRoughness(grid) * 400;

        // Empty cells bonus
        let empty = this.countEmptyCells(grid);
        score += empty * 5000;

        // Near-complete lines — still reward clears
        score += this.countNearCompleteLines(grid) * 12000;

        return score;
    }

    stepScore_brain1(lines_cleared, touching_edges, max_outer_edges, block, row, col, grid) {
        let s = (lines_cleared * 100000) + (touching_edges * 500);
        if (grid) {
            s += this.getDeadZoneStepPenalty(grid, block, row, col);
            // Reward: after placement, still banyak slot buat balok gede?
            let slots = this.countBigBlockSlots(grid);
            s += slots.slots3x3 * 5000;
            s += Math.min(slots.slots5h + slots.slots5v, 10) * 2000;
        }
        return s;
    }

    // ========== BRAIN 2: DARURAT (Emergency) ==========
    // Strategy: Board penuh? AGRESIF clear line, no mercy
    evaluate_brain2(grid, initial_score = 0) {
        let score = initial_score;
        let fit = this.canFitBlocks(grid);
        if (!fit.can3x3) score -= 800000;
        if (!fit.can5x1) score -= 200000;
        if (!fit.can1x5) score -= 200000;
        score += this.getDeadZonesScore(grid);

        // AGRESIF: reward near-complete lines heavily
        let nearLines = 0;
        let rowFills = [], colFills = [];
        for (let r = 0; r < 8; r++) {
            let filled = grid[r].filter(v => v === 1).length;
            rowFills.push(filled);
            if (filled === 7) nearLines += 4;      // 7/8 = almost clear!
            else if (filled === 6) nearLines += 2;
            else if (filled >= 5) nearLines += 1;
        }
        for (let c = 0; c < 8; c++) {
            let filled = 0;
            for (let r = 0; r < 8; r++) if (grid[r][c] === 1) filled++;
            colFills.push(filled);
            if (filled === 7) nearLines += 4;
            else if (filled === 6) nearLines += 2;
            else if (filled >= 5) nearLines += 1;
        }
        score += nearLines * 30000;

        // Concentrate filling on fewer lines (easier to clear)
        let focusedRows = rowFills.filter(f => f >= 5).length;
        let focusedCols = colFills.filter(f => f >= 5).length;
        score += focusedRows * 8000;
        score += focusedCols * 8000;

        // Empty rows/cols bonus (keep some completely clear)
        let emptyRows = rowFills.filter(f => f === 0).length;
        let emptyCols = colFills.filter(f => f === 0).length;
        score += emptyRows * 5000;
        score += emptyCols * 5000;

        // Less roughness penalty — we want to fill aggressively
        score -= this.getGridRoughness(grid) * 150;

        // Empty cells bonus (but less than Prediktif)
        let empty = this.countEmptyCells(grid);
        score += empty * 2000;

        return score;
    }

    stepScore_brain2(lines_cleared, touching_edges, max_outer_edges, block, row, col, grid) {
        // LINE CLEAR IS KING — 150k per line
        let s = (lines_cleared * 150000) + (touching_edges * 300);
        if (grid) {
            s += this.getDeadZoneStepPenalty(grid, block, row, col);
            // Bonus: adding to rows/cols that are already partially filled
            let rowFill = 0, colFill = 0;
            for (let br = 0; br < block.length; br++) {
                for (let bc = 0; bc < block[0].length; bc++) {
                    if (block[br][bc] === 1) {
                        let cr = row + br, cc = col + bc;
                        rowFill += grid[cr].filter(v => v === 1).length;
                        let cf = 0; for (let r = 0; r < 8; r++) if (grid[r][cc] === 1) cf++;
                        colFill += cf;
                    }
                }
            }
            s += (rowFill + colFill) * 500;
        }
        // Multi-line clear BONUS (2 lines = bonus, 3+ = jackpot)
        if (lines_cleared >= 2) s += lines_cleared * 50000;
        return s;
    }

    // ========== BRAIN 3: COMBO (Chain Clear) ==========
    // Strategy: Build multiple near-complete lines, clear them together
    evaluate_brain3(grid, initial_score = 0) {
        let score = initial_score;
        let fit = this.canFitBlocks(grid);
        if (!fit.can3x3) score -= 1000000;
        if (!fit.can5x1) score -= 300000;
        if (!fit.can1x5) score -= 300000;
        score += this.getDeadZonesScore(grid) * 1.3;

        // Count "setup" lines (6-7 filled = ready to clear)
        let setupRows = 0, setupCols = 0;
        let rowFills = [], colFills = [];
        for (let r = 0; r < 8; r++) {
            let filled = grid[r].filter(v => v === 1).length;
            rowFills.push(filled);
            if (filled === 7) setupRows += 5;
            else if (filled === 6) setupRows += 3;
            else if (filled === 5) setupRows += 1;
        }
        for (let c = 0; c < 8; c++) {
            let filled = 0;
            for (let r = 0; r < 8; r++) if (grid[r][c] === 1) filled++;
            colFills.push(filled);
            if (filled === 7) setupCols += 5;
            else if (filled === 6) setupCols += 3;
            else if (filled === 5) setupCols += 1;
        }
        score += (setupRows + setupCols) * 25000;

        // Reward having MULTIPLE near-complete lines (combo potential)
        let totalNearComplete = rowFills.filter(f => f >= 6).length + colFills.filter(f => f >= 6).length;
        if (totalNearComplete >= 2) score += totalNearComplete * 50000; // combo multiplier
        if (totalNearComplete >= 3) score += 200000; // JACKPOT setup

        // Connected empty space — penting buat flexibility
        let visited = new Uint8Array(64);
        let q = new Uint8Array(64);
        let maxRegion = 0, totalEmpty = 0;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (grid[r][c] === 0) {
                    totalEmpty++;
                    let idx = r * 8 + c;
                    if (visited[idx] === 0) {
                        let regionSize = 0, head = 0, tail = 0;
                        q[tail++] = idx; visited[idx] = 1;
                        while (head < tail) {
                            let curr = q[head++]; regionSize++;
                            let cr = Math.floor(curr/8), cc = curr%8;
                            if (cr > 0 && grid[cr-1][cc] === 0 && visited[(cr-1)*8+cc] === 0) { visited[(cr-1)*8+cc]=1; q[tail++]=(cr-1)*8+cc; }
                            if (cr < 7 && grid[cr+1][cc] === 0 && visited[(cr+1)*8+cc] === 0) { visited[(cr+1)*8+cc]=1; q[tail++]=(cr+1)*8+cc; }
                            if (cc > 0 && grid[cr][cc-1] === 0 && visited[cr*8+(cc-1)] === 0) { visited[cr*8+(cc-1)]=1; q[tail++]=cr*8+(cc-1); }
                            if (cc < 7 && grid[cr][cc+1] === 0 && visited[cr*8+(cc+1)] === 0) { visited[cr*8+(cc+1)]=1; q[tail++]=cr*8+(cc+1); }
                        }
                        if (regionSize > maxRegion) maxRegion = regionSize;
                    }
                }
            }
        }
        score += maxRegion * 12000;
        if (totalEmpty > 0 && maxRegion < totalEmpty * 0.6) {
            score -= (totalEmpty * 0.6 - maxRegion) * 20000;
        }

        // Roughness
        score -= this.getGridRoughness(grid) * 300;

        // Empty cells
        score += totalEmpty * 4000;

        // 2x2 space check
        let has2x2 = false;
        for (let r = 0; r <= 6 && !has2x2; r++) for (let c = 0; c <= 6 && !has2x2; c++) {
            if (grid[r][c]===0 && grid[r][c+1]===0 && grid[r+1][c]===0 && grid[r+1][c+1]===0) has2x2 = true;
        }
        if (!has2x2) score -= 600000;

        return score;
    }

    stepScore_brain3(lines_cleared, touching_edges, max_outer_edges, block, row, col, grid) {
        let s = (lines_cleared * 100000) + (touching_edges * 400);
        if (grid) {
            s += this.getDeadZoneStepPenalty(grid, block, row, col);
            // Reward: adding to lines that are already building up
            let buildup = 0;
            for (let br = 0; br < block.length; br++) {
                for (let bc = 0; bc < block[0].length; bc++) {
                    if (block[br][bc] === 1) {
                        let cr = row + br, cc = col + bc;
                        let rf = grid[cr].filter(v => v === 1).length;
                        let cf = 0; for (let r = 0; r < 8; r++) if (grid[r][cc] === 1) cf++;
                        if (rf >= 4) buildup += rf * 800;
                        if (cf >= 4) buildup += cf * 800;
                    }
                }
            }
            s += buildup;
        }
        // Multi-line clear bonus
        if (lines_cleared >= 2) s += lines_cleared * 40000;
        return s;
    }

    // ========== ADAPTIVE (Auto) ==========
    // Strategy: <35% = Combo, 35-60% = Prediktif, >60% = Darurat
    getBoardFillPercent(grid) {
        let filled = 0;
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (grid[r][c] === 1) filled++;
        return filled / 64 * 100;
    }

    getAdaptiveSubMode(grid) {
        let fill = this.getBoardFillPercent(grid);
        if (fill < 35) return 3;       // Combo — board lega, bangun chain clear
        if (fill <= 60) return 1;       // Prediktif — mulai rame, sisain ruang
        return 2;                        // Darurat — penuh, gas clear agresif
    }

    evaluate_brain4(grid, initial_score = 0) {
        let subMode = this.getAdaptiveSubMode(grid);
        if (subMode === 1) return this.evaluate_brain1(grid, initial_score);
        if (subMode === 2) return this.evaluate_brain2(grid, initial_score);
        return this.evaluate_brain3(grid, initial_score);
    }

    stepScore_brain4(lines_cleared, touching_edges, max_outer_edges, block, row, col, grid) {
        let subMode = this.getAdaptiveSubMode(grid);
        if (subMode === 1) return this.stepScore_brain1(lines_cleared, touching_edges, max_outer_edges, block, row, col, grid);
        if (subMode === 2) return this.stepScore_brain2(lines_cleared, touching_edges, max_outer_edges, block, row, col, grid);
        return this.stepScore_brain3(lines_cleared, touching_edges, max_outer_edges, block, row, col, grid);
    }

    // ========== SHARED: clear lines on a grid ==========
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

    // ========== SHARED: find_best_move with brain mode ==========
    find_best_move(state, available_blocks, brainMode = 1) {
        let valid_blocks = [];
        for (let i = 0; i < available_blocks.length; i++) {
            if (available_blocks[i] && available_blocks[i].length > 0) {
                valid_blocks.push({idx: i, block: available_blocks[i]});
            }
        }
        if (valid_blocks.length === 0) return null;

        valid_blocks.sort((a, b) => this.getBlockDifficulty(b.block) - this.getBlockDifficulty(a.block));

        const evalFn = brainMode === 1 ? (g, s) => this.evaluate_brain1(g, s)
                     : brainMode === 2 ? (g, s) => this.evaluate_brain2(g, s)
                     : brainMode === 3 ? (g, s) => this.evaluate_brain3(g, s)
                     : (g, s) => this.evaluate_brain4(g, s);

        const stepFn = brainMode === 1 ? (lc, te, moe, b, r, c, g) => this.stepScore_brain1(lc, te, moe, b, r, c, g)
                     : brainMode === 2 ? (lc, te, moe, b, r, c, g) => this.stepScore_brain2(lc, te, moe, b, r, c, g)
                     : brainMode === 3 ? (lc, te, moe, b, r, c, g) => this.stepScore_brain3(lc, te, moe, b, r, c, g)
                     : (lc, te, moe, b, r, c, g) => this.stepScore_brain4(lc, te, moe, b, r, c, g);

        const dfs = (current_grid, remaining_blocks, current_score, path, total_lines_cleared = 0) => {
            if (remaining_blocks.length === 0) {
                return { score: evalFn(current_grid, current_score) + total_lines_cleared * 30000, path: path };
            }
            let best_future = { score: -Infinity, path: path };
            let placed_any = false;

            for (let i = 0; i < remaining_blocks.length; i++) {
                let item = remaining_blocks[i];
                for (let r = 0; r <= 8 - item.block.length; r++) {
                    for (let c = 0; c <= 8 - item.block[0].length; c++) {
                        if (state.can_place(item.block, r, c, current_grid)) {
                            placed_any = true;
                            let {new_grid, lines_cleared} = state.place_block(item.block, r, c, current_grid);
                            let touching_edges = state.get_touching_edges(item.block, r, c, current_grid);

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

                            let step_score = stepFn(lines_cleared, touching_edges, max_outer_edges, item.block, r, c, current_grid);
                            step_score += this.getDeadZoneStepPenalty(new_grid, item.block, r, c) * 0.5;

                            let next_remaining = remaining_blocks.filter((_, index) => index !== i);
                            let current_step = { row: r, col: c, block_idx: item.idx, block: item.block, resulting_grid: new_grid };
                            let future = dfs(new_grid, next_remaining, current_score + step_score, [...path, current_step], total_lines_cleared + lines_cleared);

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

    // ========== tryItems (shared, uses brain mode for eval) ==========
    tryItems(currentGrid, validBlocks, availabilities, brainMode = 1) {
        let best_item = null;
        let max_item_score = -Infinity;
        
        const evalBoard = (g, s) => brainMode === 1 ? this.evaluate_brain1(g, s)
            : brainMode === 2 ? this.evaluate_brain2(g, s)
            : brainMode === 3 ? this.evaluate_brain3(g, s)
            : this.evaluate_brain4(g, s);
        
        const simulate_all_placements = (grid, blocks, current_score = 0) => {
            if (blocks.length === 0) {
                return evalBoard(grid, current_score);
            }
            
            let best_score = null;
            for (let i = 0; i < blocks.length; i++) {
                let block = blocks[i].block;
                for (let r = 0; r <= 8 - block.length; r++) {
                    for (let c = 0; c <= 8 - block[0].length; c++) {
                        if (state.can_place(block, r, c, grid)) {
                            let {new_grid, lines_cleared} = state.place_block(block, r, c, grid);
                            let touching_edges = state.get_touching_edges(block, r, c, grid);
                            
                            let step_score = (lines_cleared * 90000) + (touching_edges * 600);
                            step_score += this.getDeadZoneStepPenalty(new_grid, block, r, c);
                            
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
                                step_score += 10000;
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

// ==========================================
// UI STATE & LOGIC (LOCKED / PERMANENT)
// ==========================================
const state = new GameState();
const ai = new AIEngine();
let spawnerQueues = [null, null, null];
let currentRecommendation = null;
let itemRecommendation = null;
let currentBrainMode = 1;

// Brain mode switcher
document.querySelectorAll('.brain-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.brain-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentBrainMode = parseInt(btn.dataset.mode);
        clearRecommendation();
    };
});

// Kategori Permanen (Dikunci, Data dari Output Final)
const permanentCategories = {
    "TITIK": [[[1]],[[1,0],[0,1]],[[0,1],[1,0]],[[1,0,0],[0,1,0],[0,0,1]],[[0,0,1],[0,1,0],[1,0,0]]],
    "GARIS": [[[1,1]],[[1],[1]],[[1,1,1]],[[1],[1],[1]],[[1,1,1,1,1]],[[1],[1],[1],[1],[1]]],
    "KOTAK": [[[1,1],[1,1]],[[1,1,1],[1,1,1]],[[1,1],[1,1],[1,1]],[[1,1,1],[1,1,1],[1,1,1]]],
    "SIKU": [[[1,0],[1,1]],[[0,1],[1,1]],[[1,1],[1,0]],[[1,1],[0,1]]],
    "Z": [[[0,1,1],[1,1,0]],[[1,1,0],[0,1,1]],[[1,0],[1,1],[0,1]],[[0,1],[1,1],[1,0]]],
    "L 2": [[[1,0],[1,0],[1,1]],[[0,1],[0,1],[1,1]],[[1,1],[1,0],[1,0]],[[1,1],[0,1],[0,1]],[[1,1,1],[1,0,0]],[[1,1,1],[0,0,1]],[[1,0,0],[1,1,1]],[[0,0,1],[1,1,1]]],
    "L 3": [[[1,0,0],[1,0,0],[1,1,1]],[[0,0,1],[0,0,1],[1,1,1]],[[1,1,1],[1,0,0],[1,0,0]],[[1,1,1],[0,0,1],[0,0,1]]],
    "T": [[[0,1,0],[1,1,1]],[[1,1,1],[0,1,0]],[[1,0],[1,1],[1,0]],[[0,1],[1,1],[0,1]],[[1,0,0],[1,1,1],[1,0,0]],[[0,0,1],[1,1,1],[0,0,1]],[[0,1,0],[0,1,0],[1,1,1]],[[1,1,1],[0,1,0],[0,1,0]]],
    "U": [[[1,1,1],[1,0,1]],[[1,0,1],[1,1,1]],[[1,1],[1,0],[1,1]],[[1,1],[0,1],[1,1]]]
};

// Wadah untuk balok tambahan dari Custom Builder
let customBlocks = [];

function loadLibrary() {
    // Hanya membaca dan menyimpan balok Custom Builder
    const savedCustom = localStorage.getItem('blockzi_custom_blocks');
    if (savedCustom) {
        try { customBlocks = JSON.parse(savedCustom); } catch(e) { customBlocks = []; }
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

// Render Statis (No Edit, No Drag)
function renderLibrary() {
    const pal = document.getElementById('palette');
    pal.innerHTML = '';
    
    // 1. Render Kategori Permanen
    for (let category in permanentCategories) {
        if (permanentCategories[category].length > 0) {
            let title = document.createElement('div');
            title.className = 'lib-category-title';
            title.innerText = category;
            pal.appendChild(title);

            let gridWrapper = document.createElement('div');
            gridWrapper.className = 'palette-container-grid';
            gridWrapper.style.marginBottom = '12px';

            permanentCategories[category].forEach((shape) => {
                const divItem = document.createElement('div');
                divItem.className = 'p-item';
                divItem.appendChild(createMiniGrid(shape));
                // Aksi sentuh: Masuk ke spawner
                divItem.onclick = () => addToSpawner(shape);
                divItem.addEventListener('touchend', (e) => { e.preventDefault(); addToSpawner(shape); });
                gridWrapper.appendChild(divItem);
            });
            pal.appendChild(gridWrapper);
        }
    }

    // 2. Render Kategori Custom Builder (Jika ada)
    if (customBlocks.length > 0) {
        let title = document.createElement('div');
        title.className = 'lib-category-title';
        title.innerText = "BALOK CUSTOM";
        pal.appendChild(title);

        let gridWrapper = document.createElement('div');
        gridWrapper.className = 'palette-container-grid';
        gridWrapper.style.marginBottom = '12px';

        customBlocks.forEach((shape, index) => {
            const divItem = document.createElement('div');
            divItem.className = 'p-item';
            divItem.appendChild(createMiniGrid(shape));
            divItem.onclick = () => addToSpawner(shape);
            divItem.addEventListener('touchend', (e) => { e.preventDefault(); addToSpawner(shape); });
            
            // Khusus custom block: bisa dihapus
            divItem.oncontextmenu = (e) => {
                e.preventDefault();
                if (confirm("Hapus balok custom ini?")) {
                    customBlocks.splice(index, 1);
                    localStorage.setItem('blockzi_custom_blocks', JSON.stringify(customBlocks));
                    renderLibrary();
                }
            };
            gridWrapper.appendChild(divItem);
        });
        pal.appendChild(gridWrapper);
    }
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
    
    // Cek duplikasi di kategori permanen
    let isDuplicate = false;
    for (let cat in permanentCategories) {
        if (permanentCategories[cat].some(existing => JSON.stringify(existing) === JSON.stringify(trimmed))) {
            isDuplicate = true;
        }
    }
    // Cek duplikasi di custom block
    if (customBlocks.some(existing => JSON.stringify(existing) === JSON.stringify(trimmed))) {
        isDuplicate = true;
    }
    
    if (isDuplicate) {
        alert("Balok ini sudah ada di Koleksi Anda!");
        return;
    }
    
    customBlocks.push(trimmed);
    localStorage.setItem('blockzi_custom_blocks', JSON.stringify(customBlocks));
    
    renderLibrary();
    document.getElementById('clear-builder-btn').click();
    
    const paletteContainer = document.querySelector('.library-grouped-container');
    if (paletteContainer) paletteContainer.scrollTop = paletteContainer.scrollHeight;
};

function clearRecommendation() {
    currentRecommendation = null;
    itemRecommendation = null;
    
    document.getElementById('ai-status').textContent = "Status: Mode Input";
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
    
    let brainLabel;
    if (currentBrainMode === 4) {
        let sub = ai.getAdaptiveSubMode(state.grid);
        let subName = sub === 1 ? "Prediktif" : sub === 2 ? "Darurat" : "Combo";
        let fillPct = Math.round(ai.getBoardFillPercent(state.grid));
        brainLabel = `Auto\u2192${subName} (${fillPct}%)`;
    } else {
        brainLabel = currentBrainMode === 1 ? "Prediktif" : currentBrainMode === 2 ? "Darurat" : "Combo";
    }
    let result = ai.find_best_move(state, spawnerQueues, currentBrainMode);
    let isKiamat = result && result.score < -500000;
    let allPlaced = result && result.path && result.path.length === validBlocks.length;
    
    if (allPlaced) {
        currentRecommendation = result.path;
        document.getElementById('ai-status').textContent = `[${brainLabel}] Berhasil! (Skor: ${result.score})`;
        if (isKiamat) document.getElementById('ai-status').textContent += " ⚠️ AWAS KIAMAT!";
        document.getElementById('ai-status').className = "status-badge" + (isKiamat ? " alert" : "");
        document.getElementById('apply-btn').disabled = false;
        
        updateBoardVisuals(); 
        
    } else {
        let availabilities = {
            can1x1: document.getElementById('use-1x1-toggle') ? document.getElementById('use-1x1-toggle').checked : false,
            canTrash: document.getElementById('use-hammer-toggle') ? document.getElementById('use-hammer-toggle').checked : false,
            canBomb: document.getElementById('use-bomb-toggle') ? document.getElementById('use-bomb-toggle').checked : false
        };
        let itemsAllowed = availabilities.can1x1 || availabilities.canTrash || availabilities.canBomb;
        
        if (itemsAllowed) {
            document.getElementById('ai-status').textContent = "Evaluasi Masa Depan...";
            document.getElementById('ai-status').className = "status-badge alert";
            
            setTimeout(() => {
                let itemRec = ai.tryItems(state.grid, validBlocks, availabilities, currentBrainMode);
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

// ==========================================
// INITIALIZATION
// ==========================================
// Membersihkan sampah memori dari versi drag-and-drop lama
localStorage.removeItem('blockzi_pwa_cats');
localStorage.removeItem('blockzi_pwa_lib');

loadLibrary();
initBoard();
initBuilder();
updateBoardVisuals();
updateSpawnerVisuals();