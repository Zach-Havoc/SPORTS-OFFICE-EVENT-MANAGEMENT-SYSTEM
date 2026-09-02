"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const connector_1 = __importDefault(require("../components/connector"));
const settings_1 = require("../settings");
const calculate_match_position_1 = require("./calculate-match-position");
const ConnectorsUpper = ({ bracketSnippet, rowIndex, columnIndex, style, offsetY = 0, isLowerBracket = false, }) => {
    const { columnWidth, rowHeight, canvasPadding } = (0, settings_1.getCalculatedStyles)(style);
    const isUpperSeedingRound = isLowerBracket && columnIndex % 2 !== 0;
    const positioningFunction = isLowerBracket
        ? calculate_match_position_1.calculatePositionOfMatchLowerBracket
        : calculate_match_position_1.calculatePositionOfMatchUpperBracket;
    const currentMatchPosition = positioningFunction(rowIndex, columnIndex, {
        canvasPadding,
        rowHeight,
        columnWidth,
        offsetY,
    });
    const previousBottomPosition = isUpperSeedingRound
        ? rowIndex
        : (rowIndex + 1) * 2 - 1;
    const previousTopMatchPosition = !isUpperSeedingRound &&
        positioningFunction(previousBottomPosition - 1, columnIndex - 1, {
            canvasPadding,
            rowHeight,
            columnWidth,
            offsetY,
        });
    const previousBottomMatchPosition = positioningFunction(previousBottomPosition, columnIndex - 1, {
        canvasPadding,
        rowHeight,
        columnWidth,
        offsetY,
    });
    return ((0, jsx_runtime_1.jsx)(connector_1.default, { bracketSnippet: bracketSnippet, previousBottomMatchPosition: previousBottomMatchPosition, previousTopMatchPosition: previousTopMatchPosition, currentMatchPosition: currentMatchPosition, style: style }));
};
exports.default = ConnectorsUpper;
//# sourceMappingURL=upper-connectors.js.map