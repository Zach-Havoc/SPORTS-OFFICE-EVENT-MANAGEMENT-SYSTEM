"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTheme = void 0;
const deepmerge_1 = __importDefault(require("deepmerge"));
const defaultTheme = {
    fontFamily: '"Roboto", "Arial", "Helvetica", "sans-serif"',
    transitionTimingFunction: 'cubic-bezier(0, 0.92, 0.77, 0.99)',
    disabledColor: '#5D6371',
    roundHeaders: {
        background: '#2F3648',
    },
    matchBackground: {
        wonColor: '#1D2232',
        lostColor: '#141822',
    },
    border: {
        color: '#22293B',
        highlightedColor: '#707582',
    },
    textColor: {
        highlighted: '#E9EAEC',
        main: '#BEC0C6',
        dark: '#707582',
        disabled: '#5D6371',
    },
    score: {
        text: {
            highlightedWonColor: '#118ADE',
            highlightedLostColor: '#FF9505',
        },
        background: {
            wonColor: '#10131C',
            lostColor: '#10131C',
        },
    },
    canvasBackground: '#0B0D13',
};
function createTheme(customTheme) {
    return (0, deepmerge_1.default)(defaultTheme, customTheme || {});
}
exports.createTheme = createTheme;
exports.default = defaultTheme;
//# sourceMappingURL=themes.js.map