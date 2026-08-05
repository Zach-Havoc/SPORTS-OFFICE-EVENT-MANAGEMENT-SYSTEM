import { useContext } from 'react';
import { matchContext } from '../core/match-context';
const useMatchHighlightContext = ({ bracketSnippet = null }) => {
    var _a, _b, _c, _d;
    const { state: { hoveredPartyId }, } = useContext(matchContext);
    const previousTopMatch = bracketSnippet === null || bracketSnippet === void 0 ? void 0 : bracketSnippet.previousTopMatch;
    const previousBottomMatch = bracketSnippet === null || bracketSnippet === void 0 ? void 0 : bracketSnippet.previousBottomMatch;
    const currentMatch = bracketSnippet === null || bracketSnippet === void 0 ? void 0 : bracketSnippet.currentMatch;
    const topHighlighted = ((_a = currentMatch === null || currentMatch === void 0 ? void 0 : currentMatch.participants) === null || _a === void 0 ? void 0 : _a.some(p => p.id === hoveredPartyId)) &&
        ((_b = previousTopMatch === null || previousTopMatch === void 0 ? void 0 : previousTopMatch.participants) === null || _b === void 0 ? void 0 : _b.some(p => p.id === hoveredPartyId));
    const bottomHighlighted = ((_c = currentMatch === null || currentMatch === void 0 ? void 0 : currentMatch.participants) === null || _c === void 0 ? void 0 : _c.some(p => p.id === hoveredPartyId)) &&
        ((_d = previousBottomMatch === null || previousBottomMatch === void 0 ? void 0 : previousBottomMatch.participants) === null || _d === void 0 ? void 0 : _d.some(p => p.id === hoveredPartyId));
    return { topHighlighted, bottomHighlighted };
};
export default useMatchHighlightContext;
//# sourceMappingURL=use-match-highlight.js.map