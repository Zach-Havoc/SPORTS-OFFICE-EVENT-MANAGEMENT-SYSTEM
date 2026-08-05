"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const match_wrapper_1 = __importDefault(require("../core/match-wrapper"));
const match_functions_1 = require("../core/match-functions");
const calculate_match_position_1 = require("./calculate-match-position");
const lower_connectors_1 = __importDefault(require("./lower-connectors"));
const LowerBracket = ({ columns, calculatedStyles, gameHeight, gameWidth, onMatchClick, onPartyClick, matchComponent, upperBracketHeight, }) => {
    const { canvasPadding, columnWidth, rowHeight, roundHeader } = calculatedStyles;
    return columns.map((matchesColumn, columnIndex) => matchesColumn.map((match, rowIndex) => {
        const { x, y } = (0, calculate_match_position_1.calculatePositionOfMatchLowerBracket)(rowIndex, columnIndex, {
            canvasPadding,
            columnWidth,
            rowHeight,
            offsetY: upperBracketHeight,
        });
        const isUpperSeedingRound = columnIndex % 2 !== 0;
        const previousBottomPosition = isUpperSeedingRound
            ? rowIndex
            : (rowIndex + 1) * 2 - 1;
        const { previousTopMatch, previousBottomMatch } = (0, match_functions_1.getPreviousMatches)(columnIndex, columns, previousBottomPosition);
        return ((0, jsx_runtime_1.jsxs)("g", { children: [columnIndex !== 0 && ((0, jsx_runtime_1.jsx)(lower_connectors_1.default, Object.assign({}, {
                    bracketSnippet: {
                        currentMatch: match,
                        previousTopMatch: !isUpperSeedingRound && previousTopMatch,
                        previousBottomMatch,
                    },
                    rowIndex,
                    columnIndex,
                    gameHeight,
                    gameWidth,
                    style: calculatedStyles,
                    offsetY: upperBracketHeight,
                }))), (0, jsx_runtime_1.jsx)("g", { children: (0, jsx_runtime_1.jsx)(match_wrapper_1.default, { x: x, y: y +
                            (roundHeader.isShown
                                ? roundHeader.height + roundHeader.marginBottom
                                : 0), rowIndex: rowIndex, columnIndex: columnIndex, match: match, previousBottomMatch: previousBottomMatch, topText: match.startTime, bottomText: match.name, teams: match.participants, onMatchClick: onMatchClick, onPartyClick: onPartyClick, style: calculatedStyles, matchComponent: matchComponent }) })] }, x + y));
    }));
};
exports.default = LowerBracket;
//# sourceMappingURL=lower-bracket.js.map