"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const match_context_1 = require("./match-context");
const match_states_1 = require("./match-states");
const settings_1 = require("../settings");
const match_functions_1 = require("./match-functions");
function Match(_a) {
    var _b;
    var { rowIndex, columnIndex, match, previousBottomMatch = null, teams, topText, bottomText, style = settings_1.defaultStyle, matchComponent: MatchComponent, onMatchClick, onPartyClick } = _a, rest = __rest(_a, ["rowIndex", "columnIndex", "match", "previousBottomMatch", "teams", "topText", "bottomText", "style", "matchComponent", "onMatchClick", "onPartyClick"]);
    const { state: { hoveredPartyId }, dispatch, } = (0, react_1.useContext)(match_context_1.matchContext);
    const computedStyles = (0, settings_1.getCalculatedStyles)(style);
    const { width = 300, boxHeight = 70, connectorColor } = computedStyles;
    const sortedTeams = teams.sort((0, match_functions_1.sortTeamsSeedOrder)(previousBottomMatch));
    const topParty = (sortedTeams === null || sortedTeams === void 0 ? void 0 : sortedTeams[0]) ? sortedTeams[0] : {};
    const bottomParty = (sortedTeams === null || sortedTeams === void 0 ? void 0 : sortedTeams[1]) ? sortedTeams[1] : {};
    const topHovered = !Number.isNaN(hoveredPartyId) &&
        (topParty === null || topParty === void 0 ? void 0 : topParty.id) !== undefined &&
        hoveredPartyId === topParty.id;
    const bottomHovered = !Number.isNaN(hoveredPartyId) &&
        (bottomParty === null || bottomParty === void 0 ? void 0 : bottomParty.id) !== undefined &&
        hoveredPartyId === bottomParty.id;
    const participantWalkedOver = participant => match.state === match_states_1.MATCH_STATES.WALK_OVER &&
        teams.filter(team => !!team.id).length < 2 &&
        participant.id;
    const topWon = topParty.status === match_states_1.MATCH_STATES.WALK_OVER ||
        participantWalkedOver(topParty) ||
        topParty.isWinner;
    const bottomWon = bottomParty.status === match_states_1.MATCH_STATES.WALK_OVER ||
        participantWalkedOver(bottomParty) ||
        bottomParty.isWinner;
    const matchState = match_states_1.MATCH_STATES[match.state];
    const teamNameFallback = (_b = {
        [match_states_1.MATCH_STATES.WALK_OVER]: '',
        [match_states_1.MATCH_STATES.NO_SHOW]: '',
        [match_states_1.MATCH_STATES.DONE]: '',
        [match_states_1.MATCH_STATES.SCORE_DONE]: '',
        [match_states_1.MATCH_STATES.NO_PARTY]: '',
    }[matchState]) !== null && _b !== void 0 ? _b : 'TBD';
    const resultFallback = participant => {
        var _a;
        if (participant.status) {
            return ((_a = {
                WALKOVER: computedStyles.wonBywalkOverText,
                [match_states_1.MATCH_STATES.WALK_OVER]: computedStyles.wonBywalkOverText,
                [match_states_1.MATCH_STATES.NO_SHOW]: computedStyles.lostByNoShowText,
                [match_states_1.MATCH_STATES.NO_PARTY]: '',
            }[participant.status]) !== null && _a !== void 0 ? _a : '');
        }
        if (participantWalkedOver(participant)) {
            return computedStyles.wonBywalkOverText;
        }
        return '';
    };
    const onMouseEnter = partyId => {
        dispatch({
            type: 'SET_HOVERED_PARTYID',
            payload: {
                partyId,
                matchId: match.id,
                rowIndex,
                columnIndex,
            },
        });
    };
    const onMouseLeave = () => {
        dispatch({ type: 'SET_HOVERED_PARTYID', payload: null });
    };
    bottomParty.name = bottomParty.name || teamNameFallback;
    bottomParty.resultText =
        bottomParty.resultText || resultFallback(bottomParty);
    topParty.name = topParty.name || teamNameFallback;
    topParty.resultText = topParty.resultText || resultFallback(topParty);
    return ((0, jsx_runtime_1.jsx)("svg", Object.assign({ width: width, height: boxHeight, viewBox: `0 0 ${width} ${boxHeight}` }, rest, { children: (0, jsx_runtime_1.jsx)("foreignObject", Object.assign({ x: 0, y: 0, width: width, height: boxHeight }, { children: MatchComponent && ((0, jsx_runtime_1.jsx)(MatchComponent, Object.assign({}, {
                match,
                onMatchClick,
                onPartyClick,
                onMouseEnter,
                onMouseLeave,
                topParty,
                bottomParty,
                topWon,
                bottomWon,
                topHovered,
                bottomHovered,
                topText,
                bottomText,
                connectorColor,
                computedStyles,
            }))) })) })));
}
exports.default = Match;
//# sourceMappingURL=match-wrapper.js.map