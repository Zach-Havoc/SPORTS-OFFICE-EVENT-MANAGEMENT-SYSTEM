"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const connector_1 = __importDefault(require("../components/connector"));
const settings_1 = require("../settings");
const calculate_match_position_1 = require("./calculate-match-position");
const FinalConnectors = ({ rowIndex, columnIndex, style, bracketSnippet = null, offsetY = 0, numOfLowerRounds, lowerBracketHeight, upperBracketHeight, gameHeight, }) => {
    const { columnWidth, rowHeight, canvasPadding } = (0, settings_1.getCalculatedStyles)(style);
    const currentMatchPosition = (0, calculate_match_position_1.calculatePositionOfFinalGame)(rowIndex, columnIndex, {
        canvasPadding,
        rowHeight,
        columnWidth,
        offsetY,
        lowerBracketHeight,
        upperBracketHeight,
        gameHeight,
    });
    const previousBottomMatchPosition = (0, calculate_match_position_1.calculatePositionOfFinalGame)(0, numOfLowerRounds, {
        canvasPadding,
        rowHeight,
        columnWidth,
        offsetY,
        lowerBracketHeight,
        upperBracketHeight,
        gameHeight,
    });
    return ((0, jsx_runtime_1.jsx)(connector_1.default, { bracketSnippet: bracketSnippet, previousBottomMatchPosition: previousBottomMatchPosition, currentMatchPosition: currentMatchPosition, style: style }));
};
exports.default = FinalConnectors;
//# sourceMappingURL=extra-final-connectors.js.map