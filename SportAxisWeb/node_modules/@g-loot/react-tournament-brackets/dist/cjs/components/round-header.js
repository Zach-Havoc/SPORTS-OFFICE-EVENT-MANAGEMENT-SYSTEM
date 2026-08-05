"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const styled_components_1 = __importDefault(require("styled-components"));
const Text = styled_components_1.default.text `
  font-family: ${({ theme }) => theme.fontFamily};
  color: ${({ theme }) => theme.textColor.highlighted};
`;
const Rect = styled_components_1.default.rect.attrs(({ theme }) => ({
    fill: theme.roundHeaders.background,
})) ``;
function RoundHeader({ x, y = 0, width, roundHeader, canvasPadding, numOfRounds, tournamentRoundText, columnIndex, }) {
    return ((0, jsx_runtime_1.jsxs)("g", { children: [(0, jsx_runtime_1.jsx)(Rect, { x: x, y: y + canvasPadding, width: width, height: roundHeader.height, fill: roundHeader.backgroundColor, rx: "3", ry: "3" }), (0, jsx_runtime_1.jsxs)(Text, Object.assign({ x: x + width / 2, y: y + canvasPadding + roundHeader.height / 2, style: {
                    fontFamily: roundHeader.fontFamily,
                    fontSize: `${roundHeader.fontSize}px`,
                    color: roundHeader.fontColor,
                }, fill: "currentColor", dominantBaseline: "middle", textAnchor: "middle" }, { children: [!roundHeader.roundTextGenerator &&
                        columnIndex + 1 === numOfRounds &&
                        'Final', !roundHeader.roundTextGenerator &&
                        columnIndex + 1 === numOfRounds - 1 &&
                        'Semi-final', !roundHeader.roundTextGenerator &&
                        columnIndex + 1 < numOfRounds - 1 &&
                        `Round ${tournamentRoundText}`, roundHeader.roundTextGenerator &&
                        roundHeader.roundTextGenerator(columnIndex + 1, numOfRounds)] }))] }));
}
exports.default = RoundHeader;
//# sourceMappingURL=round-header.js.map