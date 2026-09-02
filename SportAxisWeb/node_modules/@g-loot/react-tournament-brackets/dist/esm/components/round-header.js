import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import styled from 'styled-components';
const Text = styled.text `
  font-family: ${({ theme }) => theme.fontFamily};
  color: ${({ theme }) => theme.textColor.highlighted};
`;
const Rect = styled.rect.attrs(({ theme }) => ({
    fill: theme.roundHeaders.background,
})) ``;
export default function RoundHeader({ x, y = 0, width, roundHeader, canvasPadding, numOfRounds, tournamentRoundText, columnIndex, }) {
    return (_jsxs("g", { children: [_jsx(Rect, { x: x, y: y + canvasPadding, width: width, height: roundHeader.height, fill: roundHeader.backgroundColor, rx: "3", ry: "3" }), _jsxs(Text, Object.assign({ x: x + width / 2, y: y + canvasPadding + roundHeader.height / 2, style: {
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
//# sourceMappingURL=round-header.js.map