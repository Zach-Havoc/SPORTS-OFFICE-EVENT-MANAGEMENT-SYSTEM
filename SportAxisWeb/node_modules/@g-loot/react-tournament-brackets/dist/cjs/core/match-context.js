"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchContextProvider = exports.matchContext = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = __importStar(require("react"));
const initialState = {
    hoveredMatchId: null,
    hoveredPartyId: null,
    hoveredColumnIndex: null,
    hoveredRowIndex: null,
};
const store = (0, react_1.createContext)(initialState);
exports.matchContext = store;
const { Provider } = store;
const MatchContextProvider = ({ children }) => {
    const [state, dispatch] = (0, react_1.useReducer)((previousState, action) => {
        var _a;
        switch (action.type) {
            case 'SET_HOVERED_PARTYID': {
                const { partyId, columnIndex, rowIndex, matchId } = (_a = action.payload) !== null && _a !== void 0 ? _a : {};
                return Object.assign(Object.assign({}, previousState), { hoveredPartyId: partyId, hoveredColumnIndex: columnIndex, hoveredRowIndex: rowIndex, hoveredMatchId: matchId });
            }
            default:
                throw new Error();
        }
    }, initialState);
    return (0, jsx_runtime_1.jsx)(Provider, Object.assign({ value: { state, dispatch } }, { children: children }));
};
exports.MatchContextProvider = MatchContextProvider;
//# sourceMappingURL=match-context.js.map