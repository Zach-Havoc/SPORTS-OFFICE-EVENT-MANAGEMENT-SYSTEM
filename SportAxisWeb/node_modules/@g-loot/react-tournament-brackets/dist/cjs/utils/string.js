"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sortAlphanumerically = void 0;
const sortAlphanumerically = (a, b) => {
    const collator = new Intl.Collator(undefined, {
        numeric: true,
        sensitivity: 'base',
    });
    return collator.compare(a, b);
};
exports.sortAlphanumerically = sortAlphanumerically;
//# sourceMappingURL=string.js.map