"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const use_match_highlight_1 = __importDefault(require("../hooks/use-match-highlight"));
const settings_1 = require("../settings");
const Connector = ({ bracketSnippet, previousBottomMatchPosition = null, previousTopMatchPosition = null, currentMatchPosition, style, }) => {
    const { boxHeight, connectorColor, roundHeader, roundSeparatorWidth, lineInfo, horizontalOffset, connectorColorHighlight, width, } = (0, settings_1.getCalculatedStyles)(style);
    const pathInfo = multiplier => {
        const middlePointOfMatchComponent = boxHeight / 2;
        const previousMatch = multiplier > 0 ? previousBottomMatchPosition : previousTopMatchPosition;
        const startPoint = `${currentMatchPosition.x - horizontalOffset - lineInfo.separation} ${currentMatchPosition.y +
            lineInfo.homeVisitorSpread * multiplier +
            middlePointOfMatchComponent +
            (roundHeader.isShown ? roundHeader.height + roundHeader.marginBottom : 0)}`;
        const horizontalWidthLeft = currentMatchPosition.x - roundSeparatorWidth / 2 - horizontalOffset;
        const isPreviousMatchOnSameYLevel = Math.abs(currentMatchPosition.y - previousMatch.y) < 1;
        const verticalHeight = previousMatch.y +
            middlePointOfMatchComponent +
            (roundHeader.isShown ? roundHeader.height + roundHeader.marginBottom : 0);
        const horizontalWidthRight = previousMatch.x + width;
        if (isPreviousMatchOnSameYLevel) {
            return [`M${startPoint}`, `H${horizontalWidthRight}`];
        }
        return [
            `M${startPoint}`,
            `H${horizontalWidthLeft}`,
            `V${verticalHeight}`,
            `H${horizontalWidthRight}`,
        ];
    };
    const { topHighlighted, bottomHighlighted } = (0, use_match_highlight_1.default)({
        bracketSnippet,
    });
    const { x, y } = currentMatchPosition;
    return ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [previousTopMatchPosition && ((0, jsx_runtime_1.jsx)("path", { d: pathInfo(-1).join(' '), id: `connector-${x}-${y}-${-1}`, fill: "transparent", stroke: topHighlighted ? connectorColorHighlight : connectorColor })), previousBottomMatchPosition && ((0, jsx_runtime_1.jsx)("path", { d: pathInfo(1).join(' '), id: `connector-${x}-${y}-${1}`, fill: "transparent", stroke: bottomHighlighted ? connectorColorHighlight : connectorColor })), topHighlighted && (0, jsx_runtime_1.jsx)("use", { href: `connector-${x}-${y}-${-1}` }), bottomHighlighted && (0, jsx_runtime_1.jsx)("use", { href: `connector-${x}-${y}-${1}` })] }));
};
exports.default = Connector;
//# sourceMappingURL=connector.js.map