import { jsx as _jsx } from "react/jsx-runtime";
import React, { createContext, useReducer } from 'react';
const initialState = {
    hoveredMatchId: null,
    hoveredPartyId: null,
    hoveredColumnIndex: null,
    hoveredRowIndex: null,
};
const store = createContext(initialState);
const { Provider } = store;
const MatchContextProvider = ({ children }) => {
    const [state, dispatch] = useReducer((previousState, action) => {
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
    return _jsx(Provider, Object.assign({ value: { state, dispatch } }, { children: children }));
};
export { store as matchContext, MatchContextProvider };
//# sourceMappingURL=match-context.js.map