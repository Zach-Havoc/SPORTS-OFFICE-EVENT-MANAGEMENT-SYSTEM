"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const round_header_1 = __importDefault(require("../components/round-header"));
const calculate_match_position_1 = require("./calculate-match-position");
function RoundHeaders({ numOfRounds, calculatedStyles: { canvasPadding, columnWidth, rowHeight, roundHeader, width, }, }) {
    return ((0, jsx_runtime_1.jsx)(jsx_runtime_1.Fragment, { children: [...new Array(numOfRounds)].map((matchesColumn, columnIndex) => {
            const { x } = (0, calculate_match_position_1.calculatePositionOfMatchLowerBracket)(0, columnIndex, {
                canvasPadding,
                columnWidth,
                rowHeight,
            });
            return ((0, jsx_runtime_1.jsx)("g", { children: roundHeader.isShown && ((0, jsx_runtime_1.jsx)(round_header_1.default, { x: x, roundHeader: roundHeader, canvasPadding: canvasPadding, width: width, numOfRounds: numOfRounds, tournamentRoundText: (columnIndex + 1).toString(), columnIndex: columnIndex })) }, `round ${x}`));
        }) }));
}
exports.default = RoundHeaders;
//# sourceMappingURL=round-headers.js.map