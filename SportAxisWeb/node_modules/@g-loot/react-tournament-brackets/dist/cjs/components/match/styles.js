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
exports.Anchor = exports.Line = exports.Side = exports.Score = exports.Team = exports.StyledMatch = exports.BottomText = exports.TopText = exports.Wrapper = void 0;
const styled_components_1 = __importStar(require("styled-components"));
exports.Wrapper = styled_components_1.default.div `
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: stretch;
  height: 100%;
  font-family: ${({ theme }) => theme.fontFamily};
`;
exports.TopText = styled_components_1.default.p `
  color: ${({ theme }) => theme.textColor.dark};
  margin-bottom: 0.2rem;
  min-height: 1.25rem;
`;
exports.BottomText = styled_components_1.default.p `
  color: ${({ theme }) => theme.textColor.dark};

  flex: 0 0 none;
  text-align: center;
  margin-top: 0.2rem;
  min-height: 1.25rem;
`;
exports.StyledMatch = styled_components_1.default.div `
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  justify-content: space-between;
`;
exports.Team = styled_components_1.default.div ``;
exports.Score = styled_components_1.default.div `
  display: flex;
  height: 100%;
  padding: 0 1rem;
  align-items: center;
  width: 20%;
  justify-content: center;
  background: ${({ theme, won }) => won ? theme.score.background.wonColor : theme.score.background.lostColor};
  color: ${({ theme, won }) => won ? theme.textColor.highlighted : theme.textColor.dark};
`;
exports.Side = styled_components_1.default.div `
  display: flex;
  height: 100%;
  align-items: center;
  justify-content: space-between;
  padding: 0 0 0 1rem;
  background: ${({ theme, won }) => won ? theme.matchBackground.wonColor : theme.matchBackground.lostColor};

  :first-of-type {
    border-top-right-radius: 3px;
    border-top-left-radius: 3px;
    border-top-width: 2px;
  }
  :last-of-type {
    border-bottom-right-radius: 3px;
    border-bottom-left-radius: 3px;
    border-bottom-width: 2px;
  }
  border-right: 4px solid ${({ theme }) => theme.border.color};
  border-left: 4px solid ${({ theme }) => theme.border.color};
  border-top: 1px solid ${({ theme }) => theme.border.color};
  border-bottom: 1px solid ${({ theme }) => theme.border.color};

  transition: border-color 0.5s ${({ theme }) => theme.transitionTimingFunction};
  ${exports.Team} {
    color: ${({ theme, won }) => won ? theme.textColor.highlighted : theme.textColor.dark};
  }
  ${exports.Score} {
    color: ${({ theme, won }) => won ? theme.textColor.highlighted : theme.textColor.dark};
  }
  ${({ hovered, theme, won }) => hovered &&
    (0, styled_components_1.css) `
      border-color: ${theme.border.highlightedColor};
      ${exports.Team} {
        color: ${theme.textColor.highlighted};
      }
      ${exports.Score} {
        color: ${won
        ? theme.score.text.highlightedWonColor
        : theme.score.text.highlightedLostColor};
      }
    `}
`;
exports.Line = styled_components_1.default.div `
  height: 1px;
  transition: border-color 0.5s ${({ theme }) => theme.smooth};

  border-width: 1px;
  border-style: solid;
  border-color: ${({ highlighted, theme }) => highlighted ? theme.border.highlightedColor : theme.border.color};
`;
exports.Anchor = styled_components_1.default.a `
  font-family: ${(props) => props.font ? props.font : props.theme.fontFamily};
  font-weight: ${(props) => (props.bold ? '700' : '400')};
  color: ${(props) => props.theme.textColor.main};
  font-size: ${(props) => (props.size ? props.size : '1rem')};
  line-height: 1.375rem;
  text-decoration: none;
  cursor: pointer;
  &:hover {
    text-decoration: underline;
  }
`;
//# sourceMappingURL=styles.js.map