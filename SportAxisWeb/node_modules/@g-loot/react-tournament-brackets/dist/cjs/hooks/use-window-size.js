"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("react");
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? react_1.useLayoutEffect : react_1.useEffect;
function useWindowSize() {
    const [size, setSize] = (0, react_1.useState)([0, 0]);
    useIsomorphicLayoutEffect(() => {
        if (typeof global.window === 'undefined')
            return;
        function updateSize() {
            setSize([global.window.innerWidth, window.innerHeight]);
        }
        global.window.addEventListener('resize', updateSize);
        updateSize();
        return () => global.window.removeEventListener('resize', updateSize);
    }, []);
    return size;
}
exports.default = useWindowSize;
//# sourceMappingURL=use-window-size.js.map