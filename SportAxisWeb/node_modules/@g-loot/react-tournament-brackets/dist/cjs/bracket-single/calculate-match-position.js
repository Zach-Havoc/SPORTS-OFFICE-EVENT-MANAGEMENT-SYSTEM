"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculatePositionOfMatch = exports.calculateVerticalPositioning = exports.calculateHeightIncrease = exports.columnIncrement = exports.calculateVerticalStartingPoint = void 0;
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
const calculatePositionOfMatch = (rowIndex, columnIndex, { canvasPadding, rowHeight, columnWidth, offsetX = 0, offsetY = 0 }) => {
    const result = (0, exports.calculateVerticalPositioning)({
        rowHeight,
        rowIndex,
        columnIndex,
    });
    return {
        x: columnIndex * columnWidth + canvasPadding + offsetX,
        y: result + canvasPadding + offsetY,
    };
};
exports.calculatePositionOfMatch = calculatePositionOfMatch;
//# sourceMappingURL=calculate-match-position.js.map