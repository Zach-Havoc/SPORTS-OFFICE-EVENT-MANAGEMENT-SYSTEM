"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateSVGDimensions = void 0;
function calculateSVGDimensions(numOfRows, numOfColumns, rowHeight, columnWidth, canvasPadding, roundHeader, currentRound = '') {
    const bracketHeight = numOfRows * rowHeight;
    const bracketWidth = numOfColumns * columnWidth;
    const gameHeight = bracketHeight +
        canvasPadding * 2 +
        (roundHeader.isShown ? roundHeader.height + roundHeader.marginBottom : 0);
    const gameWidth = bracketWidth + canvasPadding * 2;
    const startPosition = [
        currentRound
            ? -(parseInt(currentRound, 10) * columnWidth - canvasPadding * 2)
            : 0,
        0,
    ];
    return { gameWidth, gameHeight, startPosition };
}
exports.calculateSVGDimensions = calculateSVGDimensions;
//# sourceMappingURL=calculate-svg-dimensions.js.map