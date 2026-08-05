declare const store: React.Context<{
    hoveredMatchId: any;
    hoveredPartyId: any;
    hoveredColumnIndex: any;
    hoveredRowIndex: any;
}>;
export function MatchContextProvider({ children }: {
    children: any;
}): import("react/jsx-runtime").JSX.Element;
import React from "react";
export { store as matchContext };
