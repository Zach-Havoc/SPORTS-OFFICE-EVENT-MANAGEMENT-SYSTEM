"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const styled_components_1 = require("styled-components");
const match_functions_1 = require("../core/match-functions");
const calculate_svg_dimensions_1 = require("../core/calculate-svg-dimensions");
const match_context_1 = require("../core/match-context");
const settings_1 = require("../settings");
const themes_1 = __importDefault(require("../themes/themes"));
const upper_bracket_1 = __importDefault(require("./upper-bracket"));
const lower_bracket_1 = __importDefault(require("./lower-bracket"));
const round_headers_1 = __importDefault(require("./round-headers"));
const final_game_1 = __importDefault(require("./final-game"));
const extra_final_1 = __importDefault(require("./extra-final"));
function findTheFinals(matches) {
    const isFinalInUpper = matches.upper.some(match => !match.nextMatchId);
    const isFinalInLower = matches.lower.some(match => !match.nextMatchId);
    let convergingMatch;
    let finalsArray;
    if (isFinalInLower) {
        const lastUpper = matches.upper.find(match => {
            const hasNextMatchInUpper = matches.upper.some(m => m.id === match.nextMatchId);
            return !hasNextMatchInUpper;
        });
        convergingMatch = matches.lower.find(match => match.id === lastUpper.nextMatchId);
        finalsArray = [
            convergingMatch,
            matches.lower.find(m => m.id === convergingMatch.nextMatchId),
        ].filter(m => m === null || m === void 0 ? void 0 : m.id);
    }
    if (isFinalInUpper) {
        const lastLower = matches.lower.find(match => {
            const hasNextMatchInLower = matches.lower.some(m => m.id === match.nextMatchId);
            return !hasNextMatchInLower;
        });
        convergingMatch = matches.upper.find(match => match.id === lastLower.nextMatchId);
        finalsArray = [
            convergingMatch,
            matches.upper.find(m => m.id === convergingMatch.nextMatchId),
        ].filter(m => m === null || m === void 0 ? void 0 : m.id);
    }
    return { convergingMatch, finalsArray };
}
const DoubleEliminationBracket = ({ matches, matchComponent, currentRound, onMatchClick, onPartyClick, svgWrapper: SvgWrapper = ({ children }) => (0, jsx_runtime_1.jsx)("div", { children: children }), theme = themes_1.default, options: { style: inputStyle } = {
    style: settings_1.defaultStyle,
}, }) => {
    const style = Object.assign(Object.assign(Object.assign({}, settings_1.defaultStyle), inputStyle), { roundHeader: Object.assign(Object.assign({}, settings_1.defaultStyle.roundHeader), inputStyle.roundHeader), lineInfo: Object.assign(Object.assign({}, settings_1.defaultStyle.lineInfo), inputStyle.lineInfo) });
    const calculatedStyles = (0, settings_1.getCalculatedStyles)(style);
    const { roundHeader, columnWidth, canvasPadding, rowHeight } = calculatedStyles;
    const { convergingMatch, finalsArray } = findTheFinals(matches);
    const hasMultipleFinals = (finalsArray === null || finalsArray === void 0 ? void 0 : finalsArray.length) > 1;
    const generateColumn = (matchesColumn, listOfMatches) => {
        const previousMatchesColumn = (0, match_functions_1.generatePreviousRound)(matchesColumn, listOfMatches);
        if (previousMatchesColumn.length > 0) {
            return [
                ...generateColumn(previousMatchesColumn, listOfMatches),
                previousMatchesColumn,
            ];
        }
        return [previousMatchesColumn];
    };
    const generate2DBracketArray = (final, listOfMatches) => {
        return final
            ? [...generateColumn([final], listOfMatches), []].filter(arr => arr.length > 0)
            : [];
    };
    const upperColumns = generate2DBracketArray(convergingMatch, matches.upper);
    const lowerColumns = generate2DBracketArray(convergingMatch, matches.lower);
    const totalNumOfRounds = lowerColumns.length + 1 + (hasMultipleFinals && finalsArray.length - 1);
    const upperBracketDimensions = (0, calculate_svg_dimensions_1.calculateSVGDimensions)(upperColumns[0].length, upperColumns.length, rowHeight, columnWidth, canvasPadding, roundHeader, currentRound);
    const lowerBracketDimensions = (0, calculate_svg_dimensions_1.calculateSVGDimensions)(lowerColumns[0].length, lowerColumns.length, rowHeight, columnWidth, canvasPadding, roundHeader, currentRound);
    const fullBracketDimensions = (0, calculate_svg_dimensions_1.calculateSVGDimensions)(lowerColumns[0].length, totalNumOfRounds, rowHeight, columnWidth, canvasPadding, roundHeader, currentRound);
    const { gameWidth } = fullBracketDimensions;
    const gameHeight = upperBracketDimensions.gameHeight + lowerBracketDimensions.gameHeight;
    const { startPosition } = upperBracketDimensions;
    return ((0, jsx_runtime_1.jsx)(styled_components_1.ThemeProvider, Object.assign({ theme: theme }, { children: (0, jsx_runtime_1.jsx)(SvgWrapper, Object.assign({ bracketWidth: gameWidth, bracketHeight: gameHeight, startAt: startPosition }, { children: (0, jsx_runtime_1.jsx)("svg", Object.assign({ height: gameHeight, width: gameWidth, viewBox: `0 0 ${gameWidth} ${gameHeight}` }, { children: (0, jsx_runtime_1.jsx)(match_context_1.MatchContextProvider, { children: (0, jsx_runtime_1.jsxs)("g", { children: [(0, jsx_runtime_1.jsx)(round_headers_1.default, Object.assign({}, {
                                numOfRounds: totalNumOfRounds,
                                calculatedStyles,
                            })), (0, jsx_runtime_1.jsx)(upper_bracket_1.default, Object.assign({}, {
                                columns: upperColumns,
                                calculatedStyles,
                                gameHeight,
                                gameWidth,
                                onMatchClick,
                                onPartyClick,
                                matchComponent,
                            })), (0, jsx_runtime_1.jsx)(lower_bracket_1.default, Object.assign({}, {
                                columns: lowerColumns,
                                calculatedStyles,
                                gameHeight,
                                gameWidth,
                                onMatchClick,
                                onPartyClick,
                                matchComponent,
                                upperBracketHeight: upperBracketDimensions.gameHeight,
                            })), (0, jsx_runtime_1.jsx)(final_game_1.default, Object.assign({}, {
                                match: convergingMatch,
                                numOfUpperRounds: upperColumns.length,
                                numOfLowerRounds: lowerColumns.length,
                                bracketSnippet: {
                                    previousTopMatch: upperColumns[upperColumns.length - 1][0],
                                    previousBottomMatch: lowerColumns[lowerColumns.length - 1][0],
                                    currentMatch: convergingMatch,
                                },
                                upperBracketHeight: upperBracketDimensions.gameHeight,
                                lowerBracketHeight: lowerBracketDimensions.gameHeight,
                                calculatedStyles,
                                columnIndex: lowerColumns.length,
                                rowIndex: 0,
                                gameHeight,
                                gameWidth,
                                matchComponent,
                                onMatchClick,
                                onPartyClick,
                            })), (finalsArray === null || finalsArray === void 0 ? void 0 : finalsArray.length) > 1 && ((0, jsx_runtime_1.jsx)(extra_final_1.default, Object.assign({}, {
                                match: finalsArray[1],
                                numOfUpperRounds: upperColumns.length,
                                numOfLowerRounds: lowerColumns.length,
                                bracketSnippet: {
                                    previousBottomMatch: finalsArray[0],
                                    currentMatch: finalsArray[1],
                                },
                                upperBracketHeight: upperBracketDimensions.gameHeight,
                                lowerBracketHeight: lowerBracketDimensions.gameHeight,
                                calculatedStyles,
                                columnIndex: lowerColumns.length + 1,
                                rowIndex: 0,
                                gameHeight,
                                gameWidth,
                                matchComponent,
                                onMatchClick,
                                onPartyClick,
                            })))] }) }) })) })) })));
};
exports.default = DoubleEliminationBracket;
//# sourceMappingURL=double-elim-bracket.js.map