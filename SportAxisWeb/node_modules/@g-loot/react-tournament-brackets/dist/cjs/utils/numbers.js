"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.returnOdd = exports.returnEven = exports.precisionRound = void 0;
const precisionRound = (number, precision) => {
    if (Number.isNaN(Number(number)))
        return number;
    const factor = 10 ** precision;
    return Math.round(number * factor) / factor;
};
exports.precisionRound = precisionRound;
const returnEven = num => (num !== 0 ? num - 1 * (num % 2) : 0);
exports.returnEven = returnEven;
const returnOdd = num => (num !== 0 ? num - 1 + 1 * (num % 2) : 0);
exports.returnOdd = returnOdd;
//# sourceMappingURL=numbers.js.map