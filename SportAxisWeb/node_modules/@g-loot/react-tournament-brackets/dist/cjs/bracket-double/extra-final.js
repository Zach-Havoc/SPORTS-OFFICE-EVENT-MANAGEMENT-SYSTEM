"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const match_wrapper_1 = __importDefault(require("../core/match-wrapper"));
const calculate_match_position_1 = require("./calculate-match-position");
const extra_final_connectors_1 = __importDefault(require("./extra-final-connectors"));
const ExtraFinal = ({ match, rowIndex, columnIndex, gameHeight, gameWidth, calculatedStyles, onMatchClick, onPartyClick, matchComponent, bracketSnippet, numOfUpperRounds, numOfLowerRounds, upperBracketHeight, lowerBracketHeight, }) => {
    const { canvasPadding, columnWidth, rowHeight, roundHeader } = calculatedStyles;
    const { x, y } = (0, calculate_match_position_1.calculatePositionOfFinalGame)(rowIndex, columnIndex, {
        canvasPadding,
        columnWidth,
        rowHeight,
        gameHeight,
        upperBracketHeight,
        lowerBracketHeight,
    });
    return ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [columnIndex !== 0 && ((0, jsx_runtime_1.jsx)(extra_final_connectors_1.default, Object.assign({}, {
                numOfUpperRounds,
                numOfLowerRounds,
                rowIndex,
                columnIndex,
                gameWidth,
                gameHeight,
                lowerBracketHeight,
                upperBracketHeight,
                style: calculatedStyles,
                bracketSnippet,
            }))), (0, jsx_runtime_1.jsx)("g", { children: (0, jsx_runtime_1.jsx)(match_wrapper_1.default, { x: x, y: y +
                        (roundHeader.isShown
                            ? roundHeader.height + roundHeader.marginBottom
                            : 0), rowIndex: rowIndex, columnIndex: columnIndex, match: match, previousBottomMatch: bracketSnippet.previousBottomMatch, topText: match.startTime, bottomText: match.name, teams: match.participants, onMatchClick: onMatchClick, onPartyClick: onPartyClick, style: calculatedStyles, matchComponent: matchComponent }) })] }));
};
exports.default = ExtraFinal;
//# sourceMappingURL=extra-final.js.map