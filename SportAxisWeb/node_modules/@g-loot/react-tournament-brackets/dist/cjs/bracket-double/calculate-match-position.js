"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculatePositionOfMatchLowerBracket = exports.returnLowerBracketColumnIndex = exports.calculatePositionOfMatchUpperBracket = exports.calculatePositionOfFinalGame = exports.calculateVerticalPositioning = exports.calculateHeightIncrease = exports.columnIncrement = exports.calculateVerticalStartingPoint = void 0;
const calculateVerticalStartingPoint = (columnIndex, height) => 2 ** columnIndex * (height / 2) - height / 2;
exports.calculateVerticalStartingPoint = calculateVerticalStartingPoint;
const columnIncrement = (columnIndex, height) => 2 ** columnIndex * height;
exports.columnIncrement = columnIncrement;
const calculateHeightIncrease = (columnIndex, rowIndex, height) => (0, exports.columnIncrement)(columnIndex, height) * rowIndex;
exports.calculateHeightIncrease = calculateHeightIncrease;
const calculateVerticalPositioning = ({ rowIndex, columnIndex, rowHeight: height, }) => {
    return ((0, exports.calculateHeightIncrease)(columnIndex, rowIndex, height) +
        (0, exports.calculateVerticalStartingPoint)(columnIndex, height));
};
exports.calculateVerticalPositioning = calculateVerticalPositioning;
const calculatePositionOfFinalGame = (rowIndex, columnIndex, { canvasPadding, rowHeight, columnWidth, gameHeight, upperBracketHeight, lowerBracketHeight, offsetX = 0, offsetY = 0, }) => {
    const yResult = gameHeight * (lowerBracketHeight / upperBracketHeight) - rowHeight;
    return {
        x: columnIndex * columnWidth + canvasPadding + offsetX,
        y: yResult + canvasPadding + offsetY,
    };
};
exports.calculatePositionOfFinalGame = calculatePositionOfFinalGame;
const calculatePositionOfMatchUpperBracket = (rowIndex, columnIndex, { canvasPadding, rowHeight, columnWidth, offsetX = 0, offsetY = 0 }) => {
    const yResult = (0, exports.calculateVerticalPositioning)({
        rowHeight,
        rowIndex,
        columnIndex,
    });
    const skipStep = index => Math.floor((index + 1) * 2) - 3;
    const xResult = columnIndex === 0 || columnIndex === 1
        ? columnIndex * columnWidth
        : skipStep(columnIndex) * columnWidth;
    return {
        x: xResult + canvasPadding + offsetX,
        y: yResult + canvasPadding + offsetY,
    };
};
exports.calculatePositionOfMatchUpperBracket = calculatePositionOfMatchUpperBracket;
const returnLowerBracketColumnIndex = columnIndex => Math.ceil((columnIndex + 1) / 2) - 1;
exports.returnLowerBracketColumnIndex = returnLowerBracketColumnIndex;
const calculatePositionOfMatchLowerBracket = (rowIndex, columnIndex, { canvasPadding, rowHeight, columnWidth, offsetX = 0, offsetY = 0 }) => {
    const result = (0, exports.calculateVerticalPositioning)({
        rowHeight,
        rowIndex,
        columnIndex: (0, exports.returnLowerBracketColumnIndex)(columnIndex),
    });
    return {
        x: columnIndex * columnWidth + canvasPadding + offsetX,
        y: result + canvasPadding + offsetY,
    };
};
exports.calculatePositionOfMatchLowerBracket = calculatePositionOfMatchLowerBracket;
//# sourceMappingURL=calculate-match-position.js.map