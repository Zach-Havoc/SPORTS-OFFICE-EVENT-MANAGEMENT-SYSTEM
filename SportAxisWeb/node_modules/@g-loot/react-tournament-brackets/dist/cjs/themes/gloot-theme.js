"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const themes_1 = require("./themes");
const GlootTheme = (0, themes_1.createTheme)({
    textColor: { main: '#000000', highlighted: '#F4F2FE', dark: '#707582' },
    matchBackground: { wonColor: '#2D2D59', lostColor: '#1B1D2D' },
    score: {
        background: {
            wonColor: `#10131C`,
            lostColor: '#10131C',
        },
        text: { highlightedWonColor: '#7BF59D', highlightedLostColor: '#FB7E94' },
    },
    border: {
        color: '#292B43',
        highlightedColor: 'RGBA(152,82,242,0.4)',
    },
    roundHeader: { backgroundColor: '#3B3F73', fontColor: '#F4F2FE' },
    connectorColor: '#3B3F73',
    connectorColorHighlight: 'RGBA(152,82,242,0.4)',
    svgBackground: '#0F121C',
});
exports.default = GlootTheme;
//# sourceMappingURL=gloot-theme.js.map