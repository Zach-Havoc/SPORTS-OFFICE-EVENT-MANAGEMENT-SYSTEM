import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ThemeProvider } from 'styled-components';
import { generatePreviousRound } from '../core/match-functions';
import { calculateSVGDimensions } from '../core/calculate-svg-dimensions';
import { MatchContextProvider } from '../core/match-context';
import { defaultStyle, getCalculatedStyles } from '../settings';
import defaultTheme from '../themes/themes';
import UpperBracket from './upper-bracket';
import LowerBracket from './lower-bracket';
import RoundHeaders from './round-headers';
import FinalGame from './final-game';
import ExtraFinal from './extra-final';
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
const DoubleEliminationBracket = ({ matches, matchComponent, currentRound, onMatchClick, onPartyClick, svgWrapper: SvgWrapper = ({ children }) => _jsx("div", { children: children }), theme = defaultTheme, options: { style: inputStyle } = {
    style: defaultStyle,
}, }) => {
    const style = Object.assign(Object.assign(Object.assign({}, defaultStyle), inputStyle), { roundHeader: Object.assign(Object.assign({}, defaultStyle.roundHeader), inputStyle.roundHeader), lineInfo: Object.assign(Object.assign({}, defaultStyle.lineInfo), inputStyle.lineInfo) });
    const calculatedStyles = getCalculatedStyles(style);
    const { roundHeader, columnWidth, canvasPadding, rowHeight } = calculatedStyles;
    const { convergingMatch, finalsArray } = findTheFinals(matches);
    const hasMultipleFinals = (finalsArray === null || finalsArray === void 0 ? void 0 : finalsArray.length) > 1;
    const generateColumn = (matchesColumn, listOfMatches) => {
        const previousMatchesColumn = generatePreviousRound(matchesColumn, listOfMatches);
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
    const upperBracketDimensions = calculateSVGDimensions(upperColumns[0].length, upperColumns.length, rowHeight, columnWidth, canvasPadding, roundHeader, currentRound);
    const lowerBracketDimensions = calculateSVGDimensions(lowerColumns[0].length, lowerColumns.length, rowHeight, columnWidth, canvasPadding, roundHeader, currentRound);
    const fullBracketDimensions = calculateSVGDimensions(lowerColumns[0].length, totalNumOfRounds, rowHeight, columnWidth, canvasPadding, roundHeader, currentRound);
    const { gameWidth } = fullBracketDimensions;
    const gameHeight = upperBracketDimensions.gameHeight + lowerBracketDimensions.gameHeight;
    const { startPosition } = upperBracketDimensions;
    return (_jsx(ThemeProvider, Object.assign({ theme: theme }, { children: _jsx(SvgWrapper, Object.assign({ bracketWidth: gameWidth, bracketHeight: gameHeight, startAt: startPosition }, { children: _jsx("svg", Object.assign({ height: gameHeight, width: gameWidth, viewBox: `0 0 ${gameWidth} ${gameHeight}` }, { children: _jsx(MatchContextProvider, { children: _jsxs("g", { children: [_jsx(RoundHeaders, Object.assign({}, {
                                numOfRounds: totalNumOfRounds,
                                calculatedStyles,
                            })), _jsx(UpperBracket, Object.assign({}, {
                                columns: upperColumns,
                                calculatedStyles,
                                gameHeight,
                                gameWidth,
                                onMatchClick,
                                onPartyClick,
                                matchComponent,
                            })), _jsx(LowerBracket, Object.assign({}, {
                                columns: lowerColumns,
                                calculatedStyles,
                                gameHeight,
                                gameWidth,
                                onMatchClick,
                                onPartyClick,
                                matchComponent,
                                upperBracketHeight: upperBracketDimensions.gameHeight,
                            })), _jsx(FinalGame, Object.assign({}, {
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
                            })), (finalsArray === null || finalsArray === void 0 ? void 0 : finalsArray.length) > 1 && (_jsx(ExtraFinal, Object.assign({}, {
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
export default DoubleEliminationBracket;
//# sourceMappingURL=double-elim-bracket.js.map