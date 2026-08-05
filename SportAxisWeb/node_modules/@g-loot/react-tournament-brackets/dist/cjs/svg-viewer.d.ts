export default SvgViewer;
declare function SvgViewer({ height, width, bracketWidth, bracketHeight, children, startAt, scaleFactor, customToolbar, ...rest }: {
    [x: string]: any;
    height?: number;
    width?: number;
    bracketWidth: any;
    bracketHeight: any;
    children: any;
    startAt?: number[];
    scaleFactor?: number;
    customToolbar?: any;
}): import("react/jsx-runtime").JSX.Element;
